// Renders run one at a time, in order. Each job reports progress through
// `onChange` (the events stream).
import type { Format } from '@/core/project/project'
import type { RenderProgress } from '@/core/render/driver'

export type JobState = 'queued' | 'running' | 'done' | 'failed'
export interface JobInfo {
  id: string
  slug: string
  format: Format
  driver: string
  state: JobState
  progress?: RenderProgress
  error?: string
  mp4?: string
}

const elapsed = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/** One console line per step of a job: its start, each 10% of frames, and how it ended. */
export function jobActivity(log: { info(msg: string): void; error(msg: string): void }) {
  const open = new Map<string, { started: number; step: number; audio: boolean }>()
  return (job: JobInfo) => {
    const name = `${job.slug} ${job.format}`
    let seen = open.get(job.id)
    if (!seen) {
      seen = { started: Date.now(), step: 0, audio: false }
      open.set(job.id, seen)
      log.info(`${name} started (${job.driver})`)
    }
    if (job.state === 'failed' || job.state === 'done') {
      open.delete(job.id)
      const took = elapsed(Date.now() - seen.started)
      if (job.state === 'failed') log.error(`${name} failed after ${took}: ${job.error}`)
      else log.info(`${name} done in ${took}: ${job.mp4}`)
      return
    }
    const { phase, frame, frames } = job.progress ?? {}
    if (phase === 'frames' && frame !== undefined && frames) {
      const step = Math.floor((frame / frames) * 10)
      if (step > seen.step) {
        seen.step = step
        log.info(`${name} frames ${step * 10}% (${frame}/${frames})`)
      }
    } else if (phase === 'audio' && !seen.audio) {
      seen.audio = true
      log.info(`${name} mixing audio`)
    }
  }
}

export class RenderQueue {
  readonly jobs: JobInfo[] = []
  private running = false
  private next = 1

  constructor(private readonly onChange: (job: JobInfo) => void) {}

  enqueue(
    spec: Pick<JobInfo, 'slug' | 'format' | 'driver'>,
    run: (job: JobInfo, progress: (p: RenderProgress) => void) => Promise<{ mp4: string }>,
  ): JobInfo {
    const job: JobInfo = { id: String(this.next++), ...spec, state: 'queued' }
    this.jobs.push(job)
    this.runs.set(job.id, run)
    this.pump()
    return { ...job }
  }

  private runs = new Map<string, Parameters<RenderQueue['enqueue']>[1]>()

  // Marks the next job running synchronously, so a caller sees its state at once.
  private pump() {
    if (this.running) return
    const job = this.jobs.find((j) => j.state === 'queued')
    if (!job) return
    this.running = true
    job.state = 'running'
    this.onChange(job)
    const run = this.runs.get(job.id)!
    run(job, (p) => {
      job.progress = p
      this.onChange(job)
    })
      .then(
        ({ mp4 }) => Object.assign(job, { state: 'done', mp4 }),
        (err: Error) => Object.assign(job, { state: 'failed', error: err.message }),
      )
      .finally(() => {
        this.runs.delete(job.id)
        this.running = false
        this.onChange(job)
        this.pump()
      })
  }
}
