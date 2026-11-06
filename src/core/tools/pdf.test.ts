// The PDF tools against the real programs, where this machine has them, and
// signing (pdf-lib, @signpdf) everywhere. Each tool runs as the job runner runs
// it, minus the sandbox: inputs in a folder of their own, outputs in out/.
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { degrees, PDFDocument, type PDFPage, StandardFonts } from 'pdf-lib'
import { describe, expect, test } from 'vitest'
import { hasCommand } from '@/core/media/media'
import { exec } from './exec'
import {
  pdfCompress,
  pdfMerge,
  pdfSignDigital,
  pdfWorkspaceSign,
  pdfSplit,
  pdfToImages,
  pdfToText,
} from './pdf'
import type { PdfJob } from './pdf-job'
import type { Box, SignItem } from './sign-items'
import { runPdfJob } from './pdf-worker'
import { sniff } from './sniff'
import type { AnyTool } from './tool'

/** A PDF of `n` pages, each saying which page it is (and which document). */
async function makePdf(n: number, label = 'Doc') {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++)
    doc.addPage([300, 400]).drawText(`${label} page ${i}`, { x: 40, y: 300, size: 18, font })
  return doc.save()
}

// A 1×1 red PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

/** Run a tool on these files (named by kind, as the runner names them); returns its out/ folder. */
async function run(tool: AnyTool, files: [kind: string, bytes: Uint8Array][], options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-tools-'))
  await mkdir(join(dir, 'out'))
  const inputs = []
  for (const [i, [kind, bytes]] of files.entries()) {
    const path = join(dir, `in-${i + 1}.${kind}`)
    await writeFile(path, bytes)
    inputs.push(path)
  }
  await tool.run({
    inputs,
    dir,
    options: tool.options.parse(options),
    signal: AbortSignal.timeout(60_000),
    exec: (cmd, args) => exec(cmd, args, { cwd: dir }),
  })
  const out = join(dir, 'out')
  return { out, files: (await readdir(out)).sort() }
}

const pageCount = async (path: string) =>
  (await PDFDocument.load(await readFile(path))).getPageCount()

const hasGs = await hasCommand('gs', ['--version'])
const hasPoppler = await hasCommand('pdftoppm', ['-v'])
const hasOpenssl = await hasCommand('openssl', ['version'])

describe.runIf(hasGs)('Ghostscript', () => {
  test('merges in the order given', async () => {
    const { out, files } = await run(pdfMerge, [
      ['pdf', await makePdf(2, 'First')],
      ['pdf', await makePdf(3, 'Second')],
    ])
    expect(files).toEqual(['in-1-merged.pdf'])
    expect(await pageCount(join(out, files[0]))).toBe(5)
  }, 60_000)

  test('splits each page out, named by the page it was', async () => {
    const { files } = await run(pdfSplit, [['pdf', await makePdf(4)]], { from: 2, to: 3 })
    expect(files).toEqual(['in-1-p0002.pdf', 'in-1-p0003.pdf'])
  }, 60_000)

  test('takes a range out as one PDF', async () => {
    const { out, files } = await run(pdfSplit, [['pdf', await makePdf(4)]], {
      mode: 'range',
      from: 3,
    })
    expect(files).toEqual(['in-1-pages.pdf'])
    expect(await pageCount(join(out, files[0]))).toBe(2)
  }, 60_000)

  test('refuses a range that runs backwards', async () => {
    await expect(run(pdfSplit, [['pdf', await makePdf(4)]], { from: 3, to: 2 })).rejects.toThrow(
      'the first page is after the last one',
    )
  })

  test('compresses to a PDF', async () => {
    const { out, files } = await run(pdfCompress, [['pdf', await makePdf(2)]], {
      quality: 'screen',
    })
    expect(sniff(await readFile(join(out, files[0])))).toBe('pdf')
  }, 60_000)
})

describe.runIf(hasPoppler)('Poppler', () => {
  test('pages become pictures', async () => {
    const { files } = await run(pdfToImages, [['pdf', await makePdf(3)]], { to: 2, dpi: 50 })
    expect(files).toEqual(['in-1-1.png', 'in-1-2.png'])
  }, 60_000)

  test('text comes out', async () => {
    const { out, files } = await run(pdfToText, [['pdf', await makePdf(2, 'Hello')]])
    expect(await readFile(join(out, files[0]), 'utf8')).toContain('Hello page 2')
  }, 60_000)
})

/**
 * Where the ink is on a page, as a box in fractions of the page as seen (rotation
 * and crop box applied, as pdftoppm draws it), or null for a blank page.
 */
async function inkBox(pdf: string, page: number) {
  const base = join(await mkdtemp(join(tmpdir(), 'ink-')), 'p')
  await exec('pdftoppm', [
    '-r',
    '36',
    '-gray',
    // What readers see: the crop box, not the whole sheet.
    '-cropbox',
    '-f',
    String(page),
    '-l',
    String(page),
    '-singlefile',
    pdf,
    base,
  ])
  const pgm = await readFile(`${base}.pgm`)
  // P5 header: "P5\n<w> <h>\n255\n", then one byte per pixel.
  const [, w, h] = /^P5\s+(\d+)\s+(\d+)\s+255\s/
    .exec(pgm.subarray(0, 40).toString('latin1'))!
    .map(Number)
  const data = pgm.subarray(pgm.length - w * h)
  let [x0, y0, x1, y1] = [w, h, -1, -1]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[y * w + x] < 128) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x + 1)
        y1 = Math.max(y1, y + 1)
      }
  return x1 < 0 ? null : { x: x0 / w, y: y0 / h, w: (x1 - x0) / w, h: (y1 - y0) / h }
}

const near = (got: Box | null, want: Box) => {
  expect(got).not.toBeNull()
  for (const k of ['x', 'y', 'w', 'h'] as const)
    expect(Math.abs(got![k] - want[k])).toBeLessThan(0.03)
}

/** A blank PDF of `n` 300×400 pages, each changed by `edit` if given. */
async function blankPdf(n: number, edit?: (page: PDFPage) => void) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) {
    const page = doc.addPage([300, 400])
    edit?.(page)
  }
  return doc.save()
}

const stamp = (
  pdf: Uint8Array,
  items: SignItem[],
  extra: [string, Uint8Array][] = [['png', PNG]],
) => run(pdfWorkspaceSign, [['pdf', pdf], ...extra], { items })

const sig = (box: Box, pages = [1]): SignItem => ({ kind: 'picture', pages, box, picture: 0 })

describe.runIf(hasPoppler)('signing workspace', () => {
  const box = { x: 0.6, y: 0.8, w: 0.3, h: 0.1 }

  test('stamps a picture where it was placed', async () => {
    const { out, files } = await stamp(await blankPdf(3), [sig(box, [2])])
    expect(files).toEqual(['in-1-signed.pdf'])
    const signed = join(out, files[0])
    near(await inkBox(signed, 2), box)
    expect(await inkBox(signed, 1)).toBeNull()
    expect(await inkBox(signed, 3)).toBeNull()
  }, 60_000)

  test.each([90, 180, 270])(
    'stamps the right spot on a page rotated %i°',
    async (angle) => {
      const { out, files } = await stamp(await blankPdf(1, (p) => p.setRotation(degrees(angle))), [
        sig(box),
      ])
      near(await inkBox(join(out, files[0]), 1), box)
    },
    60_000,
  )

  test('stamps relative to the crop box', async () => {
    const { out, files } = await stamp(await blankPdf(1, (p) => p.setCropBox(50, 50, 200, 300)), [
      sig(box),
    ])
    near(await inkBox(join(out, files[0]), 1), box)
  }, 60_000)

  test('text becomes real text', async () => {
    const date: SignItem = {
      kind: 'text',
      pages: [1],
      box: { x: 0.1, y: 0.1, w: 0.5, h: 0.05 },
      text: '6 Nov 2026',
      size: 12,
      color: 'blue',
    }
    const { out, files } = await stamp(await blankPdf(1), [date], [])
    const text = join(out, 'text.txt')
    await exec('pdftotext', [join(out, files[0]), text])
    expect(await readFile(text, 'utf8')).toContain('6 Nov 2026')
  }, 60_000)

  test('a tick is drawn in its box', async () => {
    const tick: SignItem = {
      kind: 'tick',
      pages: [1],
      box: { x: 0.2, y: 0.2, w: 0.1, h: 0.075 },
      color: 'black',
    }
    const { out, files } = await stamp(await blankPdf(1), [tick], [])
    const ink = await inkBox(join(out, files[0]), 1)
    expect(ink!.x).toBeGreaterThanOrEqual(0.19)
    expect(ink!.x + ink!.w).toBeLessThanOrEqual(0.31)
  }, 60_000)

  test('one item on several pages appears on each', async () => {
    const { out, files } = await stamp(await blankPdf(3), [sig(box, [1, 2, 3])])
    for (const page of [1, 2, 3]) near(await inkBox(join(out, files[0]), page), box)
  }, 60_000)

  test("refuses a page past the end, and items the browser shouldn't have sent", async () => {
    await expect(stamp(await blankPdf(2), [sig(box, [3])])).rejects.toThrow('it has only 2 pages')
    await expect(stamp(await blankPdf(2), [sig({ ...box, x: 0.9 })])).rejects.toThrow(
      'an item runs off the page',
    )
    await expect(stamp(await blankPdf(2), [sig(box)], [])).rejects.toThrow(
      'a signature picture is missing',
    )
    await expect(
      run(
        pdfWorkspaceSign,
        [
          ['pdf', await blankPdf(1)],
          ['pdf', await blankPdf(1)],
        ],
        { items: [] },
      ),
    ).rejects.toThrow('add one PDF, your signature pictures, and at most one certificate')
  }, 60_000)

  test('a job past its time limit is stopped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pdf-worker-'))
    await writeFile(join(dir, 'a.pdf'), await blankPdf(1))
    const job: PdfJob = {
      kind: 'stamp',
      pdf: join(dir, 'a.pdf'),
      pictures: [],
      items: [],
      out: join(dir, 'b.pdf'),
    }
    await expect(runPdfJob(job, AbortSignal.timeout(1))).rejects.toThrow(
      'it took too long, so it was stopped',
    )
  })
})

describe.runIf(hasOpenssl)('digital signing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'p12-'))
  const at = (f: string) => join(dir, f)
  await exec('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=Formercial Test',
    '-keyout',
    at('k.pem'),
    '-out',
    at('c.pem'),
  ])
  const p12 = async (name: string, extra: string[] = []) => {
    const args = ['pkcs12', '-export', '-inkey', at('k.pem'), '-in', at('c.pem')]
    await exec('openssl', args.concat('-out', at(name), '-passout', 'pass:secret', extra))
    return readFile(at(name))
  }
  // OpenSSL 3's default (AES, PBKDF2), and the older kind many exports still make.
  const modern = await p12('modern.p12')
  const legacy = await p12('legacy.p12', [
    '-keypbe',
    'PBE-SHA1-3DES',
    '-certpbe',
    'PBE-SHA1-3DES',
    '-macalg',
    'sha1',
  ])

  test('certificates are recognised by their contents', () => {
    expect(sniff(modern)).toBe('p12')
    expect(sniff(legacy)).toBe('p12')
  })

  test.each([
    ['modern', modern],
    ['legacy', legacy],
  ])(
    'signs with a %s certificate',
    async (_, cert) => {
      const { out, files } = await run(
        pdfSignDigital,
        [
          ['pdf', await makePdf(1)],
          ['p12', cert],
        ],
        { password: 'secret', reason: 'Approved' },
      )
      expect(files).toEqual(['in-1-signed.pdf'])
      const signed = join(out, files[0])
      expect((await readFile(signed)).includes('/ByteRange')).toBe(true)
      if (await hasCommand('pdfsig', ['-v'])) {
        const report = await exec('pdfsig', [signed]).catch((e: Error) => e.message)
        expect(report).toContain('Formercial Test')
        expect(report).toContain('Signature is Valid')
      }
    },
    60_000,
  )

  test.runIf(hasPoppler)(
    'signs after stamping when a certificate is added',
    async () => {
      const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.1 }
      const { out, files } = await run(
        pdfWorkspaceSign,
        [
          ['pdf', await blankPdf(1)],
          ['png', PNG],
          ['p12', legacy],
        ],
        { items: [sig(box)], password: 'secret' },
      )
      const signed = join(out, files[0])
      near(await inkBox(signed, 1), box)
      const report = await exec('pdfsig', [signed]).catch((e: Error) => e.message)
      expect(report).toContain('Signature is Valid')
    },
    60_000,
  )

  test('a wrong password says so', async () => {
    await expect(
      run(
        pdfSignDigital,
        [
          ['pdf', await makePdf(1)],
          ['p12', legacy],
        ],
        { password: 'nope' },
      ),
    ).rejects.toThrow("that isn't the certificate's password")
  })
})
