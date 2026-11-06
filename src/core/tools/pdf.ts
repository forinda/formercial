// PDF tools: merge, split, compress and pictures through Ghostscript and
// Poppler (programs, so they run in the sandbox with a time limit), signing
// through pdf-lib and @signpdf in this process. Each writes into `${dir}/out`.
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { z } from 'zod'
import type { Corner, PdfJob } from './pdf-job'
import { runPdfJob } from './pdf-worker'
import { defineTool, type ToolField } from './tool'

const stem = (path: string) => basename(path, extname(path))
/** -dSAFER: Ghostscript reads only what it's given and writes only where it's told. */
const GS = ['-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sDEVICE=pdfwrite']
const RESIGN = 'The file is written anew, so any digital signatures already in it stop being valid.'

/** First and last page fields: 0 means the document's own first or last. */
const RANGE: ToolField[] = [
  { key: 'from', label: 'From page (0 for the first)', kind: 'number', min: 0 },
  { key: 'to', label: 'To page (0 for the last)', kind: 'number', min: 0 },
]
const range = {
  from: z.number().int().min(0).default(0),
  to: z.number().int().min(0).default(0),
}
function checkRange(from: number, to: number) {
  if (to && from > to) throw new Error('the first page is after the last one')
}

export const pdfMerge = defineTool<Record<string, never>>({
  id: 'pdf-merge',
  title: 'Merge PDFs',
  description: 'Put several PDFs together into one, in the order you list them.',
  group: 'pdf',
  action: 'Merge',
  accepts: ['pdf'],
  minFiles: 2,
  maxFiles: 20,
  fields: [],
  options: z.object({}),
  needs: ['gs'],
  needsSandbox: true,
  async run({ inputs, dir, exec }) {
    const out = `${stem(inputs[0])}-merged.pdf`
    await exec('gs', GS.concat('-o', join(dir, 'out', out), inputs))
    return [out]
  },
})

export const pdfSplit = defineTool<{ mode: 'each' | 'range'; from: number; to: number }>({
  id: 'pdf-split',
  title: 'Split a PDF',
  description: 'Take some pages out as a PDF of their own, or every page as its own PDF.',
  group: 'pdf',
  action: 'Split',
  accepts: ['pdf'],
  fields: [
    {
      key: 'mode',
      label: 'Make',
      kind: 'select',
      choices: [
        { value: 'each', label: 'One PDF per page' },
        { value: 'range', label: 'One PDF of those pages' },
      ],
    },
    ...RANGE,
  ],
  options: z.object({ mode: z.enum(['each', 'range']).default('each'), ...range }),
  needs: ['gs'],
  needsSandbox: true,
  async run({ inputs, dir, options, exec }) {
    const { mode, from, to } = options
    checkRange(from, to)
    const name = stem(inputs[0])
    const list = from || to ? [`-sPageList=${from || 1}-${to || ''}`] : []
    const out = mode === 'each' ? `${name}-p%04d.pdf` : `${name}-pages.pdf`
    await exec('gs', GS.concat(list, '-o', join(dir, 'out', out), inputs[0]))
    if (mode === 'range') return [out]
    // Ghostscript counts the pages it wrote from 1; name them by the page they were.
    const shift = (from || 1) - 1
    if (shift) {
      const made = (await readdir(join(dir, 'out'))).sort().reverse()
      for (const file of made) {
        const n = Number(/-p(\d+)\.pdf$/.exec(file)?.[1])
        const renamed = `${name}-p${String(n + shift).padStart(4, '0')}.pdf`
        await rename(join(dir, 'out', file), join(dir, 'out', renamed))
      }
    }
    return readdir(join(dir, 'out'))
  },
})

const QUALITY = ['screen', 'ebook', 'printer'] as const

export const pdfCompress = defineTool<{ quality: (typeof QUALITY)[number] }>({
  id: 'pdf-compress',
  title: 'Make a PDF smaller',
  description: 'Shrink a PDF by lowering the quality of its pictures.',
  group: 'pdf',
  action: 'Compress',
  accepts: ['pdf'],
  maxFiles: 10,
  fields: [
    {
      key: 'quality',
      label: 'Pictures',
      kind: 'select',
      choices: [
        { value: 'ebook', label: 'For screens (150 dpi)' },
        { value: 'screen', label: 'Smallest (72 dpi)' },
        { value: 'printer', label: 'For printing (300 dpi)' },
      ],
    },
  ],
  options: z.object({ quality: z.enum(QUALITY).default('ebook') }),
  needs: ['gs'],
  needsSandbox: true,
  note: 'Text stays sharp. A PDF that is mostly text may hardly shrink.',
  async run({ inputs, dir, options, exec }) {
    const outs = []
    for (const input of inputs) {
      const out = `${stem(input)}.pdf`
      await exec(
        'gs',
        GS.concat(
          '-dCompatibilityLevel=1.5',
          `-dPDFSETTINGS=/${options.quality}`,
          '-o',
          join(dir, 'out', out),
          input,
        ),
      )
      outs.push(out)
    }
    return outs
  },
})

export const pdfToImages = defineTool<{
  format: 'png' | 'jpeg'
  dpi: number
  from: number
  to: number
}>({
  id: 'pdf-to-images',
  title: 'PDF to pictures',
  description: 'Each page as a PNG or JPG picture.',
  group: 'pdf',
  accepts: ['pdf'],
  fields: [
    {
      key: 'format',
      label: 'Make',
      kind: 'select',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPG' },
      ],
    },
    { key: 'dpi', label: 'Dots per inch (0 for 150)', kind: 'number', min: 0, max: 300 },
    ...RANGE,
  ],
  options: z.object({
    format: z.enum(['png', 'jpeg']).default('png'),
    dpi: z
      .number()
      .int()
      .min(0)
      .max(300)
      .default(0)
      .transform((n) => (n ? Math.max(n, 36) : 150)),
    ...range,
  }),
  needs: ['pdftoppm'],
  needsSandbox: true,
  async run({ inputs, dir, options, exec }) {
    const { format, dpi, from, to } = options
    checkRange(from, to)
    const pick = (from ? ['-f', String(from)] : []).concat(to ? ['-l', String(to)] : [])
    await exec(
      'pdftoppm',
      [`-${format}`, '-r', String(dpi)].concat(pick, inputs[0], join(dir, 'out', stem(inputs[0]))),
    )
    return readdir(join(dir, 'out'))
  },
})

export const pdfToText = defineTool<Record<string, never>>({
  id: 'pdf-to-text',
  title: 'Text from a PDF',
  description: 'The text of a PDF as a plain text file, laid out as on the page.',
  group: 'pdf',
  action: 'Get the text',
  accepts: ['pdf'],
  maxFiles: 10,
  fields: [],
  options: z.object({}),
  needs: ['pdftotext'],
  needsSandbox: true,
  note: 'Scanned pages are pictures of text, so they come out empty.',
  async run({ inputs, dir, exec }) {
    const outs = []
    for (const input of inputs) {
      const out = `${stem(input)}.txt`
      await exec('pdftotext', ['-layout', '-enc', 'UTF-8', input, join(dir, 'out', out)])
      outs.push(out)
    }
    return outs
  },
})

// ─── Signing ──────────────────────────────────────────────────────────────────

/** The PDF and the one other file a signing tool takes, whichever order they came in. */
function pair(inputs: string[], other: string[], what: string) {
  const pdf = inputs.filter((p) => p.endsWith('.pdf'))
  const rest = inputs.filter((p) => other.some((k) => p.endsWith(`.${k}`)))
  if (pdf.length !== 1 || rest.length !== 1) throw new Error(`add one PDF and ${what}`)
  return [pdf[0], rest[0]] as const
}

/** Signing reads the whole PDF into memory, so it takes smaller files than the programs do. */
const SIGN_MAX = 50 * 1024 * 1024
const CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const

/** Signing runs in a worker, so the job's time limit stops it; the files stay in the job's folder. */
async function signed(job: PdfJob, signal: AbortSignal) {
  await runPdfJob(job, signal)
  return [basename(job.out)]
}

export const pdfSignVisual = defineTool<{ page: number; corner: Corner; width: number }>({
  id: 'pdf-sign',
  title: 'Sign a PDF',
  description: 'Put a picture of your signature on a page.',
  group: 'pdf',
  action: 'Sign',
  accepts: ['pdf', 'png', 'jpg'],
  maxSize: SIGN_MAX,
  minFiles: 2,
  maxFiles: 2,
  fields: [
    {
      key: 'corner',
      label: 'Where',
      kind: 'select',
      choices: [
        { value: 'bottom-right', label: 'Bottom right' },
        { value: 'bottom-left', label: 'Bottom left' },
        { value: 'top-right', label: 'Top right' },
        { value: 'top-left', label: 'Top left' },
      ],
    },
    { key: 'page', label: 'Page (0 for the last)', kind: 'number', min: 0 },
    { key: 'width', label: 'Width in points (0 for 150)', kind: 'number', min: 0, max: 600 },
  ],
  options: z.object({
    corner: z.enum(CORNERS).default('bottom-right'),
    page: z.number().int().min(0).default(0),
    width: z
      .number()
      .min(0)
      .max(600)
      .default(0)
      .transform((n) => n || 150),
  }),
  needs: [],
  note: `Add the PDF and a PNG or JPG of your signature (a transparent PNG looks best). This is a picture, not a digital signature. ${RESIGN}`,
  async run({ inputs, dir, options, signal }) {
    const [pdf, picture] = pair(inputs, ['png', 'jpg'], 'one PNG or JPG of your signature')
    const out = join(dir, 'out', `${stem(pdf)}-signed.pdf`)
    return signed({ kind: 'visual', pdf, picture, out, ...options }, signal)
  },
})

export const pdfSignDigital = defineTool<{ password: string; reason: string }>({
  id: 'pdf-sign-digital',
  title: 'Digitally sign a PDF',
  description:
    'Sign with your certificate, so readers can check who signed it and that nothing changed since.',
  group: 'pdf',
  action: 'Sign',
  accepts: ['pdf', 'p12'],
  maxSize: SIGN_MAX,
  minFiles: 2,
  maxFiles: 2,
  fields: [
    { key: 'password', label: "Certificate's password", kind: 'text', secret: true },
    { key: 'reason', label: 'Reason (optional)', kind: 'text' },
  ],
  options: z.object({
    password: z.string().max(1024).default(''),
    reason: z.string().max(200).default(''),
  }),
  needs: [],
  note: `Add the PDF and your certificate (.p12 or .pfx). Uploads and the password are forgotten as soon as the job ends. ${RESIGN}`,
  async run({ inputs, dir, options, signal }) {
    const [pdf, p12] = pair(inputs, ['p12'], 'one certificate (.p12 or .pfx)')
    const out = join(dir, 'out', `${stem(pdf)}-signed.pdf`)
    return signed({ kind: 'digital', pdf, p12, out, ...options }, signal)
  },
})
