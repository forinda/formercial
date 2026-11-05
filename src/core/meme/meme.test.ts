import { describe, expect, test } from 'vitest'
import {
  blankMeme,
  drawMeme,
  fitBox,
  gifDelays,
  gifSize,
  memeLength,
  memeMoves,
  parseMeme,
  postLayout,
  stillFrames,
  textOn,
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
    arc: () => calls.push('arc'),
    roundRect: () => calls.push('roundRect'),
    fill: () => calls.push(`fill ${g.fillStyle}`),
    stroke: () => calls.push(`stroke ${g.strokeStyle}`),
    lineCap: 'butt',
    moveTo() {},
    lineTo() {},
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
      picture: { image: {} as CanvasImageSource, w: 100, h: 100 },
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
    )
    // 25% across; its 118.8px line centred on the middle.
    expect(calls.at(-1)).toBe('fill #ffffff "here" 270,481')
  })

  test('a meme with no text draws no bar', () => {
    const { g, calls } = paper()
    drawMeme(g, meme({ texts: [] }))
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

describe('timed text', () => {
  test('a text shows from its at until its until', () => {
    expect(textOn({}, 0)).toBe(true)
    expect(textOn({ at: 1 }, 0.9)).toBe(false)
    expect(textOn({ at: 1, until: 2 }, 1)).toBe(true)
    expect(textOn({ at: 1, until: 2 }, 2)).toBe(false)
  })

  test('only the texts showing at that moment are drawn', () => {
    const m = parseMeme({
      ...blankMeme('M'),
      layout: 'classic',
      texts: [
        { text: 'first', until: 1 },
        { text: 'then', at: 1, outline: false },
      ],
    })
    const at = (t: number) => {
      const { g, calls } = paper()
      drawMeme(g, m, {}, t)
      return calls.filter((c) => c.startsWith('fill #ffffff'))
    }
    expect(at(0.5)).toEqual(['fill #ffffff "FIRST" 540,32'])
    expect(at(1.5)).toEqual(['fill #ffffff "THEN" 540,953'])
  })

  test('the caption bar keeps its height while its text comes and goes', () => {
    const m = parseMeme({ ...blankMeme('M'), texts: [{ text: 'hi', size: 10, at: 1 }] })
    const bar = (t: number) => {
      const { g, calls } = paper()
      drawMeme(g, m, {}, t)
      return calls
    }
    expect(bar(0)).toEqual(['rect #000000 0,0 1080x1080', 'rect #ffffff 0,0 1080x194'])
    expect(bar(1).at(-1)).toBe('fill #111111 "hi" 540,32')
  })

  test('a meme moves with a GIF or timed text, and loops on the GIF or its seconds', () => {
    const still = blankMeme('M')
    expect(memeMoves(still)).toBe(false)
    expect(memeLength(still)).toBe(0)
    const timed = parseMeme({ ...still, seconds: 4, texts: [{ text: 'x', at: 2 }] })
    expect(memeMoves(timed)).toBe(true)
    expect(memeLength(timed)).toBe(4)
    expect(memeLength(parseMeme({ ...timed, media: 'media/a.gif' }), 1.5)).toBe(1.5)
    expect(stillFrames(0.5)).toEqual([0, 0.1, 0.2, 0.3, 0.4])
  })
})

describe('post card', () => {
  const post = (o: Record<string, unknown> = {}) =>
    parseMeme({
      ...blankMeme('M'),
      layout: 'post',
      post: { name: 'Ada', handle: '@ada', time: '3h', badge: true, ...o },
      texts: [{ text: 'shipping on a friday', size: 5 }],
    })

  test('the author line, a plain checkmark, the time and the post are drawn', () => {
    const { g, calls } = paper()
    drawMeme(g, post())
    expect(calls).toContain('fill #111111 "Ada" 248,442')
    expect(calls).toContain('fill #2f80ed')
    expect(calls).toContain('stroke #ffffff')
    expect(calls.some((c) => c.includes('"@ada · 3h"'))).toBe(true)
    expect(calls.some((c) => c.includes('"shipping on a friday"'))).toBe(true)
  })

  test('with no face uploaded, the first letter stands in', () => {
    const { g, calls } = paper()
    drawMeme(g, post({ badge: false }))
    expect(calls).toContain('fill #ffffff "A" 157,456')
    expect(calls).not.toContain('stroke #ffffff')
  })

  test('dark cards, and a picture under the text that fits the card', () => {
    const { g, calls } = paper()
    drawMeme(g, post({ dark: true }), {
      picture: { image: {} as CanvasImageSource, w: 200, h: 100 },
    })
    expect(calls).toContain('fill #16181c')
    const L = postLayout(
      post(),
      { image: {} as CanvasImageSource, w: 200, h: 100 },
      (s, size) => s.length * size * 0.5,
    )
    expect(L.picture!.w).toBeCloseTo(885.6)
    expect(L.picture!.h).toBeCloseTo(442.8)
    expect(L.card.y + L.card.h).toBeLessThanOrEqual(1080)
  })
})
