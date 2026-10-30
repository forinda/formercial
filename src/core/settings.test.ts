import { describe, expect, test } from 'vitest'
import { FormercialSettings, checkFps } from './settings'

const load = (env: Record<string, string>) => FormercialSettings.load(env as NodeJS.ProcessEnv)

describe('FormercialSettings', () => {
  test('has defaults for everything', () => {
    expect(load({})).toMatchObject({
      projects: 'projects',
      voice: 'en-US-AvaNeural',
      fps: 30,
      render: false,
    })
  })

  test('reads FORMERCIAL_* variables', () => {
    const s = load({
      FORMERCIAL_PROJECTS: '/work/ads',
      FORMERCIAL_TRUST_FILE: '/work/trust.json',
      FORMERCIAL_VOICE: 'en-GB-SoniaNeural',
      FORMERCIAL_FPS: '24',
      FORMERCIAL_RENDER: 'true',
    })
    expect(s).toEqual({
      projects: '/work/ads',
      trustFile: '/work/trust.json',
      voice: 'en-GB-SoniaNeural',
      fps: 24,
      render: true,
    })
  })

  test('a bad frame rate names the variable', () => {
    expect(() => load({ FORMERCIAL_FPS: 'abc' })).toThrow(/FORMERCIAL_FPS/)
    expect(() => load({ FORMERCIAL_FPS: '500' })).toThrow(/FORMERCIAL_FPS/)
  })

  test('lists its variables', () => {
    expect([...FormercialSettings.envNames].sort()).toEqual([
      'FORMERCIAL_FPS',
      'FORMERCIAL_PROJECTS',
      'FORMERCIAL_RENDER',
      'FORMERCIAL_TRUST_FILE',
      'FORMERCIAL_VOICE',
    ])
  })
})

describe('checkFps', () => {
  test('accepts whole numbers from 1 to 60', () => {
    expect(checkFps('24')).toBe(24)
    expect(checkFps(60)).toBe(60)
  })
  test('refuses anything else', () => {
    for (const v of [0, 61, 2.5, 'x', 'NaN']) expect(() => checkFps(v)).toThrow(/1 to 60/)
  })
})
