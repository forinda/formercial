import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { memoryStorage } from '@forinda/kickjs-storage'
import { describe, expect, test } from 'vitest'
import { probeSeconds } from '@/core/media'
import { parseProject, starterProject, type Project } from '@/core/project'
import { createWorkspace } from '@/core/workspace'
import type { VoiceProvider } from './provider'
import { clipLengths, voiceProject } from './voice-project'

const silence = (file: string, seconds = 1) => {
  mkdirSync(dirname(file), { recursive: true })
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-t',
    String(seconds),
    file,
  ])
}

function fake() {
  const calls: string[] = []
  const provider: VoiceProvider = {
    name: 'fake',
    check: async () => ({ ok: true, missing: [] }),
    async speak(text, _opts, outFile) {
      calls.push(text)
      silence(outFile)
    },
  }
  return { provider, calls }
}

const project = (scenes: unknown[]): Project => parseProject({ ...starterProject('V'), scenes })
const scene = (id: string, caption: string, extra = {}) => ({
  id,
  kind: 'blocks',
  blocks: [],
  caption,
  ...extra,
})

async function setup(p: Project) {
  const ws = createWorkspace(memoryStorage())
  await ws.write('demo', p, null)
  return ws
}

// Each test runs ffmpeg several times; slow machines need more than 5s.
describe('voiceProject', { timeout: 20_000 }, () => {
  test('generates missing clips and stamps them', async () => {
    const ws = await setup(project([scene('a', 'Hello'), scene('b', 'World')]))
    const { provider, calls } = fake()
    const clips = await voiceProject(ws, 'demo', provider)
    expect(calls).toEqual(['Hello', 'World'])
    expect(clips.a?.path).toBe('voice/a.tts.mp3')
    expect(clips.a?.seconds).toBeCloseTo(1, 1)
    expect(await ws.stat('demo', 'voice/.made.json')).not.toBeNull()
  })

  test('reuses a clip when line, voice and rate are unchanged', async () => {
    const ws = await setup(project([scene('a', 'Hello')]))
    const { provider, calls } = fake()
    await voiceProject(ws, 'demo', provider)
    await voiceProject(ws, 'demo', provider)
    expect(calls).toHaveLength(1)
  })

  test('regenerates when the spoken line changes', async () => {
    const ws = await setup(project([scene('a', 'Hello')]))
    const { provider, calls } = fake()
    await voiceProject(ws, 'demo', provider)
    const { version } = await ws.read('demo')
    await ws.write('demo', project([scene('a', 'Hello', { spoken: 'Hello there' })]), version)
    await voiceProject(ws, 'demo', provider)
    expect(calls).toEqual(['Hello', 'Hello there'])
  })

  test("a recording wins over tts for voice: 'recording'", async () => {
    const ws = await setup(project([scene('a', 'Hello', { voice: 'recording' })]))
    const tmp = `${process.env.TMPDIR ?? '/tmp'}/cxc-rec-${process.pid}.webm`
    silence(tmp, 2)
    await ws.putFile('demo', 'voice/a.rec.webm', (await import('node:fs')).readFileSync(tmp))
    const { provider, calls } = fake()
    const clips = await voiceProject(ws, 'demo', provider)
    expect(calls).toEqual([])
    expect(clips.a?.path).toBe('voice/a.rec.webm')
    expect(clips.a?.seconds).toBeCloseTo(2, 1)
  })

  test('skips empty spoken lines', async () => {
    const ws = await setup(project([scene('a', 'Shown', { spoken: '   ' })]))
    const { provider, calls } = fake()
    const clips = await voiceProject(ws, 'demo', provider)
    expect(calls).toEqual([])
    expect(clips.a).toBeUndefined()
  })

  test('only voices the scene asked for', async () => {
    const ws = await setup(project([scene('a', 'Hello'), scene('b', 'World')]))
    const { provider, calls } = fake()
    await voiceProject(ws, 'demo', provider, { only: 'b' })
    expect(calls).toEqual(['World'])
  })

  test('clipLengths reports made clips without generating', async () => {
    const p = project([scene('a', 'Hello'), scene('b', 'World')])
    const ws = await setup(p)
    const { provider, calls } = fake()
    await voiceProject(ws, 'demo', provider, { only: 'a' })
    const lengths = await clipLengths(ws, 'demo', p)
    expect(calls).toHaveLength(1)
    expect(lengths.a?.seconds).toBeCloseTo(1, 1)
    expect(lengths.b).toBeUndefined()
  })
})

describe('probeSeconds', () => {
  test('probeSeconds reads a 1s clip as ~1', async () => {
    const tmp = `${process.env.TMPDIR ?? '/tmp'}/cxc-probe-${process.pid}.mp3`
    silence(tmp)
    expect(await probeSeconds(tmp)).toBeCloseTo(1, 1)
  })
})
