import { describe, expect, test } from 'vitest'
import { PRESETS } from '@/presets'
import { boxColors, luminance } from './styles'

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('code colors', () => {
  const themes = {
    paper: '#f7f5ee',
    white: '#ffffff',
    chalkboard: '#1d2b2a',
    black: '#000000',
    shorthand: '#fff',
    ...Object.fromEntries(PRESETS.map((p) => [p.id, p.project.theme.colors.bg])),
  }

  for (const [name, bg] of Object.entries(themes)) {
    test(`keywords and calls read clearly on ${name}`, () => {
      const { keyword, call } = boxColors(bg)
      // The box only shifts its background slightly, so this is a fair stand-in for it.
      expect(contrast(keyword, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(call, bg)).toBeGreaterThanOrEqual(4.5)
    })
  }

  test('dark themes keep the colors they always had', () => {
    expect(boxColors('#1d2b2a')).toEqual({
      box: 'color-mix(in srgb, var(--bg) 80%, black)',
      keyword: '#c9a8ff',
      call: '#8ec5ff',
    })
  })

  test('a light theme gets a light box, not a grey one', () => {
    expect(boxColors('#f7f5ee').box).toContain('var(--fg)')
  })
})
