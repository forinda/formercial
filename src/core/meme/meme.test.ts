import { describe, expect, test } from 'vitest'
import {
  blankMeme,
  drawMeme,
  fitBox,
  gifDelays,
  gifSize,
  parseMeme,
  wrapLines,
  type Paint,
} from './meme'

// A canvas stand-in that writes down what's drawn. Each letter is 10px wide.
function paper() {
  const calls: string[] = []
  const g = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: 'miter',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    measureText: (s: string) => ({ width: s.length * 10 }),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`rect ${g.fillStyle} ${x},${y} ${w}x${Math.round(h)}`),
    fillText: (s: string, x: number, y: number) =>
      calls.push(`fill ${g.fillStyle} "${s}" ${Math.round(x)},${Math.round(y)}`),
    strokeText: (s: string) => calls.push(`stroke "${s}"`),
    drawImage: () => calls.push('image'),
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
  }
  return { g: g as unknown as Paint, calls }
}

describe('wrapLines', () => {
  const w = (s: string) => s.length * 10
  test('breaks at spaces before the limit, and keeps given line breaks', () => {
    expect(wrapLines('one two three', 70, w)).toEqual(['one two', 'three'])
    expect(wrapLines('a\nb c', 1000, w)).toEqual(['a', 'b c'])
  })
  test('a word longer than the limit gets a line to itself', () => {
    expect(wrapLines('hi supercalifragilistic yo', 50, w)).toEqual([
      'hi',
      'supercalifragilistic',
      'yo',
    ])
  })
})

describe('fitBox', () => {
  const space = { x: 0, y: 100, w: 1000, h: 500 }
  test('contain shows the whole picture, centred', () => {
    expect(fitBox({ w: 200, h: 200 }, space, 'contain')).toEqual({ x: 250, y: 100, w: 500, h: 500 })
  })
  test('cover fills the space and lets the rest be cropped', () => {
    expect(fitBox({ w: 200, h: 200 }, space, 'cover')).toEqual({ x: 0, y: -150, w: 1000, h: 1000 })
  })
})

describe('drawMeme', () => {
  const meme = (o: Record<string, unknown>) => parseMeme({ ...blankMeme('M'), ...o })

  test('the caption bar is drawn above the picture, in its colours', () => {
    const { g, calls } = paper()
    drawMeme(g, meme({ bar: '#ffffff', barText: '#111111', texts: [{ text: 'hi', size: 10 }] }), {
      image: {} as CanvasImageSource,
      w: 100,
      h: 100,
    })
    // 1080 wide: size 10 is 108px letters, one line, plus padding.
    expect(calls).toEqual([
      'rect #000000 0,0 1080x1080',
      'image',
      'rect #ffffff 0,0 1080x194',
      'fill #111111 "hi" 540,32',
    ])
  })

  test('classic text is upper case and outlined, top and bottom', () => {
    const { g, calls } = paper()
    drawMeme(
      g,
      meme({ layout: 'classic', texts: [{ text: 'top' }, { text: 'bottom', outline: false }] }),
      null,
    )
    expect(calls.filter((c) => !c.startsWith('rect'))).toEqual([
      'stroke "TOP"',
      'fill #ffffff "TOP" 540,32',
      'fill #ffffff "BOTTOM" 540,953',
    ])
  })

  test('free text is centred on its x and y', () => {
    const { g, calls } = paper()
    drawMeme(
      g,
      meme({ layout: 'free', texts: [{ text: 'here', x: 25, y: 50, size: 10, outline: false }] }),
      null,
    )
    // 25% across; its 118.8px line centred on the middle.
    expect(calls.at(-1)).toBe('fill #ffffff "here" 270,481')
  })

  test('a meme with no text draws no bar', () => {
    const { g, calls } = paper()
    drawMeme(g, meme({ texts: [] }), null)
    expect(calls).toEqual(['rect #000000 0,0 1080x1080'])
  })
})

describe('GIF export', () => {
  test('each frame keeps its own delay, in the 10 ms steps a GIF stores', () => {
    // Frames start at 0, 0.1 and 0.333 s in a 0.5 s GIF.
    expect(gifDelays([0, 0.1, 0.333], 0.5)).toEqual([100, 230, 170])
  })
  test('no frame is shorter than 20 ms, which browsers would slow down anyway', () => {
    expect(gifDelays([0, 0.001], 0.002)).toEqual([20, 20])
  })
  test('the GIF is at most 720 wide, keeping the shape', () => {
    expect(gifSize(blankMeme('M'))).toEqual([720, 720])
    expect(gifSize(parseMeme({ ...blankMeme('M'), size: '9:16' }))).toEqual([720, 1280])
    expect(gifSize(parseMeme({ ...blankMeme('M'), size: '16:9' }))).toEqual([720, 405])
  })
})
