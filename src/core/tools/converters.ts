// The converters: media through ffmpeg, office documents through LibreOffice,
// HTML through pandoc or Chromium. Each writes into `${dir}/out`.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { z } from 'zod'
import { launchChrome } from '@/core/render/cdp'
import { defineTool, type ToolRun } from './tool'

const stem = (path: string) => basename(path, extname(path))
const OFFICE = ['docx', 'odt', 'rtf', 'xlsx', 'ods', 'pptx', 'odp', 'ooxml']
const MEDIA = ['mp4', 'mov', 'webm', 'avi', 'mp3', 'wav', 'ogg', 'flac', 'gif']

// ─── Media ────────────────────────────────────────────────────────────────────

export const MEDIA_TARGETS = ['mp4', 'webm', 'mov', 'gif', 'mp3', 'wav', 'ogg'] as const
type MediaOptions = {
  to: (typeof MEDIA_TARGETS)[number]
  start: number
  length: number
  width: number
}

/** ffmpeg's arguments for one conversion. Local files only, so a crafted input can't fetch anything. */
export function mediaArgs(input: string, output: string, o: MediaOptions): string[] {
  const cut = [
    ...(o.start ? ['-ss', String(o.start)] : []),
    ...(o.length ? ['-t', String(o.length)] : []),
  ]
  const scale = o.width ? `scale=${o.width}:-2` : ''
  const video = (codec: string[]) => [...codec, ...(scale ? ['-vf', scale] : [])]
  const by: Record<MediaOptions['to'], string[]> = {
    mp4: video([
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
    ]),
    mov: video(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']),
    webm: video(['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-c:a', 'libopus']),
    gif: [
      '-an',
      '-vf',
      `fps=12,scale=${o.width || 480}:-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`,
      '-loop',
      '0',
    ],
    mp3: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'],
    wav: ['-vn', '-c:a', 'pcm_s16le'],
    ogg: ['-vn', '-c:a', 'libvorbis', '-q:a', '5'],
  }
  return [
    '-nostdin',
    '-hide_banner',
    '-v',
    'error',
    '-y',
    '-protocol_whitelist',
    'file',
    ...cut,
    '-i',
    input,
    ...by[o.to],
    output,
  ]
}

export const mediaConvert = defineTool<MediaOptions>({
  id: 'media-convert',
  title: 'Convert video or audio',
  description: 'Change a video or sound file to another format, cut a piece out, or resize it.',
  group: 'media',
  accepts: MEDIA,
  fields: [
    {
      key: 'to',
      label: 'Make it',
      kind: 'select',
      choices: [
        { value: 'mp4', label: 'MP4 video' },
        { value: 'webm', label: 'WebM video' },
        { value: 'mov', label: 'MOV video' },
        { value: 'gif', label: 'GIF' },
        { value: 'mp3', label: 'MP3 sound' },
        { value: 'wav', label: 'WAV sound' },
        { value: 'ogg', label: 'OGG sound' },
      ],
    },
    { key: 'start', label: 'Start at (seconds)', kind: 'number', min: 0, step: 0.1 },
    { key: 'length', label: 'Length (seconds, 0 for all)', kind: 'number', min: 0, step: 0.1 },
    { key: 'width', label: 'Width (pixels, 0 to keep)', kind: 'number', min: 0, max: 3840 },
  ],
  options: z.object({
    to: z.enum(MEDIA_TARGETS).default('mp4'),
    start: z.number().min(0).max(86_400).default(0),
    length: z.number().min(0).max(86_400).default(0),
    width: z.number().int().min(0).max(3840).default(0),
  }),
  needs: ['ffmpeg'],
  async run({ inputs, dir, options, exec }) {
    const out = `${stem(inputs[0])}.${options.to}`
    await exec('ffmpeg', mediaArgs(inputs[0], join(dir, 'out', out), options))
    return [out]
  },
})

// ─── Documents (LibreOffice) ──────────────────────────────────────────────────

const SCRIPTING = '/org.openoffice.Office.Common/Security/Scripting'

/**
 * Settings for LibreOffice's own profile, so a document can't reach outside
 * itself even where there is no sandbox: no linked pictures or sections from the
 * web or this machine, no macros, no OLE or DDE, and links never updated
 * (LibreOffice's "never": Writer 0, Calc 1).
 *
 * Formulas are always recalculated on load (0), so a spreadsheet saved with
 * stale or missing results still prints the right totals; formulas that reach
 * outside (WEBSERVICE, links to other workbooks) are refused by LibreOffice as
 * external content even then. Both tested in office-safety.test.ts.
 */
const SAFE_SETTINGS: [path: string, name: string, value: string][] = [
  [SCRIPTING, 'BlockUntrustedRefererLinks', 'true'],
  [SCRIPTING, 'DisableActiveContent', 'true'],
  [SCRIPTING, 'DisableMacrosExecution', 'true'],
  [SCRIPTING, 'MacroSecurityLevel', '3'],
  ['/org.openoffice.Office.Writer/Content/Update', 'Link', '0'],
  ['/org.openoffice.Office.Calc/Content/Update', 'Link', '1'],
  ['/org.openoffice.Office.Calc/Formula/Load', 'ODFRecalcMode', '0'],
  ['/org.openoffice.Office.Calc/Formula/Load', 'OOXMLRecalcMode', '0'],
]

export const SAFE_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${SAFE_SETTINGS.map(
  ([path, name, value]) =>
    `<item oor:path="${path}"><prop oor:name="${name}" oor:op="fuse"><value>${value}</value></prop></item>`,
).join('\n')}
</oor:items>
`

/** LibreOffice headless, with a safe profile of its own in the job's folder. */
async function soffice(job: ToolRun<unknown>, convertTo: string, infilter?: string) {
  const profile = join(job.dir, 'lo-profile')
  await mkdir(join(profile, 'user'), { recursive: true })
  await writeFile(join(profile, 'user', 'registrymodifications.xcu'), SAFE_PROFILE)
  await job.exec('soffice', [
    `-env:UserInstallation=file://${profile}`,
    '--headless',
    '--norestore',
    '--nolockcheck',
    '--nologo',
    '--nodefault',
    ...(infilter ? [`--infilter=${infilter}`] : []),
    '--convert-to',
    convertTo,
    '--outdir',
    join(job.dir, 'out'),
    ...job.inputs,
  ])
  return readdir(join(job.dir, 'out'))
}

export const officeToPdf = defineTool<Record<string, never>>({
  id: 'office-to-pdf',
  title: 'Office document to PDF',
  description: 'Word, Writer, Excel, Calc, PowerPoint or Impress files, and RTF, as PDF.',
  group: 'documents',
  accepts: OFFICE,
  maxFiles: 10,
  fields: [],
  options: z.object({}),
  needs: ['soffice'],
  needsSandbox: true,
  run: (job) => soffice(job, 'pdf'),
})

export const officeConvert = defineTool<{ to: 'docx' | 'odt' | 'rtf' }>({
  id: 'office-convert',
  title: 'Word, Writer or RTF',
  description: 'Turn a text document into Word (docx), Writer (odt) or RTF.',
  group: 'documents',
  accepts: ['docx', 'odt', 'rtf', 'ooxml'],
  maxFiles: 10,
  fields: [
    {
      key: 'to',
      label: 'Make it',
      kind: 'select',
      choices: [
        { value: 'docx', label: 'Word (docx)' },
        { value: 'odt', label: 'Writer (odt)' },
        { value: 'rtf', label: 'RTF' },
      ],
    },
  ],
  options: z.object({ to: z.enum(['docx', 'odt', 'rtf']).default('docx') }),
  needs: ['soffice'],
  needsSandbox: true,
  run: (job) => soffice(job, job.options.to),
})

export const pdfToWord = defineTool<Record<string, never>>({
  id: 'pdf-to-docx',
  title: 'PDF to Word',
  description: 'Turn a PDF back into an editable Word document.',
  group: 'documents',
  accepts: ['pdf'],
  fields: [],
  options: z.object({}),
  needs: ['soffice'],
  needsSandbox: true,
  note: 'Simple documents come out well; complex layouts, columns and scans lose their shape.',
  run: (job) => soffice(job, 'docx:MS Word 2007 XML', 'writer_pdf_import'),
})

// ─── HTML ─────────────────────────────────────────────────────────────────────

export const htmlToWord = defineTool<Record<string, never>>({
  id: 'html-to-docx',
  title: 'HTML to Word',
  description: 'A web page saved as HTML, as a Word document.',
  group: 'documents',
  accepts: ['html'],
  fields: [],
  options: z.object({}),
  needs: ['pandoc'],
  note: 'Pictures from the web are left out: only what is in the file is used.',
  async run({ inputs, dir, exec }) {
    const out = `${stem(inputs[0])}.docx`
    // --sandbox: pandoc reads only the input, and fetches nothing.
    await exec('pandoc', [
      '--sandbox',
      '-f',
      'html',
      '-t',
      'docx',
      inputs[0],
      '-o',
      join(dir, 'out', out),
    ])
    return [out]
  },
})

export const htmlToPdf = defineTool<{ paper: 'A4' | 'Letter' }>({
  id: 'html-to-pdf',
  title: 'HTML to PDF',
  description: 'A web page saved as HTML, printed to PDF.',
  group: 'documents',
  accepts: ['html'],
  fields: [
    {
      key: 'paper',
      label: 'Paper',
      kind: 'select',
      choices: [
        { value: 'A4', label: 'A4' },
        { value: 'Letter', label: 'US Letter' },
      ],
    },
  ],
  options: z.object({ paper: z.enum(['A4', 'Letter']).default('A4') }),
  needs: ['chromium'],
  note: 'Scripts are off and nothing is fetched from the web: only what is in the file prints.',
  async run({ inputs, dir, options, signal }) {
    const html = await readFile(inputs[0], 'utf8')
    // Every request goes to a closed port, this machine's included; file pages can't be reached.
    const page = await launchChrome({
      args: [
        '--proxy-server=127.0.0.1:9',
        '--proxy-bypass-list=<-loopback>',
        '--disable-extensions',
      ],
    })
    const close = () => page.close()
    signal.addEventListener('abort', close, { once: true })
    try {
      await page.send('Emulation.setScriptExecutionDisabled', { value: true })
      const { frameTree } = await page.send<{ frameTree: { frame: { id: string } } }>(
        'Page.getFrameTree',
      )
      await page.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
      const [w, h] = options.paper === 'A4' ? [8.27, 11.69] : [8.5, 11]
      const { data } = await page.send<{ data: string }>('Page.printToPDF', {
        printBackground: true,
        paperWidth: w,
        paperHeight: h,
      })
      const out = `${stem(inputs[0])}.pdf`
      await writeFile(join(dir, 'out', out), Buffer.from(data, 'base64'))
      return [out]
    } finally {
      signal.removeEventListener('abort', close)
      close()
    }
  },
})
