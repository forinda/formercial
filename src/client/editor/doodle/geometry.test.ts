// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { DoodleStrokesSchema } from '@/core/project'
import {
  fitInto,
  importSvg,
  pointsToPath,
  secondsFor,
  shapePath,
  simplify,
  transformItem,
  transformPath,
} from './geometry'
import { PARTS } from './parts'

describe('transformPath', () => {
  test('moves and scales absolute commands', () => {
    expect(transformPath('M10 20 L30 40 H50 V60 Z', { x: 100, y: 200, scale: 2 })).toBe(
      'M120 240 L160 280 H200 V320 Z',
    )
  })
  test('relative commands only scale', () => {
    expect(transformPath('M10 10 l5 5 h10', { x: 100, scale: 2 })).toBe('M120 20 l10 10 h20')
  })
  test('arcs scale their radii and keep their flags', () => {
    expect(transformPath('M0 0 A10 20 30 1 0 40 50', { x: 1, scale: 2 })).toBe(
      'M1 0 A20 40 30 1 0 81 100',
    )
  })
  test('reads compact paths: repeated pairs, implied lines and packed arc flags', () => {
    expect(transformPath('M0,0 10,10 20,20', {})).toBe('M0 0 L10 10 L20 20')
    expect(transformPath('M0 0a5 5 0 01 10 0', {})).toBe('M0 0 a5 5 0 0 1 10 0')
    expect(transformPath('M.5-.5', { scale: 2 })).toBe('M1 -1')
  })
  test('curves keep every control point', () => {
    expect(transformPath('M0 0 C1 2 3 4 5 6', { x: 1 })).toBe('M1 0 C2 2 4 4 6 6')
  })
  test('refuses what it cannot read', () => {
    expect(() => transformPath('hello', {})).toThrow()
    expect(() => transformPath('10 10', {})).toThrow()
  })
})

describe('freehand', () => {
  test('simplify drops points on a straight line and keeps a corner', () => {
    const straight = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 0.2 }))
    expect(simplify(straight)).toHaveLength(2)
    const corner = [...straight, { x: 190, y: 100 }]
    expect(simplify(corner).some((p) => p.x === 190 && p.y === 0.2)).toBe(true)
  })
  test('a tap is a dot, two points a line, and more a smooth curve', () => {
    expect(pointsToPath([{ x: 1, y: 2 }])).toBe('M1 2 L1 2')
    expect(
      pointsToPath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('M1 2 L3 4')
    const curve = pointsToPath([
      { x: 0, y: 0 },
      { x: 50, y: 80 },
      { x: 100, y: 0 },
      { x: 150, y: 80 },
    ])
    expect(curve).toMatch(/^M0 0 Q50 80 75 40 Q100 0 125 40 L150 80$/)
  })
  test('longer lines take longer to draw, within limits', () => {
    expect(secondsFor(10)).toBe(0.3)
    expect(secondsFor(700)).toBe(1)
    expect(secondsFor(99999)).toBe(3)
  })
})

describe('shapes', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 100, y: 50 }
  test('every shape is a path the schema accepts', () => {
    for (const shape of ['line', 'arrow', 'rect', 'ellipse'] as const) {
      expect(DoodleStrokesSchema.safeParse([{ d: shapePath(shape, a, b) }]).success).toBe(true)
    }
  })
  test('a rectangle goes round its corners', () => {
    expect(shapePath('rect', a, b)).toBe('M0 0 H100 V50 H0 Z')
  })
  test('an ellipse works whichever way it was dragged', () => {
    expect(shapePath('ellipse', b, a)).toBe(shapePath('ellipse', a, b))
  })
})

describe('parts', () => {
  test('every part is valid, and still valid once placed', () => {
    for (const part of PARTS) {
      expect(DoodleStrokesSchema.safeParse(part.items).success, part.id).toBe(true)
      const placed = part.items.map((i) => transformItem(i, { x: 300, y: 200, scale: 1.5 }))
      expect(DoodleStrokesSchema.safeParse(placed).success, part.id).toBe(true)
    }
  })
  test('labels move and grow with their part', () => {
    expect(
      transformItem(
        { text: 'a', x: 10, y: 20, size: 40, tone: 'fg', seconds: 1 },
        { x: 5, y: 5, scale: 2 },
      ),
    ).toMatchObject({ x: 25, y: 45, size: 80 })
  })
  test('ids are unique', () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length)
  })
})

describe('importSvg', () => {
  const look = { tone: 'fg', width: 5 } as const
  const box = '0 0 1600 720'
  test('reads every shape, fitted to the drawing', () => {
    const { items, skipped } = importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M0 0 L100 100"/><line x1="0" y1="0" x2="10" y2="10"/>
        <rect x="1" y="1" width="5" height="5"/><circle cx="50" cy="50" r="10"/>
        <ellipse cx="50" cy="50" rx="10" ry="5"/><polyline points="0,0 5,5 9,1"/>
        <polygon points="0,0 5,5 9,1"/></svg>`,
      box,
      look,
    )
    expect(items).toHaveLength(7)
    expect(skipped).toBe(0)
    expect(DoodleStrokesSchema.safeParse(items).success).toBe(true)
    const fit = fitInto(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 1600, height: 720 },
    )
    expect((items[0] as { d: string }).d).toBe(transformPath('M0 0 L100 100', fit))
  })
  test('ignores everything that is not a shape, and counts what it leaves out', () => {
    const { items, skipped } = importSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
        <script>alert(1)</script><text>hi</text><image href="x.png"/>
        <defs><path d="M0 0 L1 1"/></defs>
        <g transform="scale(2)"><path d="M0 0 L1 1"/></g>
        <path d="not a path"/><path d="M0 0 L5 5"/></svg>`,
      box,
      look,
    )
    expect(items).toHaveLength(1)
    expect(skipped).toBe(3)
  })
  test('refuses a file that is not an SVG', () => {
    expect(() => importSvg('<html></html>', box, look)).toThrow("isn't an SVG")
  })
})
