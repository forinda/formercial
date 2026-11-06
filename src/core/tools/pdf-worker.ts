// Runs a PDF job (pdf-job.ts) in a worker thread, so a slow or crafted PDF
// can't hold the server up: the worker is stopped when the job's time runs out.
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { PdfJob } from './pdf-job'

// ponytail: found from the project root, where the app runs; bundle the worker if that ever changes.
const PDF_JOB = resolve(process.cwd(), 'src/core/tools/pdf-job.ts')

export function runPdfJob(job: PdfJob, signal: AbortSignal): Promise<void> {
  return new Promise((done, fail) => {
    const worker = new Worker(PDF_JOB, {
      workerData: { pdfJob: job },
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    })
    const stop = () => {
      void worker.terminate()
      fail(new Error('it took too long, so it was stopped'))
    }
    if (signal.aborted) return stop()
    signal.addEventListener('abort', stop, { once: true })
    const end = (err?: Error) => {
      signal.removeEventListener('abort', stop)
      void worker.terminate()
      if (err) fail(err)
      else done()
    }
    worker.once('message', (m: { ok: boolean; message?: string }) =>
      end(m.ok ? undefined : new Error(m.message)),
    )
    worker.once('error', end)
    worker.once('exit', (code) => end(new Error(`it stopped unexpectedly (${code})`)))
  })
}
