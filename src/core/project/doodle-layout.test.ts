import { describe, expect, test } from 'vitest'
import { itemBox, pixelsPerUnit, reflow, smallText } from './doodle-layout'
import { parseProject, starterProject } from './project'

const label = (text: string, x: number, y: number, extra = {}) => ({
  text,
  x,
  y,
  size: 56,
  tone: 'fg' as const,
  seconds: 0.8,
  ...extra,
})
const line = (d: string, extra = {}) => ({
  d,
  tone: 'fg' as const,
  width: 6,
  seconds: 0.8,
  fillOpacity: 1,
  ...extra,
})

describe('itemBox', () => {
  test('follows relative moves and arcs', () => {
    expect(itemBox(line('M100 100 l50 0 v40'))).toEqual([100, 100, 150, 140])
    expect(itemBox(line('M100 100 A20 20 0 1 1 140 100'))).toEqual([80, 80, 140, 120])
  })
})

describe('reflow', () => {
  test('stacks things side by side, in their order, inside the tall frame', () => {
    const strokes = [label('left', 100, 300), label('right', 1200, 300), line('M100 600 H1500')]
    const out = reflow({ viewBox: '0 0 1600 720', strokes })
    expect(out.viewBox).toBe('0 0 900 1340')
    expect(out.strokes.map((s) => ('text' in s ? s.text : 'line'))).toEqual([
      'left',
      'right',
      'line',
    ])
    const [left, right] = out.strokes as ReturnType<typeof label>[]
    expect(right.y).toBeGreaterThan(left.y)
    for (const s of out.strokes) {
      const [x0, y0, x1, y1] = itemBox(s)!
      expect(x0).toBeGreaterThanOrEqual(0)
      expect(y0).toBeGreaterThanOrEqual(0)
      expect(x1).toBeLessThanOrEqual(900)
      expect(y1).toBeLessThanOrEqual(1340)
    }
  })

  test('a named group stays together however far apart, and apart from what it is near', () => {
    const strokes = [
      label('a', 100, 300, { group: 'pair' }),
      label('b', 1400, 300, { group: 'pair' }),
      label('c', 160, 300),
    ]
    const [a, b, c] = reflow({ viewBox: '0 0 1600 720', strokes }).strokes as ReturnType<
      typeof label
    >[]
    expect(a.y).toBe(b.y)
    expect(c.y).not.toBe(a.y)
  })

  test('moves a path that starts with a lowercase m', () => {
    const [moved] = reflow({ viewBox: '0 0 1600 720', strokes: [line('m100 100 l600 0')] }).strokes
    const [x0, , x1] = itemBox(moved)!
    expect((x0 + x1) / 2).toBeCloseTo(450, 0)
  })

  test('keeps every scale positive with many parts', () => {
    const strokes = Array.from({ length: 30 }, (_, i) =>
      label(`p${i}`, (i % 6) * 260, ((i / 6) | 0) * 200 + 60),
    )
    for (const s of reflow({ viewBox: '0 0 1600 720', strokes }).strokes) {
      expect('size' in s && s.size).toBeGreaterThan(0)
    }
  })

  test('falls back to the wide drawing on a path it cannot read', () => {
    const art = { viewBox: '0 0 1600 720', strokes: [line('M0 0 L10 10 X5')] }
    expect(reflow(art)).toBe(art)
  })

  test('scales flowing dots with the drawing', () => {
    const flow = { count: 3, speed: 100, tone: 'accent' as const, size: 10 }
    const [moved] = reflow({
      viewBox: '0 0 1600 720',
      strokes: [line('M0 0 H1680', { flow })],
    }).strokes
    expect('flow' in moved && moved.flow?.speed).toBeCloseTo(50)
  })
})

describe('smallText', () => {
  const project = (doodle: object) =>
    parseProject({
      ...starterProject('D'),
      formats: ['16:9', '9:16'],
      scenes: [
        {
          id: 's1',
          kind: 'blocks',
          caption: 'x',
          blocks: [{ type: 'doodle', strokes: [label('tiny', 100, 300, { size: 40 })], ...doodle }],
        },
      ],
    })

  test('16:9 shows a viewBox unit at about a pixel', () => {
    expect(pixelsPerUnit('0 0 1600 720', '16:9')).toBeCloseTo(1.056, 3)
  })

  test('flags a wide drawing shrunk into 9:16, not the reflowed one', () => {
    expect(smallText(project({ reflow: false }))).toEqual([
      { scene: 's1', block: 0, format: '9:16', text: 'tiny', px: 21 },
    ])
    expect(smallText(project({}))).toEqual([])
  })
})
