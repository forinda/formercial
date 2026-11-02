// Doodle geometry the player, the editor and the CLI share: moving paths, the room
// a drawing's items take up, the 9:16 layout made from a wide drawing, and how big
// its words end up on screen.
import { FORMATS, UNIT, type Block, type Format, type Project } from './project'

type Doodle = Extract<Block, { type: 'doodle' }>
export type DoodleItem = Doodle['strokes'][number]
type Art = { viewBox: string; strokes: DoodleItem[] }

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
  let started = false
  for (skip(); i < d.length; skip()) {
    if (/[a-zA-Z]/.test(d[i])) command = d[i++]
    else if (!command) throw new Error('a path starts with a command')
    else if (command === 'M') command = 'L'
    else if (command === 'm') command = 'l'
    const upper = command.toUpperCase()
    if (!(upper in ARGS)) throw new Error(`"${command}" isn't a path command`)
    // A path's first moveto is absolute even when written as "m".
    const relative = command !== upper && (started || upper !== 'M')
    started = true
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

type Box = [number, number, number, number]

/** Roughly the area an item covers: path points (arcs by their radius), or a label's line of text. */
export function itemBox(item: DoodleItem): Box | null {
  if ('text' in item) {
    const width = item.text.length * item.size * (item.mono ? 0.6 : 0.5)
    return [item.x, item.y - item.size, item.x + width, item.y + item.size * 0.3]
  }
  const xs: number[] = []
  const ys: number[] = []
  let x = 0
  let y = 0
  const to = (px: number, py: number) => {
    xs.push((x = px))
    ys.push((y = py))
  }
  for (const [, c, args] of item.d.matchAll(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi)) {
    const n = (args.match(/[-+]?(\d*\.\d+|\d+\.?)([eE][-+]?\d+)?/g) ?? []).map(Number)
    const rel = c !== c.toUpperCase()
    const C = c.toUpperCase()
    if (C === 'H') n.forEach((v) => to(rel ? x + v : v, y))
    else if (C === 'V') n.forEach((v) => to(x, rel ? y + v : v))
    else if (C === 'A') {
      for (let i = 0; i + 6 < n.length; i += 7) {
        const r = Math.max(n[i], n[i + 1])
        xs.push(x - r, x + r)
        ys.push(y - r, y + r)
        to(rel ? x + n[i + 5] : n[i + 5], rel ? y + n[i + 6] : n[i + 6])
      }
    } else if (C !== 'Z') {
      // ponytail: control points count as covered, a slightly larger box than the curve.
      for (let i = 0; i + 1 < n.length; i += 2)
        to(rel ? x + n[i] : n[i], rel ? y + n[i + 1] : n[i + 1])
    }
  }
  return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null
}

const join = (a: Box, b: Box): Box => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
]

// The 9:16 drawing: the room a doodle has between the top and the captions on a
// phone, 1271px tall by 840px wide, in units of the same width as the wide drawing's.
const TALL = { width: 900, height: 1340, pad: 30, gap: 56, maxScale: 1.5 }
// Items closer than this belong together when they don't name a group.
const NEAR = { x: 60, y: 70 }
const near = (a: Box, b: Box) =>
  a[0] - NEAR.x <= b[2] && b[0] - NEAR.x <= a[2] && a[1] - NEAR.y <= b[3] && b[1] - NEAR.y <= a[3]

type Group = { box: Box; items: number[] }

/** Items named into a group stay together; the rest group by what they're near. */
function groups(strokes: DoodleItem[]): Group[] {
  const named = new Map<string, Group>()
  let loose: Group[] = []
  strokes.forEach((item, i) => {
    const box = itemBox(item)
    if (!box) return
    const name = item.group
    if (name === undefined) return loose.push({ box, items: [i] })
    const g = named.get(name)
    if (g) named.set(name, { box: join(g.box, box), items: [...g.items, i] })
    else named.set(name, { box, items: [i] })
  })
  for (let merged = true; merged;) {
    merged = false
    outer: for (let i = 0; i < loose.length; i++) {
      for (let j = i + 1; j < loose.length; j++) {
        if (!near(loose[i].box, loose[j].box)) continue
        loose[i] = {
          box: join(loose[i].box, loose[j].box),
          items: [...loose[i].items, ...loose[j].items],
        }
        loose = loose.filter((_, k) => k !== j)
        merged = true
        break outer
      }
    }
  }
  // Reading order: top to bottom, then left to right along a row.
  return [...named.values(), ...loose].sort((a, b) =>
    Math.abs(a.box[1] - b.box[1]) < 60 ? a.box[0] - b.box[0] : a.box[1] - b.box[1],
  )
}

/**
 * A wide drawing laid out for 9:16: its groups stacked top to bottom, each as wide
 * as the frame allows. Items keep their order and timing, so the voice still lines up.
 */
export function reflow(art: Art): Art {
  try {
    return stack(art)
  } catch {
    // A path the parser can't read: the browser may still draw it, so show the wide drawing.
    return art
  }
}

function stack(art: Art): Art {
  const gs = groups(art.strokes)
  if (!gs.length) return art
  const { width: W, height: H, pad, maxScale } = TALL
  // At most a quarter of the height goes to gaps, so many parts still have room.
  const gap = Math.min(TALL.gap, ((H - 2 * pad) * 0.25) / Math.max(1, gs.length - 1))
  const gaps = gap * (gs.length - 1)
  let scales = gs.map((g) => Math.min(maxScale, (W - 2 * pad) / Math.max(1, g.box[2] - g.box[0])))
  const tall = () => gs.reduce((sum, g, i) => sum + (g.box[3] - g.box[1]) * scales[i], 0)
  if (tall() + gaps > H - 2 * pad) {
    const fit = (H - 2 * pad - gaps) / Math.max(1, tall())
    scales = scales.map((s) => s * fit)
  }
  let top = Math.max(pad, (H - tall() - gaps) / 2)
  const strokes = [...art.strokes]
  gs.forEach((g, i) => {
    const scale = scales[i]
    const t = {
      scale,
      x: (W - (g.box[2] - g.box[0]) * scale) / 2 - g.box[0] * scale,
      y: top - g.box[1] * scale,
    }
    for (const n of g.items) {
      const moved = transformItem(art.strokes[n], t)
      if ('d' in moved && moved.flow) {
        moved.flow = {
          ...moved.flow,
          speed: moved.flow.speed * scale,
          size: moved.flow.size * scale,
        }
      }
      strokes[n] = moved
    }
    top += (g.box[3] - g.box[1]) * scale + gap
  })
  return { viewBox: `0 0 ${W} ${H}`, strokes }
}

/** What a doodle draws in this format: its own tall drawing, the reflowed one, or the wide one. */
export function doodleArt(b: Doodle, format: Format): Art {
  if (format !== '9:16') return b
  return b.tall ?? (b.reflow ? reflow(b) : b)
}

/** Screen pixels per viewBox unit, if the doodle gets the scene's whole content area. */
export function pixelsPerUnit(viewBox: string, format: Format): number {
  const [width, height] = FORMATS[format]
  const u = (UNIT[format] * width) / 100
  const [, , w, h] = viewBox.split(/\s+/).map(Number)
  // The scene's padding: 6u at the sides, 4.5u above and 7u below.
  return Math.min((width - 12 * u) / w, (height - 11.5 * u) / h)
}

/** Labels below this many pixels tall are hard to read, on a phone above all. */
export const MIN_TEXT_PX = 24

export type SmallText = { scene: string; block: number; format: Format; text: string; px: number }

/**
 * Doodle labels too small to read, per format. It assumes a doodle has the whole
 * scene, so a doodle sharing its scene is smaller still.
 */
export function smallText(project: Project, only?: Format[]): SmallText[] {
  const found: SmallText[] = []
  for (const scene of project.scenes) {
    if (scene.kind !== 'blocks') continue
    scene.blocks.forEach((b, block) => {
      if (b.type !== 'doodle') return
      for (const format of project.formats.filter((f) => !only || only.includes(f))) {
        const art = doodleArt(b, format)
        const scale = pixelsPerUnit(art.viewBox, format)
        let least: { text: string; px: number } | undefined
        for (const item of art.strokes) {
          if (!('text' in item)) continue
          const px = Math.round(item.size * scale * 10) / 10
          if (px < MIN_TEXT_PX && (!least || px < least.px)) least = { text: item.text, px }
        }
        if (least) found.push({ scene: scene.id, block, format, ...least })
      }
    })
  }
  return found
}
