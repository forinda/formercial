// Scene stylesheet. Sizes are in --u, a unit the stage sets per format (a bit
// larger on tall and square frames, whose width is smaller), so one set of
// rules fits all three shapes. The stage sets everything a scene would inherit,
// so the page around it can't change the video.
import type { Format } from '@/core/project'

export const UNIT: Record<Format, number> = { '16:9': 1, '1:1': 1.35, '9:16': 1.85 }

export const STAGE_CSS = `
.fm-stage { color-scheme: dark; position: relative; width: 100%; aspect-ratio: var(--ratio); container-type: inline-size; overflow: hidden; background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 14px; font-weight: 400; line-height: 1.5; letter-spacing: normal; text-align: left }
.fm-stage [data-scene] { position: absolute; inset: 0 }
.fm-edges { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4; pointer-events: none }
.fm-edges path { fill: none; stroke: var(--fg); stroke-opacity: .55; stroke-width: 1.5; stroke-linejoin: round }
.fm-caption { position: absolute; left: calc(6 * var(--u)); right: calc(6 * var(--u)); bottom: calc(3 * var(--u)); text-align: center; font-size: calc(1.9 * var(--u)); line-height: 1.35; text-wrap: balance; color: var(--fg); z-index: 5 }
.fm-caption span { background: color-mix(in srgb, var(--bg) 82%, transparent); padding: calc(.3 * var(--u)) calc(.8 * var(--u)); border-radius: calc(.3 * var(--u)); box-decoration-break: clone; -webkit-box-decoration-break: clone }
/* TikTok, Reels and Shorts cover the bottom of a tall video with their own buttons and text. */
.fm-stage[data-format="9:16"] .fm-caption { bottom: calc(18.5 * var(--u)); font-size: calc(2.5 * var(--u)) }
`

const channel = (hex: string, i: number) => {
  const full = hex.length < 6 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1)
  return parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255
}

/** How bright a hex color looks, from 0 for black to 1 for white. */
export function luminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const c = channel(hex, i)
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const rgb = (hex: string) => [0, 1, 2].map((i) => channel(hex, i))
/** `amount` of the way from one color to another, as color-mix in srgb does it. */
const mix = (from: number[], to: number[], amount: number) =>
  from.map((c, i) => c + (to[i] - c) * amount)
const toHex = (c: number[]) =>
  `#${c
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/** How far apart two colors read, from 1 (the same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const FOR_DARK = { keyword: '#c9a8ff', call: '#8ec5ff' }
const FOR_LIGHT = { keyword: '#6d28d9', call: '#1557b0' }
const BLACK = [0, 0, 0]
const READABLE = 4.5

/**
 * The colors for code and boxes: the first that actually read on the box they'd
 * be drawn on. Middle greys read with neither palette as they are, so those get a
 * much darker box.
 */
export function boxColors(bg: string, fg: string) {
  const from = rgb(bg)
  const options = [
    {
      ...FOR_DARK,
      box: 'color-mix(in srgb, var(--bg) 80%, black)',
      rendered: mix(from, BLACK, 0.2),
    },
    {
      ...FOR_LIGHT,
      box: 'color-mix(in srgb, var(--bg) 92%, var(--fg))',
      rendered: mix(from, rgb(fg), 0.08),
    },
    {
      ...FOR_DARK,
      box: 'color-mix(in srgb, var(--bg) 30%, black)',
      rendered: mix(from, BLACK, 0.7),
    },
  ].map((o) => ({ ...o, rendered: toHex(o.rendered) }))
  return (
    options.find(
      (o) =>
        contrast(o.keyword, o.rendered) >= READABLE && contrast(o.call, o.rendered) >= READABLE,
    ) ?? options[2]
  )
}

export const SCENE_CSS = `
:host { display: block; overflow: hidden; background: radial-gradient(120% 90% at 85% 10%, color-mix(in srgb, var(--panel) 70%, var(--line)) 0%, transparent 55%), var(--panel) }
* { box-sizing: border-box }
.scene { position: absolute; inset: 0; padding: calc(4.5 * var(--u)) calc(6 * var(--u)) var(--below, calc(7 * var(--u))); display: flex; flex-direction: column; gap: calc(2.2 * var(--u)) }
.stack { flex: 1 0 auto; display: flex; flex-direction: column; gap: calc(2.2 * var(--u)); min-width: 0 }
.block { min-width: 0 }
.eyebrow { font-family: var(--mono); font-size: calc(1.25 * var(--u)); letter-spacing: .14em; text-transform: uppercase; color: var(--accent) }
.headline { font-family: var(--display); font-weight: 800; font-size: calc(3.9 * var(--u)); line-height: 1.05; letter-spacing: -0.02em; margin: 0; text-wrap: balance }
.headline em { font-style: normal; color: var(--accent) }
.text { font-size: calc(1.8 * var(--u)); color: var(--muted); margin: 0; max-width: 70ch }
.code, .term, .tree { font-family: var(--mono); font-size: calc(1.3 * var(--u)); line-height: 1.55; background: var(--box); border: 1px solid var(--line); border-radius: 4px; padding: calc(1.6 * var(--u)) calc(2 * var(--u)); margin: 0; white-space: pre; overflow: hidden; font-variant-ligatures: none }
.label { display: block; font-size: calc(1.05 * var(--u)); color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin-bottom: calc(.8 * var(--u)) }
.caret[hidden] { display: none }
.caret { display: inline-block; width: .6em; height: 1.1em; background: var(--accent); vertical-align: -0.2em }
.k { color: var(--keyword) } .s { color: var(--good) } .c { color: var(--muted); font-style: italic } .n { color: var(--accent) } .f { color: var(--call) }
.prompt { color: var(--accent) } .ok { color: var(--good) } .bad { color: var(--bad) }
.tree { line-height: 1.75 }
.tree .dir { color: var(--muted) }
.stamp { display: inline-block; font-family: var(--display); font-weight: 800; font-size: calc(2.6 * var(--u)); letter-spacing: .04em; padding: calc(.6 * var(--u)) calc(1.6 * var(--u)); border: calc(.35 * var(--u)) solid currentColor; border-radius: 4px; transform: rotate(-4deg) }
.stamp.good { color: var(--good) } .stamp.bad { color: var(--bad) }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(22 * var(--u)), 1fr)); gap: calc(1.6 * var(--u)) }
.card { border: 1px solid var(--line); border-radius: 4px; padding: calc(1.4 * var(--u)) calc(1.6 * var(--u)); background: var(--box) }
.card strong { display: block; font-family: var(--display); font-size: calc(2 * var(--u)); font-weight: 700 }
.card span { font-family: var(--mono); font-size: calc(1.25 * var(--u)); color: var(--muted) }
.chips { display: flex; flex-wrap: wrap; gap: calc(1 * var(--u)); align-items: center; font-size: calc(1.6 * var(--u)) }
.chips b { font-weight: 500; color: var(--muted); margin-right: calc(.6 * var(--u)) }
.chips span { border: 1px solid var(--accent); color: var(--accent); border-radius: 99px; padding: calc(.3 * var(--u)) calc(1.4 * var(--u)); font-family: var(--mono); font-size: calc(1.35 * var(--u)) }
.icons { display: flex; flex-wrap: wrap; justify-content: center; gap: calc(2.4 * var(--u)) }
.icon { max-width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: calc(.8 * var(--u)); font-size: calc(1.6 * var(--u)); color: var(--muted); text-align: center }
.icon img { display: block; width: auto; max-width: 100%; object-fit: contain }
.doodle { display: block; width: 100%; height: auto; overflow: visible }
.doodle-label { font-family: var(--display); font-weight: 700 }
.block:has(> .end) { flex: 1; display: flex }
.end { display: flex; flex-direction: column; gap: calc(2 * var(--u)); align-items: center; justify-content: center; flex: 1; min-width: 0; text-align: center }
.wordmark { font-family: var(--display); font-weight: 800; font-size: calc(8 * var(--u)); line-height: 1; letter-spacing: -0.03em; margin: 0; white-space: nowrap; max-width: 100%; overflow: hidden; padding: .1em .12em }
.wordmark i { font-style: normal; color: var(--accent) }
.cmd { font-family: var(--mono); font-size: calc(2.2 * var(--u)); background: var(--accent); color: var(--bg); padding: calc(.6 * var(--u)) calc(1.6 * var(--u)); border-radius: 4px; font-weight: 600 }
.url { font-size: calc(1.7 * var(--u)); color: var(--muted) }
.scene-locked { justify-content: center; align-items: center; text-align: center; font-size: calc(1.8 * var(--u)); color: var(--muted) }
.scene-error { position: absolute; left: calc(2 * var(--u)); right: calc(2 * var(--u)); bottom: calc(2 * var(--u)); font-family: var(--mono); font-size: calc(1.2 * var(--u)); color: #fff; background: #b3261e; padding: calc(.8 * var(--u)) calc(1.2 * var(--u)); border-radius: 4px; white-space: pre-wrap; z-index: 9 }
:host([data-format="9:16"]) .scene { padding-top: calc(8 * var(--u)); justify-content: center }
:host([data-format="9:16"]) .cards { grid-template-columns: 1fr }
:host([data-format="9:16"]) .end .text { font-size: calc(3 * var(--u)) }
/* Read on a phone: larger, and wider than the rest of the scene. Long lines still shrink to fit. */
:host([data-format="9:16"]) .code, :host([data-format="9:16"]) .term, :host([data-format="9:16"]) .tree { font-size: calc(2 * var(--u)); margin-left: calc(-3 * var(--u)); margin-right: calc(-3 * var(--u)); padding: calc(1.6 * var(--u)) calc(1.4 * var(--u)) }
:host([data-format="9:16"]) .label { font-size: calc(1.4 * var(--u)) }
:host([data-format="1:1"]) .code, :host([data-format="1:1"]) .term, :host([data-format="1:1"]) .tree { font-size: calc(1.6 * var(--u)) }
`
