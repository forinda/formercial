import { expect, test } from 'vitest'
import { renderInspector } from './render-inspector'
import { RenderQueue, jobActivity, type JobInfo } from './render-queue'

const lines = () => {
  const out: string[] = []
  return {
    out,
    log: { info: (m: string) => out.push(m), error: (m: string) => out.push(`! ${m}`) },
  }
}
const job: JobInfo = {
  id: '1',
  slug: 'demo',
  format: '9:16',
  driver: 'x',
  state: 'running',
  createdAt: 0,
}

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

const spec = { slug: 'demo', format: '9:16', driver: 'x' } as const
const untilAborted = (_job: JobInfo, _progress: unknown, signal: AbortSignal) =>
  new Promise<{ mp4: string }>((_ok, fail) => {
    signal.addEventListener('abort', () => fail(signal.reason))
  })

test('stop aborts the running render and fails the waiting ones', async () => {
  const queue = new RenderQueue(() => {})
  const running = queue.enqueue(spec, untilAborted)
  const waiting = queue.enqueue(spec, async () => ({ mp4: 'never.mp4' }))
  await queue.stop()
  const [a, b] = [running, waiting].map((j) => queue.jobs.find((x) => x.id === j.id)!)
  expect(a.state).toBe('failed')
  expect(a.error).toMatch(/server restarted/)
  expect(a.finishedAt).toEqual(expect.any(Number))
  expect(b.state).toBe('failed')
  expect(b.mp4).toBeUndefined()
})

test('stop with nothing running settles', async () => {
  await expect(new RenderQueue(() => {}).stop()).resolves.toBeUndefined()
})

test('the inspector lists jobs by state', async () => {
  const queue = new RenderQueue(() => {})
  queue.enqueue(spec, async () => ({ mp4: 'renders/a.mp4' }))
  await queue.stop()
  const stopped = queue.enqueue(spec, untilAborted)
  const inspector = renderInspector(queue)
  expect((await inspector.jobs('renders', 'active', { start: 0, end: 9 }))[0].id).toBe(stopped.id)
  await queue.stop()
  const [info] = await inspector.queues()
  expect(info).toMatchObject({ name: 'renders', counts: { completed: 1, failed: 1 } })
  const failed = await inspector.jobs('renders', 'failed', { start: 0, end: 9 })
  expect(failed.map((j) => j.id)).toEqual([stopped.id])
  expect((await inspector.job('renders', stopped.id))?.data).toMatchObject({ slug: 'demo' })
  expect(await inspector.job('renders', 'nope')).toBeNull()
})
