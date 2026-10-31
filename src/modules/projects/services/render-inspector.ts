// The render queue as DevTools' Jobs tab reads it.
import type { JobDetail, JobInspector, JobState, JobSummary } from '@forinda/kickjs-devtools-kit'
import type { JobInfo, RenderQueue } from './render-queue'

const QUEUE = 'renders'
const STATES: Record<JobInfo['state'], JobState> = {
  queued: 'waiting',
  running: 'active',
  done: 'completed',
  failed: 'failed',
}

const summary = (job: JobInfo): JobSummary => ({
  id: job.id,
  name: `${job.slug} ${job.format}`,
  state: STATES[job.state],
  attempts: job.state === 'queued' ? 0 : 1,
  createdAt: job.createdAt,
  finishedAt: job.finishedAt,
  failedReason: job.error,
})

export function renderInspector(queue: RenderQueue): JobInspector {
  return {
    async queues() {
      const counts: Partial<Record<JobState, number>> = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }
      for (const job of queue.jobs) counts[STATES[job.state]]! += 1
      return [{ name: QUEUE, counts }]
    },
    async jobs(_queue, state, { start, end }) {
      return queue.jobs
        .filter((job) => STATES[job.state] === state)
        .reverse()
        .slice(start, end + 1)
        .map(summary)
    },
    async job(_queue, id): Promise<JobDetail | null> {
      const job = queue.jobs.find((j) => j.id === id)
      if (!job) return null
      return {
        ...summary(job),
        data: { slug: job.slug, format: job.format, driver: job.driver },
        result: job.mp4,
        progress: job.progress,
      }
    },
  }
}
