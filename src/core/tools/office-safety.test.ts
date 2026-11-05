// A document that links a picture on this machine and one on a web server must
// not get either into its PDF, nor make the server fetch anything: with the safe
// profile alone, and with the sandbox alone. A control run with neither shows the
// test document really does reach out.
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32 } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { hasCommand } from '@/core/media/media'
import { SAFE_PROFILE } from './converters'
import { exec } from './exec'
import { canSandbox, sandboxed } from './sandbox'

// A 1×1 red PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

const fodt = (local: string, web: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:body><office:text>
<text:p>Before.</text:p>
<text:p><draw:frame svg:width="3cm" svg:height="3cm"><draw:image xlink:href="${local}" xlink:type="simple"/></draw:frame><draw:frame svg:width="3cm" svg:height="3cm"><draw:image xlink:href="${web}" xlink:type="simple"/></draw:frame></text:p>
<text:p>After.</text:p>
</office:text></office:body></office:document>
`

const fodtWith = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:body><office:text><text:p>Before.</text:p>${inner}<text:p>After.</text:p></office:text></office:body></office:document>
`

const cell = (shown: string, formula?: string) =>
  `<table:table-cell${formula ? ` table:formula="${formula}"` : ''} office:value-type="string"><text:p>${shown}</text:p></table:table-cell>`

const fods = (cells: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
<office:body><office:spreadsheet><table:table table:name="Sheet1"><table:table-row>${cells}</table:table-row></table:table></office:spreadsheet></office:body></office:document>
`

/** A ZIP of these files, stored uncompressed: enough for a test .xlsx. */
function zip(files: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text)
    const crc = crc32(data)
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(20, 4)
    head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(data.length, 18)
    head.writeUInt32LE(data.length, 22)
    head.writeUInt16LE(Buffer.byteLength(name), 26)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(Buffer.byteLength(name), 28)
    entry.writeUInt32LE(offset, 42)
    parts.push(head, Buffer.from(name), data)
    central.push(entry, Buffer.from(name))
    offset += head.length + Buffer.byteLength(name) + data.length
  }
  const dir = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(central.length / 2, 8)
  end.writeUInt16LE(central.length / 2, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, dir, end])
}

/** An Excel workbook with one row of cells, given as sheet XML. */
const xlsx = (cells: string) =>
  zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`,
  })

const images = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length

const hasSoffice = await hasCommand('soffice', ['--version'])
const hasBwrap = hasSoffice && (await canSandbox())
const hasPdftotext = hasSoffice && (await hasCommand('pdftotext', ['-v']))

describe.runIf(hasSoffice)('LibreOffice on untrusted documents', () => {
  let root = ''
  let fetched = 0
  let web = ''
  const server = createServer((_req, res) => {
    fetched++
    res.writeHead(200, { 'content-type': 'image/png' }).end(PNG)
  })

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'office-safety-'))
    await mkdir(join(root, 'outside'))
    await writeFile(join(root, 'outside', 'secret.png'), PNG)
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    web = `http://127.0.0.1:${(server.address() as AddressInfo).port}/secret.png`
  })
  afterAll(() => new Promise((r) => server.close(r)))

  /** Convert the test document in a fresh job folder: its PDF, and how many fetches it caused. */
  async function convert(
    how: { profile: boolean; sandbox: boolean },
    doc: { name: string; body: string | Buffer } = {
      name: 'in-1.fodt',
      body: fodt(`file://${join(root, 'outside', 'secret.png')}`, web),
    },
  ) {
    const dir = await mkdtemp(join(root, 'job-'))
    await mkdir(join(dir, 'out'))
    const input = join(dir, doc.name)
    await writeFile(input, doc.body)
    const profile = join(dir, 'lo-profile')
    if (how.profile) {
      await mkdir(join(profile, 'user'), { recursive: true })
      await writeFile(join(profile, 'user', 'registrymodifications.xcu'), SAFE_PROFILE)
    }
    const args = [
      `-env:UserInstallation=file://${profile}`,
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nologo',
      '--nodefault',
      '--convert-to',
      'pdf',
      '--outdir',
      join(dir, 'out'),
      input,
    ]
    const [cmd, argv] = how.sandbox ? await sandboxed('soffice', args, dir) : ['soffice', args]
    const before = fetched
    await exec(cmd, argv, { cwd: dir })
    const [name] = await readdir(join(dir, 'out'))
    return { pdf: await readFile(join(dir, 'out', name)), fetches: fetched - before }
  }

  test('the test document does reach out when nothing stops it', async () => {
    const { pdf, fetches } = await convert({ profile: false, sandbox: false })
    expect(images(pdf)).toBeGreaterThan(0)
    expect(fetches).toBeGreaterThan(0)
  }, 120_000)

  test('the safe profile alone keeps it in', async () => {
    const { pdf, fetches } = await convert({ profile: true, sandbox: false })
    expect(images(pdf)).toBe(0)
    expect(fetches).toBe(0)
  }, 120_000)

  test.runIf(hasBwrap)(
    'the sandbox alone keeps it in',
    async () => {
      const { pdf, fetches } = await convert({ profile: false, sandbox: true })
      expect(images(pdf)).toBe(0)
      expect(fetches).toBe(0)
    },
    120_000,
  )

  /** The PDF's text, through pdftotext. */
  async function text(pdf: Buffer) {
    const file = join(await mkdtemp(join(root, 'text-')), 'out.pdf')
    await writeFile(file, pdf)
    return exec('pdftotext', [file, '-'])
  }

  test.runIf(hasPdftotext)(
    'a spreadsheet fetches nothing and pulls in no other workbook',
    async () => {
      const other = join(root, 'outside', 'other.fods')
      await writeFile(other, fods(cell('CALCSECRET-7')))
      const body = fods(
        cell('ws-cached', `of:=COM.MICROSOFT.WEBSERVICE(&quot;${web}&quot;)`) +
          cell('ref-cached', `of:=['file://${other}'#$Sheet1.A1]`),
      )
      const { pdf, fetches } = await convert(
        { profile: true, sandbox: false },
        { name: 'in-1.fods', body },
      )
      expect(fetches).toBe(0)
      expect(await text(pdf)).not.toContain('CALCSECRET')
    },
    120_000,
  )

  test.runIf(hasPdftotext)(
    'an Excel file saved with stale totals prints fresh ones',
    async () => {
      const body = xlsx(
        '<c r="A1"><v>3</v></c><c r="B1"><v>4</v></c><c r="C1"><f>A1+B1</f><v>99</v></c><c r="D1"><f>A1*B1</f></c>',
      )
      const { pdf } = await convert({ profile: true, sandbox: false }, { name: 'in-1.xlsx', body })
      const shown = await text(pdf)
      expect(shown).toMatch(/\b7\b/)
      expect(shown).toMatch(/\b12\b/)
      expect(shown).not.toContain('99')
    },
    120_000,
  )

  test.runIf(hasPdftotext)(
    'an Excel file recalculated on load still fetches nothing',
    async () => {
      const body = xlsx(`<c r="A1" t="str"><f>WEBSERVICE("${web}")</f><v>ws-cached</v></c>`)
      const { fetches } = await convert(
        { profile: true, sandbox: false },
        { name: 'in-1.xlsx', body },
      )
      expect(fetches).toBe(0)
    },
    120_000,
  )

  test.runIf(hasPdftotext)(
    'a text document pulls in no linked file',
    async () => {
      const secret = join(root, 'outside', 'secret.txt')
      await writeFile(secret, 'TEXTSECRET-42')
      const body = fodtWith(
        `<text:section text:name="S1"><text:section-source xlink:href="file://${secret}" xlink:type="simple" text:filter-name="Text"/><text:p>cached-section</text:p></text:section>`,
      )
      const { pdf, fetches } = await convert(
        { profile: true, sandbox: false },
        { name: 'in-1.fodt', body },
      )
      expect(fetches).toBe(0)
      expect(await text(pdf)).not.toContain('TEXTSECRET')
    },
    120_000,
  )
})
