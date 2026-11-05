// Scene stylesheet. Sizes are in --u, a unit the stage sets per format (a bit
// larger on tall and square frames, whose width is smaller), so one set of
// rules fits all three shapes. The stage sets everything a scene would inherit,
// so the page around it can't change the video.
export { UNIT } from '@/core/project/project'

export const STAGE_CSS = `
.fm-stage { color-scheme: dark; position: relative; width: 100%; aspect-ratio: var(--ratio); container-type: inline-size; overflow: hidden; background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 14px; font-weight: 400; line-height: 1.5; letter-spacing: normal; text-align: left }
.fm-stage [data-scene] { position: absolute; inset: 0 }
.fm-edges { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4; pointer-events: none }
.fm-edges path { fill: none; stroke: var(--fg); stroke-opacity: .55; stroke-width: 1.5; stroke-linejoin: round }
.fm-caption { position: absolute; left: calc(6 * var(--u)); right: calc(6 * var(--u)); bottom: calc(3 * var(--u)); text-align: center; font-size: calc(1.9 * var(--u)); line-height: 1.35; text-wrap: balance; color: var(--fg); z-index: 5 }
.fm-caption span { background: color-mix(in srgb, var(--bg) 82%, transparent); padding: calc(.3 * var(--u)) calc(.8 * var(--u)); border-radius: calc(.3 * var(--u)); box-decoration-break: clone; -webkit-box-decoration-break: clone }
/* TikTok, Reels and Shorts cover the bottom of a tall video with their own buttons and text. */
.fm-caption b { font-weight: inherit }
.fm-caption b.on { color: var(--accent) }
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
.scene { position: absolute; inset: 0; isolation: isolate; padding: calc(4.5 * var(--u)) calc(6 * var(--u)) var(--below, calc(7 * var(--u))); display: flex; flex-direction: column; gap: calc(2.2 * var(--u)) }
.stack { flex: 1 0 auto; display: flex; flex-direction: column; gap: calc(2.2 * var(--u)); min-width: 0 }
/* A run or revise block on its own sits in the middle of the frame, not in its top third. */
.stack:has(> .block:only-child > :is(.run, .rev)) { justify-content: center }
.block { min-width: 0 }
.stage3d { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; display: block }
.eyebrow { font-family: var(--mono); font-size: calc(1.25 * var(--u)); letter-spacing: .14em; text-transform: uppercase; color: var(--accent) }
.headline { font-family: var(--display); font-weight: 800; font-size: calc(3.9 * var(--u)); line-height: 1.05; letter-spacing: -0.02em; margin: 0; text-wrap: balance }
.headline em { font-style: normal; color: var(--accent) }
.text { font-size: calc(1.8 * var(--u)); color: var(--muted); margin: 0; max-width: 70ch }
.code, .term, .tree { font-family: var(--mono); font-size: calc(1.3 * var(--u)); line-height: 1.55; background: var(--box); border: 1px solid var(--line); border-radius: 4px; padding: calc(1.6 * var(--u)) calc(2 * var(--u)); margin: 0; white-space: pre; overflow: hidden; font-variant-ligatures: none }
.label { display: block; font-size: calc(1.05 * var(--u)); color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin-bottom: calc(.8 * var(--u)) }
.editor { --ed-line: 1.55em; font-variant-ligatures: none; font-family: var(--mono); font-size: calc(2.2 * var(--u)); background: #1e1e1e; color: #d4d4d4; border-radius: 10px; overflow: hidden; box-shadow: 0 calc(.8 * var(--u)) calc(2.4 * var(--u)) rgb(0 0 0 / .3) }
.ed-tabs { background: #252526; display: flex; font-size: .8em }
.ed-tab { background: #1e1e1e; color: #fff; padding: .7em 1.6em; border-top: 2px solid #007acc }
.ed-tab.off { background: #2d2d2d; color: #969696; border-top-color: transparent }
.ed-view { --ed-line: 1.55em; position: relative; overflow: hidden }
.ed-scroller { display: flex; position: relative; line-height: var(--ed-line) }
.ed-current { position: absolute; left: 0; right: 0; height: var(--ed-line); background: #2a2d2e; outline: 1px solid #333 }
.ed-gutter, .ed-code { position: relative; margin: 0; font: inherit; line-height: inherit; white-space: pre }
.ed-gutter { color: #858585; text-align: right; padding: 0 1.2em 0 .8em; flex: none }
.ed-code { flex: 1 }
.ed-caret { display: inline-block; width: 2px; height: 1.2em; background: #aeafad; vertical-align: -0.25em }
.ed-caret[hidden] { visibility: hidden }
.ed-thumb { position: absolute; right: 0; width: .7em; background: rgb(121 121 121 / .4) }
.ed-thumb[hidden] { display: none }
.ed-status { display: flex; justify-content: space-between; background: #007acc; color: #fff; font-size: .7em; padding: .3em 1em }
.editor .k { color: #569cd6 } .editor .s { color: #ce9178 } .editor .c { color: #6a9955; font-style: normal } .editor .n { color: #b5cea8 } .editor .f { color: #dcdcaa }
.array { --arr-rise: calc(9.5 * var(--u)); --arr-text: 4.2; padding-top: var(--arr-rise) }
.run .array { --arr-rise: calc(4 * var(--u)); --arr-text: 2.8 }
.run .arr-row { height: calc(5.5 * var(--u)) }
.run .array .arr-note { display: none }
.arr-row { position: relative; font-size: calc(var(--arr-text) * var(--u)); height: calc(8 * var(--u)); margin-bottom: var(--arr-rise) }
.arr-cell { position: absolute; top: 0; width: calc(100% / var(--n) - .8 * var(--u)); height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-variant-ligatures: none; background: var(--box); border: calc(.25 * var(--u)) solid var(--line); border-radius: 6px; color: var(--fg) }
.arr-probe { position: absolute; left: 0; top: 0; visibility: hidden; white-space: pre }
.arr-cell.on { border-color: var(--accent); color: var(--accent); z-index: 1 }
.arr-cell.done { border-color: var(--good); color: var(--good) }
.arr-cell.dim { opacity: .25 }
.stk { display: grid; gap: calc(2 * var(--u)) }
.stk-pile { display: flex; flex-direction: column; justify-content: flex-end; gap: calc(.8 * var(--u)); min-height: calc(26 * var(--u)) }
.stk-frame { display: flex; flex-wrap: wrap; align-items: center; gap: calc(1.6 * var(--u)); padding: calc(1 * var(--u)) calc(1.6 * var(--u)); background: var(--box); border: calc(.2 * var(--u)) solid var(--line); border-radius: 6px }
.stk-frame.top { border-color: var(--accent) }
.stk-frame em { font-family: var(--mono); font-style: normal; font-size: calc(2.2 * var(--u)); color: var(--accent); min-width: 8em }
.stk-var { display: inline-flex; align-items: baseline; gap: .4em; font-family: var(--mono); font-variant-ligatures: none; font-size: calc(2.6 * var(--u)) }
.stk-var i { font-style: normal; color: var(--muted) }
.stk-var b { font-weight: 500; color: var(--fg) }
.stk-var.on b { color: var(--good) }
.run { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: calc(2.4 * var(--u)); align-items: start }
.run-main { display: grid; gap: calc(1.6 * var(--u)); min-width: 0 }
.run-side { display: grid; gap: calc(1.6 * var(--u)); min-width: 0 }
.run [data-part] { transition: none }
.run .dim { opacity: .3 }
.run-panel { background: var(--box); border: calc(.15 * var(--u)) solid var(--line); border-radius: 8px; padding: calc(1.2 * var(--u)) calc(1.6 * var(--u)) }
.run-title { font-family: var(--mono); font-size: calc(1.5 * var(--u)); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: calc(.8 * var(--u)) }
.run .stk-pile { min-height: calc(12 * var(--u)) }
.run-out { margin: 0; min-height: 3.1em; font-family: var(--mono); font-variant-ligatures: none; font-size: calc(2.2 * var(--u)); line-height: 1.55; color: var(--good); white-space: pre-wrap }
.run-more { font-family: var(--mono); font-size: calc(1.6 * var(--u)); color: var(--muted); text-align: center }
.run-items { display: flex; flex-wrap: wrap; gap: calc(.8 * var(--u)); min-height: calc(4.4 * var(--u)) }
.run-items span { font-family: var(--mono); font-size: calc(1.9 * var(--u)); padding: calc(.5 * var(--u)) calc(1.2 * var(--u)); border: calc(.15 * var(--u)) solid var(--accent); border-radius: 6px; color: var(--fg) }
/* Room after the longest line, for a ring around its end. */
.run .ed-code, .rev .ed-code { position: relative; padding-right: 1.2ch }
/* Pinned to the corner until drawn: left where the text ends, it would widen the code and shrink its font. */
.run-ring { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none }
.run-ring path { fill: none; stroke: #f2a33a; stroke-width: calc(.18 * var(--u)); stroke-linecap: round }
.run .stk-frame em { min-width: 0; margin-right: auto }
/* Beside code, the stack and output read at about the code's size, so a deep stack still fits the frame. */
.run .stk-frame { gap: calc(.4 * var(--u)) calc(1.2 * var(--u)); padding: calc(.6 * var(--u)) calc(1.2 * var(--u)) }
.run .stk-var { font-size: calc(1.8 * var(--u)) }
.run .stk-frame em { font-size: calc(1.6 * var(--u)) }
.run-out { font-size: calc(1.8 * var(--u)) }
.rev { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: calc(2.4 * var(--u)); align-items: start }
.rev-code { min-width: 0 }
.rev .ed-tabs { align-items: center }
.rev-count { margin-left: auto; padding: 0 1.2em; color: #858585 }
.rev-layers { position: relative; flex: 1 }
.rev-before { position: absolute; inset: 0 }
.rev-line { min-height: var(--ed-line) }
.rev-line.chg { background: rgb(229 83 75 / .13); box-shadow: inset .25em 0 0 #e5534b }
.rev-card { display: grid; gap: calc(1.2 * var(--u)); align-content: start }
.rev-head { display: flex; justify-content: space-between; align-items: center; gap: 1em; font-family: var(--mono); font-size: calc(1.5 * var(--u)); letter-spacing: .08em; color: var(--muted) }
.rev-head em { font-style: normal; color: var(--accent); border: calc(.15 * var(--u)) solid var(--accent); border-radius: 999px; padding: .2em .9em; letter-spacing: 0 }
.rev-card h3 { margin: 0; font-family: var(--display); font-size: calc(3.4 * var(--u)); line-height: 1.15; color: var(--fg) }
.rev-card p { margin: 0; font-size: calc(2 * var(--u)); line-height: 1.45; color: var(--muted) }
.rev-chapters { grid-column: 1 / -1; display: flex; gap: calc(1.6 * var(--u)) }
.rev-ch { flex: 1; display: grid; gap: calc(.6 * var(--u)) }
.rev-ch span { font-family: var(--mono); font-size: calc(1.4 * var(--u)); letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.rev-ch.on span { color: var(--accent) }
.rev-ch b { display: block; height: calc(.35 * var(--u)); background: var(--line); border-radius: 99px; overflow: hidden }
.rev-ch i { display: block; height: 100%; background: var(--accent) }
.arr-note { font-family: var(--display); font-size: calc(2.8 * var(--u)); text-align: center; min-height: 1.4em; color: var(--fg) }
.arr-count { font-family: var(--mono); font-size: calc(2.4 * var(--u)); text-align: center; color: var(--muted); margin-top: calc(.8 * var(--u)) }
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
.icon img, .icon canvas { display: block; width: auto; max-width: 100%; object-fit: contain }
.doodle { display: block; width: 100%; height: auto; overflow: visible }
.doodle-label { font-family: var(--display); font-weight: 700 }
.doodle-mono { font-family: var(--mono); font-weight: 500; white-space: pre; font-variant-ligatures: none }
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
:host([data-format="9:16"]) .run { grid-template-columns: minmax(0, 1fr) }
:host([data-format="9:16"]) .rev { grid-template-columns: minmax(0, 1fr) }
:host([data-format="9:16"]) .rev .editor { font-size: calc(1.45 * var(--u)) }
:host([data-format="9:16"]) .rev-card h3 { font-size: calc(3 * var(--u)) }
:host([data-format="9:16"]) .run-side { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start }
:host([data-format="9:16"]) .run .stk-pile { min-height: 0 }
:host([data-format="9:16"]) .run-panel[data-part="array"] { grid-column: 1 / -1 }
/* A panel left alone on its row, like output with no stack, takes the full width. The array always has its own row. */
:host([data-format="9:16"]) .run-side > :only-child,
:host([data-format="9:16"]) .run-side > [data-part="array"] + :last-child { grid-column: 1 / -1 }
:host([data-format="9:16"]) .run .editor { font-size: calc(1.45 * var(--u)) }
:host([data-format="9:16"]) .run, :host([data-format="9:16"]) .run-main, :host([data-format="9:16"]) .run-side { gap: calc(1.2 * var(--u)) }
:host([data-format="9:16"]) .run .arr-note { font-size: calc(2.4 * var(--u)) }
:host([data-format="9:16"]) .run .stk-frame { padding: calc(.6 * var(--u)) calc(1.2 * var(--u)) }
:host([data-format="9:16"]) .run .stk-var { font-size: calc(2 * var(--u)) }
:host([data-format="9:16"]) .run .stk-frame em { font-size: calc(1.8 * var(--u)) }
:host([data-format="9:16"]) .end .text { font-size: calc(3 * var(--u)) }
/* Read on a phone: larger, and wider than the rest of the scene. Long lines still shrink to fit. */
:host([data-format="9:16"]) .code, :host([data-format="9:16"]) .term, :host([data-format="9:16"]) .tree { font-size: calc(2 * var(--u)); margin-left: calc(-3 * var(--u)); margin-right: calc(-3 * var(--u)); padding: calc(1.6 * var(--u)) calc(1.4 * var(--u)) }
:host([data-format="9:16"]) .label { font-size: calc(1.4 * var(--u)) }
:host([data-format="1:1"]) .code, :host([data-format="1:1"]) .term, :host([data-format="1:1"]) .tree { font-size: calc(1.6 * var(--u)) }
`
