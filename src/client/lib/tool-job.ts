// Running a utility from the browser: make the job, send its files, start it,
// and wait for it to finish. Used by the utility pages and the signing workspace.
import { useEffect, useState } from 'react'
import { api } from '@/client/editor/useProject'

export type Job = {
  id: string
  state: 'waiting' | 'queued' | 'running' | 'done' | 'failed'
  outputs: { file: string; name: string }[]
  /** What the server did with the outputs, for a tool that keeps them (signing: the version). */
  result?: { version?: number }
  error?: string
}

/**
 * Makes the job, sends the files in order, and starts it; `step` hears what
 * it's doing. `bind` runs once the job exists, before anything is sent.
 */
export async function startJob(
  tool: string,
  options: unknown,
  files: { name: string; body: Blob }[],
  step: (words: string) => void = () => {},
  bind?: (id: string) => Promise<unknown>,
): Promise<Job> {
  step('Starting…')
  const made = await api<Job>(`/api/v1/tools/${tool}/jobs`, { method: 'POST', json: { options } })
  try {
    await bind?.(made.id)
    for (const [i, file] of files.entries()) {
      step(`Sending ${files.length > 1 ? `file ${i + 1} of ${files.length}` : 'the file'}…`)
      await api(`/api/v1/tools/jobs/${made.id}/files?name=${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        body: file.body,
      })
    }
    return await api<Job>(`/api/v1/tools/jobs/${made.id}/start`, { method: 'POST' })
  } catch (err) {
    // Given up part way: let the job go rather than leave it taking a place.
    void api(`/api/v1/tools/jobs/${made.id}`, { method: 'DELETE' }).catch(() => {})
    throw err
  }
}

export const jobStatus = (id: string) => api<Job>(`/api/v1/tools/jobs/${id}`)

export const isWorking = (job: Job | null) => job?.state === 'queued' || job?.state === 'running'

/** Where one of a job's outputs downloads from. */
export const outputUrl = (job: Job, file: string) =>
  `/api/v1/tools/jobs/${job.id}/files/${encodeURIComponent(file)}`

/** One job at a time for a page: run it, and follow it until it's done. */
export function useToolJob(tool: string) {
  const [job, setJob] = useState<Job | null>(null)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job || !isWorking(job)) return
    const timer = setTimeout(() => jobStatus(job.id).then(setJob, (e) => setError(e.message)), 1000)
    return () => clearTimeout(timer)
  }, [job])

  async function run(
    options: unknown,
    files: { name: string; body: Blob }[],
    bind?: (id: string) => Promise<unknown>,
  ) {
    setError('')
    setJob(null)
    try {
      setJob(await startJob(tool, options, files, setStep, bind))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStep('')
    }
  }

  const reset = () => {
    setJob(null)
    setError('')
  }
  return { job, step, error, busy: !!step || isWorking(job), run, reset }
}
