import { describe, expect, test } from 'vitest'
import { MAX_CANVAS_PIXELS, drawScale } from './pdf'

describe('drawScale', () => {
  test('pixels per point as asked, on a sharp screen', () => {
    expect(drawScale({ width: 612, height: 792 }, 1.5, 2)).toBe(3)
  })

  test('zoomed far in, a page stays within what a browser will draw', () => {
    const page = { width: 612, height: 792 }
    const s = drawScale(page, 6, 3)
    expect(page.width * s * page.height * s).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    expect(s).toBeGreaterThan(5)
  })
})
