import { describe, expect, test } from 'vitest'
import { clearPaper, inkBounds, smooth } from './draw'

/** A w×h RGBA picture, all one colour, with `ink` painted where it says. */
function picture(w: number, h: number, paper: number[], ink: [number, number][] = []) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(paper, i * 4)
  for (const [x, y] of ink) data.set([20, 30, 120, 255], (y * w + x) * 4)
  return { data, width: w, height: h }
}

describe('inkBounds', () => {
  test('crops to the strokes, with a little room', () => {
    const img = picture(
      100,
      50,
      [0, 0, 0, 0],
      [
        [10, 20],
        [60, 30],
      ],
    )
    expect(inkBounds(img, 2)).toEqual({ x: 8, y: 18, w: 55, h: 15 })
  })

  test('nothing drawn is nothing to keep', () => {
    expect(inkBounds(picture(10, 10, [0, 0, 0, 0]), 2)).toBeNull()
  })

  test('the room stays inside the picture', () => {
    expect(inkBounds(picture(10, 10, [0, 0, 0, 0], [[0, 9]]), 4)).toEqual({
      x: 0,
      y: 5,
      w: 5,
      h: 5,
    })
  })
})

describe('clearPaper', () => {
  test('white paper goes, the ink stays', () => {
    const img = picture(20, 10, [250, 248, 245, 255], [[5, 5]])
    clearPaper(img, 40)
    expect(img.data[3]).toBe(0)
    expect(img.data[(5 * 20 + 5) * 4 + 3]).toBe(255)
  })

  test('paper the colour of the corners goes, even if not white', () => {
    const img = picture(20, 10, [200, 190, 160, 255], [[5, 5]])
    clearPaper(img, 40)
    expect(img.data[(2 * 20 + 2) * 4 + 3]).toBe(0)
    expect(img.data[(5 * 20 + 5) * 4 + 3]).toBe(255)
  })

  test('a lower threshold keeps more', () => {
    const img = picture(4, 4, [255, 255, 255, 255])
    img.data.set([215, 215, 215, 255], (1 * 4 + 1) * 4)
    clearPaper(img, 10)
    expect(img.data[(1 * 4 + 1) * 4 + 3]).toBe(255)
  })

  test('off (0) keeps the paper as it is', () => {
    const img = picture(4, 4, [255, 255, 255, 255])
    clearPaper(img, 0)
    expect([...img.data].filter((_, i) => i % 4 === 3).every((a) => a === 255)).toBe(true)
  })
})

test('smoothing keeps the ends and rounds the corners', () => {
  const line = smooth([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ])
  expect(line[0]).toEqual({ x: 0, y: 0 })
  expect(line.at(-1)).toEqual({ x: 10, y: 10 })
  // The corner at (10, 0) is cut, not kept.
  expect(line).not.toContainEqual({ x: 10, y: 0 })
})
