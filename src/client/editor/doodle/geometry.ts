// The drawing board's sums: turning pointer movements, shapes, parts and imported
// SVGs into the paths a doodle block stores. No DOM here except for reading an SVG.
import type { Block } from '@/core/project/project'

export type DoodleItem = Extract<Block, { type: 'doodle' }>['strokes'][number]
export type Point = { x: number; y: number }
export type Tone = 'fg' | 'muted' | 'accent' | 'good' | 'bad'

const round = (n: number) => Math.round(n * 10) / 10

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

/** Move and scale an SVG path, absolute or relative, keeping its commands. */
export function transformPath(d: string, t: { x?: number; y?: number; scale?: number }): string {
  const { x: tx = 0, y: ty = 0, scale = 1 } = t
  const out: string[] = []
  let i = 0
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++
  }
  const number = () => {
    skip()
    const m = /^[-+]?(\d*\.\d+|\d+\.?)([eE][-+]?\d+)?/.exec(d.slice(i))
    if (!m) throw new Error(`can't read this path at "${d.slice(i, i + 12)}"`)
    i += m[0].length
    return Number(m[0])
  }
  const flag = () => {
    skip()
    const c = d[i++]
    if (c !== '0' && c !== '1') throw new Error("can't read this path's arc")
    return c
  }
  let command = ''
  for (skip(); i < d.length; skip()) {
    if (/[a-zA-Z]/.test(d[i])) command = d[i++]
    else if (!command) throw new Error('a path starts with a command')
    else if (command === 'M') command = 'L'
    else if (command === 'm') command = 'l'
    const upper = command.toUpperCase()
    if (!(upper in ARGS)) throw new Error(`"${command}" isn't a path command`)
    const relative = command !== upper
    const px = (n: number) => round(n * scale + (relative ? 0 : tx))
    const py = (n: number) => round(n * scale + (relative ? 0 : ty))
    if (upper === 'Z') out.push(command)
    else if (upper === 'H') out.push(`${command}${px(number())}`)
    else if (upper === 'V') out.push(`${command}${py(number())}`)
    else if (upper === 'A') {
      const rx = round(number() * scale)
      const ry = round(number() * scale)
      const rotation = number()
      const large = flag()
      const sweep = flag()
      out.push(
        `${command}${rx} ${ry} ${rotation} ${large} ${sweep} ${px(number())} ${py(number())}`,
      )
    } else {
      const pairs: string[] = []
      for (let n = 0; n < ARGS[upper] / 2; n++) pairs.push(`${px(number())} ${py(number())}`)
      out.push(`${command}${pairs.join(' ')}`)
    }
    if (upper === 'Z') command = ''
  }
  return out.join(' ')
}

export function transformItem<T extends DoodleItem>(
  item: T,
  t: { x?: number; y?: number; scale?: number },
): T {
  const { x = 0, y = 0, scale = 1 } = t
  if ('d' in item) {
    return {
      ...item,
      d: transformPath(item.d, t),
      width: round(item.width * Math.max(scale, 0.5)),
    }
  }
  return {
    ...item,
    x: round(item.x * scale + x),
    y: round(item.y * scale + y),
    size: round(item.size * scale),
  }
}

/** Ramer-Douglas-Peucker: drop points that barely change the line. */
export function simplify(points: Point[], tolerance = 2.5): Point[] {
  if (points.length < 3) return points
  const [a, b] = [points[0], points.at(-1)!]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  let far = 0
  let at = 0
  for (let i = 1; i < points.length - 1; i++) {
    const off = Math.abs(dy * points[i].x - dx * points[i].y + b.x * a.y - b.y * a.x) / length
    if (off > far) [far, at] = [off, i]
  }
  if (far <= tolerance) return [a, b]
  return [
    ...simplify(points.slice(0, at + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(at), tolerance),
  ]
}

/** A freehand stroke as a smooth path: curves through the midpoints between points. */
export function pointsToPath(points: Point[], tolerance = 2.5): string {
  const kept = simplify(points, tolerance)
  const at = (p: Point) => `${round(p.x)} ${round(p.y)}`
  if (kept.length === 1) return `M${at(kept[0])} L${at(kept[0])}`
  if (kept.length === 2) return `M${at(kept[0])} L${at(kept[1])}`
  const parts = [`M${at(kept[0])}`]
  for (let i = 1; i < kept.length - 1; i++) {
    const mid = { x: (kept[i].x + kept[i + 1].x) / 2, y: (kept[i].y + kept[i + 1].y) / 2 }
    parts.push(`Q${at(kept[i])} ${at(mid)}`)
  }
  parts.push(`L${at(kept.at(-1)!)}`)
  return parts.join(' ')
}

export type Shape = 'line' | 'arrow' | 'rect' | 'ellipse'

export function shapePath(shape: Shape, a: Point, b: Point): string {
  const [x1, y1, x2, y2] = [a.x, a.y, b.x, b.y].map(round)
  if (shape === 'line') return `M${x1} ${y1} L${x2} ${y2}`
  if (shape === 'rect') return `M${x1} ${y1} H${x2} V${y2} H${x1} Z`
  if (shape === 'ellipse') {
    const rx = round(Math.abs(x2 - x1) / 2)
    const ry = round(Math.abs(y2 - y1) / 2)
    const cy = round((y1 + y2) / 2)
    const [left, right] = [Math.min(x1, x2), Math.max(x1, x2)]
    return `M${left} ${cy} A${rx} ${ry} 0 1 1 ${right} ${cy} A${rx} ${ry} 0 1 1 ${left} ${cy}`
  }
  // An arrow: its head scales with its length, within reason.
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.min(36, Math.max(14, Math.hypot(x2 - x1, y2 - y1) / 4))
  const barb = (turn: number) =>
    `${round(x2 - head * Math.cos(angle + turn))} ${round(y2 - head * Math.sin(angle + turn))}`
  return `M${x1} ${y1} L${x2} ${y2} M${barb(0.5)} L${x2} ${y2} L${barb(-0.5)}`
}

/** About how long a line of this length should take to draw. */
export function secondsFor(length: number): number {
  return Math.round(Math.min(3, Math.max(0.3, length / 700)) * 10) / 10
}

export const lengthOf = (points: Point[]) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0)

export function newStroke(d: string, tone: Tone, width: number, seconds: number): DoodleItem {
  return { d, tone, width, seconds, fillOpacity: 1 }
}

export function parseViewBox(viewBox: string) {
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number)
  return { x, y, width, height }
}

/** Scale and centre a drawing from one coordinate box into another, with a margin. */
export function fitInto(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  margin = 0.9,
) {
  const scale = Math.min(to.width / from.width, to.height / from.height) * margin
  return {
    scale,
    x: to.x + (to.width - from.width * scale) / 2 - from.x * scale,
    y: to.y + (to.height - from.height * scale) / 2 - from.y * scale,
  }
}

const circlePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`

/** One SVG shape as a path, or null for anything that isn't a shape. */
function shapeToPath(el: Element): string | null {
  const n = (name: string) => Number(el.getAttribute(name) ?? 0)
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d')
    case 'line':
      return `M${n('x1')} ${n('y1')} L${n('x2')} ${n('y2')}`
    case 'rect':
      return `M${n('x')} ${n('y')} h${n('width')} v${n('height')} h${-n('width')} Z`
    case 'circle':
      return circlePath(n('cx'), n('cy'), n('r'), n('r'))
    case 'ellipse':
      return circlePath(n('cx'), n('cy'), n('rx'), n('ry'))
    case 'polyline':
    case 'polygon': {
      const nums = (el.getAttribute('points') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      if (nums.length < 4 || nums.some(Number.isNaN)) return null
      const pairs: string[] = []
      for (let i = 0; i + 1 < nums.length; i += 2) pairs.push(`${nums[i]} ${nums[i + 1]}`)
      return `M${pairs.join(' L')}${el.tagName.toLowerCase() === 'polygon' ? ' Z' : ''}`
    }
    default:
      return null
  }
}

const MAX_IMPORT = 300

/**
 * The shapes in an SVG file as strokes, fitted to the drawing. Only geometry is
 * read: scripts, styles, images and text in the file are ignored.
 */
export function importSvg(
  source: string,
  viewBox: string,
  look: { tone: Tone; width: number },
): { items: DoodleItem[]; skipped: number } {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error("that isn't an SVG file")
  }
  const box = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const from =
    box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0
      ? { x: box[0], y: box[1], width: box[2], height: box[3] }
      : {
          x: 0,
          y: 0,
          width: parseFloat(root.getAttribute('width') ?? '') || 100,
          height: parseFloat(root.getAttribute('height') ?? '') || 100,
        }
  const fit = fitInto(from, parseViewBox(viewBox))
  const items: DoodleItem[] = []
  let skipped = 0
  for (const el of root.querySelectorAll('path, line, rect, circle, ellipse, polyline, polygon')) {
    // ponytail: transforms aren't applied, so those shapes are left out and counted.
    if (el.closest('[transform]') || el.closest('defs, clipPath, mask, symbol')) {
      skipped++
      continue
    }
    const d = shapeToPath(el)
    if (!d) continue
    if (items.length >= MAX_IMPORT) {
      skipped++
      continue
    }
    try {
      items.push(newStroke(transformPath(d, fit), look.tone, look.width, 0.5))
    } catch {
      skipped++
    }
  }
  return { items, skipped }
}
