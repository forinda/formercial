import { describe, expect, test } from 'vitest'
import type { RenderDriver } from './driver'
import { createRegistry, defineConfig, driverReport } from './registry'

const fakeDriver = (name: string, ok = true): RenderDriver => ({
  name,
  check: async () => ({ ok, missing: ok ? [] : ['ffmpeg'] }),
  render: async () => ({ mp4: 'a.mp4', srt: 'a.srt' }),
})

describe('registry', () => {
  test('built-in driver and voice are always present', () => {
    const reg = createRegistry(defineConfig({}))
    expect([...reg.drivers.keys()]).toEqual(['chromium-ffmpeg'])
    expect([...reg.voices.keys()]).toEqual(['edge-tts'])
  })

  test('config drivers are added', async () => {
    const reg = createRegistry(defineConfig({ drivers: [fakeDriver('farm', false)] }))
    expect([...reg.drivers.keys()]).toEqual(['chromium-ffmpeg', 'farm'])
    const report = await driverReport(reg)
    expect(report.find((r) => r.name === 'farm')).toEqual({
      name: 'farm',
      check: { ok: false, missing: ['ffmpeg'] },
    })
  })

  test('duplicate names throw', () => {
    expect(() => createRegistry({ drivers: [fakeDriver('chromium-ffmpeg')] })).toThrow(
      /chromium-ffmpeg/,
    )
  })
})
