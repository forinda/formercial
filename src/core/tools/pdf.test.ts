// The PDF tools against the real programs, where this machine has them, and
// signing (pdf-lib, @signpdf) everywhere. Each tool runs as the job runner runs
// it, minus the sandbox: inputs in a folder of their own, outputs in out/.
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { describe, expect, test } from 'vitest'
import { hasCommand } from '@/core/media/media'
import { exec } from './exec'
import {
  pdfCompress,
  pdfMerge,
  pdfSignDigital,
  pdfSignVisual,
  pdfSplit,
  pdfToImages,
  pdfToText,
  place,
} from './pdf'
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

describe('visual signing', () => {
  test('puts the picture on the last page by default, whichever file came first', async () => {
    const { out, files } = await run(pdfSignVisual, [
      ['png', PNG],
      ['pdf', await makePdf(3)],
    ])
    expect(files).toEqual(['in-2-signed.pdf'])
    const doc = await PDFDocument.load(await readFile(join(out, files[0])))
    const images = (i: number) =>
      doc.getPage(i).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.keys().length ??
      0
    expect(images(2)).toBe(1)
    expect(images(0)).toBe(0)
  })

  test('needs one PDF and one picture, and a page that exists', async () => {
    await expect(
      run(pdfSignVisual, [
        ['pdf', await makePdf(1)],
        ['pdf', await makePdf(1)],
      ]),
    ).rejects.toThrow('add one PDF and one PNG or JPG')
    await expect(
      run(
        pdfSignVisual,
        [
          ['pdf', await makePdf(2)],
          ['png', PNG],
        ],
        { page: 5 },
      ),
    ).rejects.toThrow('it has only 2 pages')
  })

  test('corners sit half an inch in', () => {
    expect(place('bottom-right', 600, 800, 100, 50)).toEqual({ x: 464, y: 36 })
    expect(place('top-left', 600, 800, 100, 50)).toEqual({ x: 36, y: 714 })
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
