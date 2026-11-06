// PDF work done with pdf-lib and @signpdf, run in a worker thread so the job's
// time limit can stop it (see pdf-worker.ts). Node loads this file directly in
// the worker, so it imports packages only (no `@/` aliases, no relative files)
// and uses nothing type stripping can't run: no enums, no parameter properties.
import { readFile, writeFile } from 'node:fs/promises'
import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { PDFDocument } from 'pdf-lib'

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export type PdfJob =
  | {
      kind: 'visual'
      pdf: string
      picture: string
      out: string
      page: number
      corner: Corner
      width: number
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

/** Where a picture w×h goes on a page W×H: in a corner, half an inch in. */
export function place(corner: Corner, W: number, H: number, w: number, h: number) {
  const m = 36
  return {
    x: corner.endsWith('left') ? m : W - w - m,
    y: corner.startsWith('top') ? H - h - m : m,
  }
}

async function visual(job: Extract<PdfJob, { kind: 'visual' }>) {
  const doc = await open(job.pdf)
  const bytes = await readFile(job.picture)
  const pic = job.picture.endsWith('.png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  const all = doc.getPages()
  const n = job.page || all.length
  if (n > all.length) throw new Error(`it has only ${all.length} pages`)
  const page = all[n - 1]
  const [W, H] = [page.getWidth(), page.getHeight()]
  const w = Math.min(job.width, W - 72)
  const h = (pic.height / pic.width) * w
  page.drawImage(pic, { ...place(job.corner, W, H, w, h), width: w, height: h })
  await writeFile(job.out, await doc.save())
}

async function digital(job: Extract<PdfJob, { kind: 'digital' }>) {
  const doc = await open(job.pdf)
  pdflibAddPlaceholder({
    pdfDoc: doc,
    reason: job.reason || 'Signed',
    contactInfo: '',
    name: '',
    location: '',
  })
  // The signature covers exact byte ranges, so the file is written without object streams.
  const unsigned = await doc.save({ useObjectStreams: false })
  const signer = new P12Signer(await readFile(job.p12), { passphrase: job.password })
  const signed = await new SignPdf().sign(unsigned, signer).catch((err: Error) => {
    throw new Error(
      /password|MAC/i.test(err.message) ? "that isn't the certificate's password" : err.message,
    )
  })
  await writeFile(job.out, signed)
}

export function doPdfJob(job: PdfJob): Promise<void> {
  return job.kind === 'visual' ? visual(job) : digital(job)
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
