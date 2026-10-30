// Renders run one at a time, in order. Each job reports progress through
// `onChange` (the events stream).
import type { Format } from '../../core/project'
import type { RenderProgress } from '../../core/render/driver'

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
