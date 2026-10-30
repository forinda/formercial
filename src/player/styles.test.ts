// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { PRESETS } from '@/presets'
import { fitOnce } from './blocks'
import { boxColors, contrast } from './styles'

const reads = (bg: string, fg: string) => {
  const { keyword, call, rendered } = boxColors(bg, fg)
  expect(contrast(keyword, rendered), `keyword on ${bg}`).toBeGreaterThanOrEqual(4.5)
  expect(contrast(call, rendered), `call on ${bg}`).toBeGreaterThanOrEqual(4.5)
}

describe('code colors', () => {
  test('read on the box itself, on every preset', () => {
    for (const p of PRESETS) reads(p.project.theme.colors.bg, p.project.theme.colors.fg)
  })

  test('read on any grey, with light or dark text', () => {
    for (let v = 0; v <= 255; v += 3) {
      const grey = `#${v.toString(16).padStart(2, '0').repeat(3)}`
      reads(grey, '#000000')
      reads(grey, '#ffffff')
    }
  })

  test('read on the awkward colors', () => {
    for (const bg of [
      '#d4d4d4',
      '#999999',
      '#7a7a7a',
      '#fff',
      '#000',
      '#2f6fed',
      '#f2c14e',
      '#d23f4f',
    ]) {
      reads(bg, '#111111')
      reads(bg, '#f5f5f5')
    }
  })

  test('dark themes keep the colors they always had', () => {
    expect(boxColors('#1d2b2a', '#f3f1e7')).toMatchObject({
      box: 'color-mix(in srgb, var(--bg) 80%, black)',
      keyword: '#c9a8ff',
      call: '#8ec5ff',
    })
  })

  test('a light theme gets a light box, not a grey one', () => {
    expect(boxColors('#f7f5ee', '#1e2a38').box).toContain('var(--fg)')
  })
})

describe('fitOnce', () => {
  test('keeps shrinking until a very long line fits', () => {
    const el = document.createElement('pre')
    el.style.fontSize = '40px'
    document.body.append(el)
    // A line 7 times too wide: more than the old limit of 16 steps could shrink.
    Object.defineProperty(el, 'clientWidth', { value: 100 })
    Object.defineProperty(el, 'scrollWidth', { get: () => parseFloat(el.style.fontSize) * 17.5 })
    fitOnce(el)()
    expect(el.scrollWidth).toBeLessThanOrEqual(101)
  })
})
