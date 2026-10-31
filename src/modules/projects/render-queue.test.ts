import { expect, test } from 'vitest'
import { jobActivity, type JobInfo } from './render-queue'

const lines = () => {
  const out: string[] = []
  return {
    out,
    log: { info: (m: string) => out.push(m), error: (m: string) => out.push(`! ${m}`) },
  }
}
const job: JobInfo = { id: '1', slug: 'demo', format: '9:16', driver: 'x', state: 'running' }

test('logs the start, each 10% of frames once, and the end', () => {
  const { out, log } = lines()
  const activity = jobActivity(log)
  activity(job)
  for (let frame = 0; frame <= 100; frame += 4) {
    activity({ ...job, progress: { phase: 'frames', frame, frames: 100 } })
  }
  activity({ ...job, progress: { phase: 'audio' } })
  activity({ ...job, progress: { phase: 'audio' } })
  activity({ ...job, state: 'done', mp4: 'renders/a.mp4' })
  expect(out[0]).toBe('demo 9:16 started (x)')
  expect(out.filter((l) => l.includes('frames'))).toHaveLength(10)
  expect(out).toContain('demo 9:16 frames 10% (12/100)')
  expect(out.filter((l) => l.includes('audio'))).toEqual(['demo 9:16 mixing audio'])
  expect(out.at(-1)).toMatch(/^demo 9:16 done in \ds: renders\/a\.mp4$/)
})

test('logs a failure with its error', () => {
  const { out, log } = lines()
  const activity = jobActivity(log)
  activity(job)
  activity({ ...job, state: 'failed', error: 'no ffmpeg' })
  expect(out.at(-1)).toMatch(/^! demo 9:16 failed after \ds: no ffmpeg$/)
})
