// How one scene gives way to the next, as a pure function of progress: no clocks
// or randomness, so a moment in a transition always draws the same frame. The
// breaking effects cut the old scene's picture with one clip path instead of
// copying it into pieces, which keeps them cheap to render.
import type { Transition } from '@/core/project'

export type Look = {
  opacity?: number
  /** Percent of the scene's width to shift it right. */
  shift?: number
  transform?: string
  clipPath?: string
}
export type Effect = {
  incoming: Look
  outgoing?: Look
  /** The old scene stays above the new one and is what moves. */
  oldOnTop?: boolean
  /**
   * Outlines of the broken pieces. Scenes often share a background, and without
   * these the pieces would be invisible against the same color behind them.
   */
  edges?: string
}

const SLOW: Partial<Record<Transition, number>> = {
  flip: 0.7,
  break: 0.8,
  shatter: 1,
  crumble: 1.1,
}
export const defaultSeconds = (kind: Transition) => SLOW[kind] ?? 0.45

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const n = (x: number) => Math.round(x * 10) / 10
/** The same number for the same seed, everywhere: a stand-in for randomness. */
const seeded = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 11.7) * 43758.5453
  return x - Math.floor(x)
}
const shape = (points: [number, number][]) =>
  `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')} Z`
const clip = (shapes: string[]) =>
  shapes.length ? `path("${shapes.join(' ')}")` : 'polygon(0 0, 0 0, 0 0)'

function blinds(p: number, w: number, h: number) {
  const count = 8
  const strip = w / count
  return Array.from({ length: count }, (_, i) =>
    shape([
      [i * strip, 0],
      [i * strip + strip * p, 0],
      [i * strip + strip * p, h],
      [i * strip, h],
    ]),
  )
}

/** The old picture cracks down the middle, and the halves pull apart. */
function broken(p: number, w: number, h: number) {
  const steps = 9
  const crack = Array.from({ length: steps + 1 }, (_, i): [number, number] => [
    w / 2 + (seeded(i) - 0.5) * w * 0.14,
    (i / steps) * h,
  ])
  const away = p * p * w * 0.62
  const tilt = p * p * h * 0.12
  const left: [number, number][] = [
    [-away, -tilt],
    ...crack.map(([x, y]): [number, number] => [x - away, y - tilt]),
    [-away, h - tilt],
  ]
  const right: [number, number][] = [
    [w + away, tilt],
    [w + away, h + tilt],
    ...[...crack].reverse().map(([x, y]): [number, number] => [x + away, y + tilt]),
  ]
  return [shape(left), shape(right)]
}

/** Glass: triangles fly out from where it was struck, shrinking as they go. */
function shards(p: number, w: number, h: number) {
  const cols = w >= h ? 8 : 5
  const rows = w >= h ? 5 : 8
  const corner = (c: number, r: number): [number, number] => {
    const inside = c > 0 && c < cols && r > 0 && r < rows
    const seed = c * 31 + r * 7
    return [
      ((c + (inside ? (seeded(seed) - 0.5) * 0.7 : 0)) / cols) * w,
      ((r + (inside ? (seeded(seed + 1) - 0.5) * 0.7 : 0)) / rows) * h,
    ]
  }
  const diagonal = Math.hypot(w, h)
  const out: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [a, b, d, e] = [corner(c, r), corner(c + 1, r), corner(c + 1, r + 1), corner(c, r + 1)]
      for (const [t, tri] of [
        [0, [a, b, d]],
        [1, [a, d, e]],
      ] as const) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        const seed = (r * cols + c) * 2 + t
        const from = Math.hypot(cx - w * 0.42, cy - h * 0.38) / diagonal
        // Timed so that every piece has gone by the end.
        const q = clamp((p - from * 0.6 - seeded(seed) * 0.09) / 0.5)
        if (q >= 1) continue
        const dx = (cx - w * 0.42) * q * q * 1.3
        const dy = (cy - h * 0.38) * q * q * 1.3 + q * q * h * 0.35
        const turn = (seeded(seed + 500) - 0.5) * 2.6 * q
        const size = 1 - q
        const [cos, sin] = [Math.cos(turn), Math.sin(turn)]
        out.push(
          shape(
            tri.map(([x, y]): [number, number] => {
              const [ox, oy] = [(x - cx) * size, (y - cy) * size]
              return [cx + dx + ox * cos - oy * sin, cy + dy + ox * sin + oy * cos]
            }),
          ),
        )
      }
    }
  }
  return out
}

/** Crumbling: small pieces drop away, from the bottom up. */
function crumbs(p: number, w: number, h: number) {
  const size = Math.max(w, h) / 16
  const cols = Math.ceil(w / size)
  const rows = Math.ceil(h / size)
  const out: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const q = clamp((p - ((rows - 1 - r) / rows) * 0.5 - seeded(r * cols + c) * 0.18) / 0.3)
      if (q >= 1) continue
      const fall = q * q * h * 0.5
      const side = size * (1 - q * 0.75)
      const x = c * size + (size - side) / 2 + (seeded(r * cols + c + 900) - 0.5) * q * size * 2
      const y = r * size + (size - side) / 2 + fall
      out.push(
        shape([
          [x, y],
          [x + side, y],
          [x + side, y + side],
          [x, y + side],
        ]),
      )
    }
  }
  return out
}

const breaking = (shapes: string[]): Effect => ({
  oldOnTop: true,
  incoming: {},
  outgoing: { clipPath: clip(shapes) },
  edges: shapes.join(' '),
})

/** What each scene looks like `p` of the way through (0 to 1), in a `w` by `h` stage. */
export function transitionEffect(kind: Transition, p: number, w: number, h: number): Effect {
  const eased = 1 - (1 - p) ** 2
  switch (kind) {
    case 'cut':
      return { incoming: {} }
    case 'fade':
      return { incoming: { opacity: eased } }
    case 'slide':
      return { incoming: { opacity: eased, shift: (1 - eased) * 6 } }
    case 'wipe':
      return { incoming: { clipPath: `inset(0 ${n((1 - eased) * 100)}% 0 0)` } }
    case 'zoom':
      return {
        incoming: { opacity: eased, transform: `scale(${(0.82 + 0.18 * eased).toFixed(3)})` },
        outgoing: { transform: `scale(${(1 + 0.12 * eased).toFixed(3)})` },
      }
    case 'iris':
      return { incoming: { clipPath: `circle(${n(eased * 72)}% at 50% 50%)` } }
    case 'flip': {
      const depth = `perspective(${Math.round(Math.max(w * 1.6, 1))}px)`
      return p < 0.5
        ? {
            oldOnTop: true,
            incoming: { opacity: 0 },
            outgoing: { transform: `${depth} rotateY(${(p * 180).toFixed(1)}deg)` },
          }
        : { incoming: { transform: `${depth} rotateY(${((p - 1) * 180).toFixed(1)}deg)` } }
    }
    case 'blinds':
      return { incoming: { clipPath: clip(blinds(eased, w, h)) } }
    case 'break':
      return breaking(broken(p, w, h))
    case 'shatter':
      return breaking(shards(p, w, h))
    case 'crumble':
      return breaking(crumbs(p, w, h))
  }
}

/**
 * The first scene, with nothing before it: effects that need an old picture to
 * break or turn away from just show the scene, and the rest play over the stage.
 */
export function openingEffect(kind: Transition, p: number, w: number, h: number): Effect {
  if (kind === 'break' || kind === 'shatter' || kind === 'crumble' || kind === 'flip') {
    return { incoming: {} }
  }
  return transitionEffect(kind, p, w, h)
}
