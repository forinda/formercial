// PDF work done with pdf-lib and @signpdf, run in a worker thread so the job's
// time limit can stop it (see pdf-worker.ts). Node loads this file directly in
// the worker, so it imports packages only (no `@/` aliases, no relative files)
// and uses nothing type stripping can't run: no enums, no parameter properties.
import { readFile, writeFile } from 'node:fs/promises'
import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/** A signing workspace item; the same shape as SignItem in sign-items.ts (kept in step by a test). */
export type StampBox = { x: number; y: number; w: number; h: number }
export type StampItem =
  | { kind: 'picture'; pages: number[]; box: StampBox; picture: number }
  | {
      kind: 'text'
      pages: number[]
      box: StampBox
      text: string
      size: number
      color: 'black' | 'blue'
    }
  | { kind: 'tick'; pages: number[]; box: StampBox; color: 'black' | 'blue' }

export type PdfJob =
  | {
      kind: 'stamp'
      pdf: string
      pictures: string[]
      items: StampItem[]
      out: string
      sign?: { p12: string; password: string }
    }
  | { kind: 'digital'; pdf: string; p12: string; out: string; password: string; reason: string }

async function open(path: string) {
  try {
    return await PDFDocument.load(await readFile(path), { updateMetadata: false })
  } catch (err) {
    if ((err as Error).name === 'EncryptedPDFError')
      throw new Error('this PDF has a password; take it off first')
    throw err
  }
}

type Angle = 0 | 90 | 180 | 270

/**
 * Where a box placed on the page as seen (fractions, top-left origin) is drawn:
 * the corner pdf-lib draws from, the size, and the angle to draw at, so it shows
 * upright on a rotated page. Relative to the crop box, which is what readers see.
 */
export function toPdfBox(
  page: { rotation: Angle; crop: { x: number; y: number; width: number; height: number } },
  box: StampBox,
) {
  const { x: cx, y: cy, width: cw, height: ch } = page.crop
  const turned = page.rotation === 90 || page.rotation === 270
  const [W, H] = turned ? [ch, cw] : [cw, ch]
  const [dx, dy, w, h] = [box.x * W, box.y * H, box.w * W, box.h * H]
  const at: Record<Angle, [number, number]> = {
    0: [cx + dx, cy + ch - dy - h],
    90: [cx + dy + h, cy + dx],
    180: [cx + cw - dx, cy + dy + h],
    270: [cx + cw - dy - h, cy + ch - dx],
  }
  const [x, y] = at[page.rotation]
  return { x, y, width: w, height: h, rotate: page.rotation }
}

/** A point inside a drawn box (its own x across, y up), on the page. */
function within(b: ReturnType<typeof toPdfBox>, ox: number, oy: number) {
  const [ex, ey]: [number, number][] = {
    0: [
      [1, 0],
      [0, 1],
    ],
    90: [
      [0, 1],
      [-1, 0],
    ],
    180: [
      [-1, 0],
      [0, -1],
    ],
    270: [
      [0, -1],
      [1, 0],
    ],
  }[b.rotate] as [number, number][]
  return { x: b.x + ox * ex[0] + oy * ey[0], y: b.y + ox * ex[1] + oy * ey[1] }
}

const INK = { black: rgb(0, 0, 0), blue: rgb(0.1, 0.24, 0.56) }

async function stamp(job: Extract<PdfJob, { kind: 'stamp' }>) {
  const doc = await open(job.pdf)
  const pages = doc.getPages()
  for (const item of job.items)
    if (item.pages.some((p) => p > pages.length))
      throw new Error(`it has only ${pages.length} pages`)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pictures = await Promise.all(
    job.pictures.map(async (path) => {
      const bytes = await readFile(path)
      return path.endsWith('.png') ? doc.embedPng(bytes) : doc.embedJpg(bytes)
    }),
  )
  for (const item of job.items)
    for (const n of item.pages) {
      const page = pages[n - 1]
      const rotation = (((page.getRotation().angle % 360) + 360) % 360) as Angle
      const b = toPdfBox({ rotation, crop: page.getCropBox() }, item.box)
      const rotate = degrees(b.rotate)
      if (item.kind === 'picture') page.drawImage(pictures[item.picture], { ...b, rotate })
      else if (item.kind === 'text')
        // Baseline a little above the box's foot, as the browser shows it.
        page.drawText(item.text, {
          ...within(b, 0, Math.max(0, (b.height - item.size) / 2) + item.size * 0.2),
          size: item.size,
          font,
          color: INK[item.color],
          rotate,
          lineHeight: item.size * 1.2,
        })
      else {
        const [p, q, r] = [
          within(b, b.width * 0.1, b.height * 0.5),
          within(b, b.width * 0.4, b.height * 0.15),
          within(b, b.width * 0.9, b.height * 0.85),
        ]
        const thickness = Math.max(1, Math.min(b.width, b.height) * 0.1)
        page.drawLine({ start: p, end: q, thickness, color: INK[item.color] })
        page.drawLine({ start: q, end: r, thickness, color: INK[item.color] })
      }
    }
  if (!job.sign) return writeFile(job.out, await doc.save())
  await signInto(doc, job.sign.p12, job.sign.password, 'Signed', job.out)
}

/** Sign `doc` with a certificate and write it to `out`. */
async function signInto(
  doc: PDFDocument,
  p12: string,
  password: string,
  reason: string,
  out: string,
) {
  pdflibAddPlaceholder({ pdfDoc: doc, reason, contactInfo: '', name: '', location: '' })
  // The signature covers exact byte ranges, so the file is written without object streams.
  const unsigned = await doc.save({ useObjectStreams: false })
  const signer = new P12Signer(await readFile(p12), { passphrase: password })
  const signed = await new SignPdf().sign(unsigned, signer).catch((err: Error) => {
    throw new Error(
      /password|MAC/i.test(err.message) ? "that isn't the certificate's password" : err.message,
    )
  })
  await writeFile(out, signed)
}

async function digital(job: Extract<PdfJob, { kind: 'digital' }>) {
  await signInto(await open(job.pdf), job.p12, job.password, job.reason || 'Signed', job.out)
}

export function doPdfJob(job: PdfJob): Promise<void> {
  return job.kind === 'stamp' ? stamp(job) : digital(job)
}

// Only when started by runPdfJob: other worker threads (a test runner's, say) may load this file too.
const started = workerData as { pdfJob?: PdfJob } | null
if (!isMainThread && parentPort && started?.pdfJob) {
  const port = parentPort
  doPdfJob(started.pdfJob).then(
    () => port.postMessage({ ok: true }),
    (err: Error) => port.postMessage({ ok: false, message: err.message }),
  )
}
