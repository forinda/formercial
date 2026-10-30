// Scene stylesheet. Sizes are in --u, a unit the stage sets per format (a bit
// larger on tall and square frames, whose width is smaller), so one set of
// rules fits all three shapes.
import type { Format } from '../core/project'

export const UNIT: Record<Format, number> = { '16:9': 1, '1:1': 1.35, '9:16': 1.85 }

export const STAGE_CSS = `
.cxc-stage { position: relative; width: 100%; aspect-ratio: var(--ratio); container-type: inline-size; overflow: hidden; background: var(--bg); color: var(--fg); font-family: var(--body) }
.cxc-stage [data-scene] { position: absolute; inset: 0 }
.cxc-caption { position: absolute; left: calc(6 * var(--u)); right: calc(6 * var(--u)); bottom: calc(3 * var(--u)); text-align: center; font-size: calc(1.9 * var(--u)); line-height: 1.35; text-wrap: balance; color: var(--fg); z-index: 5 }
.cxc-caption span { background: color-mix(in srgb, var(--bg) 82%, transparent); padding: calc(.3 * var(--u)) calc(.8 * var(--u)); border-radius: calc(.3 * var(--u)); box-decoration-break: clone; -webkit-box-decoration-break: clone }
`

export const SCENE_CSS = `
:host { display: block; overflow: hidden; background: radial-gradient(120% 90% at 85% 10%, color-mix(in srgb, var(--panel) 70%, var(--line)) 0%, transparent 55%), var(--panel) }
* { box-sizing: border-box }
.scene { position: absolute; inset: 0; padding: calc(4.5 * var(--u)) calc(6 * var(--u)) calc(7 * var(--u)); display: flex; flex-direction: column; gap: calc(2.2 * var(--u)) }
.block { min-width: 0 }
.eyebrow { font-family: var(--mono); font-size: calc(1.25 * var(--u)); letter-spacing: .14em; text-transform: uppercase; color: var(--accent) }
.headline { font-family: var(--display); font-weight: 800; font-size: calc(3.9 * var(--u)); line-height: 1.05; letter-spacing: -0.02em; margin: 0; text-wrap: balance }
.headline em { font-style: normal; color: var(--accent) }
.text { font-size: calc(1.8 * var(--u)); color: var(--muted); margin: 0; max-width: 70ch }
.code, .term, .tree { font-family: var(--mono); font-size: calc(1.3 * var(--u)); line-height: 1.55; background: color-mix(in srgb, var(--bg) 80%, black); border: 1px solid var(--line); border-radius: 4px; padding: calc(1.6 * var(--u)) calc(2 * var(--u)); margin: 0; white-space: pre; overflow: hidden }
.label { display: block; font-size: calc(1.05 * var(--u)); color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin-bottom: calc(.8 * var(--u)) }
.caret { display: inline-block; width: .6em; height: 1.1em; background: var(--accent); vertical-align: -0.2em }
.k { color: #c9a8ff } .s { color: var(--good) } .c { color: var(--muted); font-style: italic } .n { color: var(--accent) } .f { color: #8ec5ff }
.prompt { color: var(--accent) } .ok { color: var(--good) } .bad { color: var(--bad) }
.tree { line-height: 1.75 }
.tree .dir { color: var(--muted) }
.stamp { display: inline-block; font-family: var(--display); font-weight: 800; font-size: calc(2.6 * var(--u)); letter-spacing: .04em; padding: calc(.6 * var(--u)) calc(1.6 * var(--u)); border: calc(.35 * var(--u)) solid currentColor; border-radius: 4px; transform: rotate(-4deg) }
.stamp.good { color: var(--good) } .stamp.bad { color: var(--bad) }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(22 * var(--u)), 1fr)); gap: calc(1.6 * var(--u)) }
.card { border: 1px solid var(--line); border-radius: 4px; padding: calc(1.4 * var(--u)) calc(1.6 * var(--u)); background: color-mix(in srgb, var(--bg) 80%, black) }
.card strong { display: block; font-family: var(--display); font-size: calc(2 * var(--u)); font-weight: 700 }
.card span { font-family: var(--mono); font-size: calc(1.25 * var(--u)); color: var(--muted) }
.chips { display: flex; flex-wrap: wrap; gap: calc(1 * var(--u)); align-items: center; font-size: calc(1.6 * var(--u)) }
.chips b { font-weight: 500; color: var(--muted); margin-right: calc(.6 * var(--u)) }
.chips span { border: 1px solid var(--accent); color: var(--accent); border-radius: 99px; padding: calc(.3 * var(--u)) calc(1.4 * var(--u)); font-family: var(--mono); font-size: calc(1.35 * var(--u)) }
.end { display: flex; flex-direction: column; gap: calc(2 * var(--u)); align-items: flex-start; justify-content: center; flex: 1 }
.wordmark { font-family: var(--display); font-weight: 800; font-size: calc(8 * var(--u)); line-height: 1; letter-spacing: -0.03em; margin: 0; white-space: nowrap; max-width: 100%; overflow: hidden }
.wordmark i { font-style: normal; color: var(--accent) }
.cmd { font-family: var(--mono); font-size: calc(2.2 * var(--u)); background: var(--accent); color: var(--bg); padding: calc(.6 * var(--u)) calc(1.6 * var(--u)); border-radius: 4px; font-weight: 600 }
.url { font-size: calc(1.7 * var(--u)); color: var(--muted) }
.scene-locked { justify-content: center; align-items: center; text-align: center; font-size: calc(1.8 * var(--u)); color: var(--muted) }
.scene-error { position: absolute; left: calc(2 * var(--u)); right: calc(2 * var(--u)); bottom: calc(2 * var(--u)); font-family: var(--mono); font-size: calc(1.2 * var(--u)); color: #fff; background: #b3261e; padding: calc(.8 * var(--u)) calc(1.2 * var(--u)); border-radius: 4px; white-space: pre-wrap; z-index: 9 }
:host([data-format="9:16"]) .scene { padding-top: calc(8 * var(--u)); justify-content: center }
:host([data-format="9:16"]) .cards { grid-template-columns: 1fr }
`
