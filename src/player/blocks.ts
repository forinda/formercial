// The built-in blocks. Each one builds its DOM once and returns a draw(local)
// that sets everything from the scene's local time, so the same time always
// draws the same frame.
import type { Block, Format, Theme } from '@/core/project/project'
import { doodleArt } from '@/core/project/doodle-layout'
import { esc, highlight, terminal } from './highlight'
import { stage3dLength } from './stage3d/timeline'

export type BlockCtx = {
  theme: Theme
  format: Format
  width: number
  height: number
  fileUrl(path: string): string
  /** Hold the first frame until this image is ready; a missing one fails the render. */
  load(path: string, img: HTMLImageElement): void
  /** Hold the first frame until this work is done; a failure fails the render, under `name`. */
  wait(name: string, work: Promise<void>): void
  onDestroy(fn: () => void): void
}
type Of<T extends Block['type']> = Extract<Block, { type: T }>
export interface BlockDef<B extends Block> {
  needs(b: B): number
  mount(root: HTMLElement, b: B, ctx: BlockCtx): (local: number) => void
  /** Fills the whole scene behind the other blocks, instead of taking a place in the stack. */
  bleed?: true
}

const REVEAL = 0.4
const DEFAULT_CPS = 34
const clamp = (x: number) => Math.min(1, Math.max(0, x))

/** Fade and lift in over REVEAL seconds from `at`. */
export function reveal(el: HTMLElement, since: number) {
  const r = clamp(since / REVEAL)
  const eased = 1 - (1 - r) ** 3
  el.style.opacity = String(Math.round(eased * 1000) / 1000)
  el.style.transform =
    r >= 1 ? '' : `translateY(calc(${Math.round((1 - eased) * 1000) / 1000} * 1.2 * var(--u)))`
}

/** Shrink an element's font until its content fits its width; once, when first visible. */
export function fitOnce(el: HTMLElement): (() => void) & { done: boolean } {
  let done = false
  const fit = () => {
    // Measure with the real fonts: a fallback font would size it wrong for good.
    if (done || !el.clientWidth || document.fonts?.status === 'loading') return
    done = true
    let size = parseFloat(getComputedStyle(el).fontSize)
    // Enough steps to reach about 14% of the size, so no line stays clipped.
    for (let i = 0; i < 32 && el.scrollWidth > el.clientWidth + 1; i++) {
      size *= 0.94
      el.style.fontSize = `${size}px`
    }
  }
  return Object.defineProperty(fit, 'done', { get: () => done }) as typeof fit & { done: boolean }
}

const el = (tag: string, cls: string, html = '') => {
  const e = document.createElement(tag)
  e.className = cls
  e.innerHTML = html
  return e
}

function typer(
  label: string | undefined,
  source: string,
  cps: number,
  paint: (s: string) => string,
  cls: string,
) {
  return (root: HTMLElement, at: number) => {
    const box = el('pre', cls)
    if (label) box.append(el('span', 'label', esc(label)))
    const typed = el('span', 'typed')
    const caret = el('span', 'caret')
    box.append(typed, caret)
    root.append(box)
    const fit = fitOnce(box)
    let shown = -1
    return (local: number) => {
      // Measure with the whole text in place, so the font fits the longest line.
      if (!fit.done) {
        typed.innerHTML = paint(source)
        fit()
        shown = -1
      }
      const n = Math.max(0, Math.min(source.length, Math.floor((local - at) * cps)))
      if (n !== shown) {
        typed.innerHTML = paint(source.slice(0, n))
        shown = n
      }
      caret.hidden = n >= source.length || local < at
    }
  }
}

const typing = (b: { at?: number; source: string; cps?: number }) =>
  (b.at ?? 0) + b.source.length / (b.cps ?? DEFAULT_CPS)

type ArrayBlock = Of<'array'>

/** How much to scale text measured at `widest` so it fits a cell's inner width, with a margin. Never grows. */
export function arrayTextScale(inner: number, widest: number) {
  if (!(widest > 0) || !(inner > 0)) return 1
  return Math.round(Math.min(1, (inner * 0.9) / widest) * 1000) / 1000
}

/** When each step of an array block starts and ends: in order, unless one says otherwise. */
export function arrayTimes(b: ArrayBlock): { start: number; end: number }[] {
  let clock = b.at ?? 0
  return b.steps.map((step) => {
    const start = step.at ?? clock
    clock = start + step.seconds
    return { start, end: clock }
  })
}

/**
 * Where everything in an array block is at a time: a pure function of it, so
 * any frame can be drawn first. `x` is a slot, which may be between two; `y` is
 * how far above the row, in the row's heights, and negative is below.
 */
export function arrayView(b: ArrayBlock, time: number) {
  const items = b.values.map((value, i) => ({
    value,
    x: i,
    y: 0,
    done: false,
    active: false,
    dim: false,
  }))
  const slots: (number | null)[] = items.map((_, i) => i)
  const times = arrayTimes(b)
  let held: number | null = null
  let compares = 0
  let note = ''
  b.steps.forEach((step, n) => {
    const { start, end } = times[n]
    if (time < start) return
    const p = end > start ? clamp((time - start) / (end - start)) : 1
    const eased = p * p * (3 - 2 * p)
    const arc = Math.sin(Math.PI * p)
    const moving = p < 1
    const at = (slot: number) => slots[slot] ?? null
    // Past the row is nothing, however far a step asks to go.
    const last = Math.min(step.b ?? step.a, slots.length - 1)
    const a = at(step.a)
    const c = step.b === undefined ? null : at(step.b)
    if (step.note) note = step.note
    switch (step.do) {
      case 'compare':
        compares++
        for (const i of [a, c]) if (i !== null && moving) items[i].active = true
        break
      case 'swap':
        if (a === null || c === null) break
        items[a].x = step.a + (step.b! - step.a) * eased
        items[c].x = step.b! + (step.a - step.b!) * eased
        items[a].y = arc
        items[c].y = -arc
        items[a].active = items[c].active = moving
        if (!moving) {
          slots[step.a] = c
          slots[step.b!] = a
        }
        break
      case 'lift':
        if (a === null) break
        items[a].y = eased
        items[a].active = true
        if (!moving) {
          held = a
          slots[step.a] = null
        }
        break
      case 'shift':
        if (a === null || step.b === undefined || step.b >= slots.length || slots[step.b] !== null)
          break
        items[a].x = step.a + (step.b - step.a) * eased
        items[a].active = moving
        if (!moving) {
          slots[step.b] = a
          slots[step.a] = null
        }
        break
      case 'drop':
        if (held === null || step.a >= slots.length || slots[step.a] !== null) break
        items[held].x = items[held].x + (step.a - items[held].x) * eased
        items[held].y = 1 - eased
        items[held].active = moving
        if (!moving) {
          slots[step.a] = held
          held = null
        }
        break
      case 'dim':
        for (let s = step.a; s <= last; s++) {
          const i = at(s)
          if (i !== null) items[i].dim = true
        }
        break
      case 'mark':
        for (let s = step.a; s <= last; s++) {
          const i = at(s)
          if (i !== null) items[i].done = true
        }
        break
    }
  })
  const round = (n: number) => Math.round(n * 1000) / 1000
  return { items: items.map((it) => ({ ...it, x: round(it.x), y: round(it.y) })), compares, note }
}

type StackBlock = Of<'stack'>

function stepTimes(b: { at?: number; steps: { at?: number; seconds: number }[] }) {
  let clock = b.at ?? 0
  return b.steps.map((step) => {
    const start = step.at ?? clock
    clock = start + step.seconds
    return { start, end: clock }
  })
}

/** The call stack at a time, bottom frame first: a pure function of it. */
export function stackView(b: StackBlock, time: number) {
  const frames: {
    name: string
    vars: Record<string, string | number>
    changed: string
    opacity: number
  }[] = []
  let note = ''
  const times = stepTimes(b)
  b.steps.forEach((step, n) => {
    const { start, end } = times[n]
    if (time < start) return
    const p = end > start ? clamp((time - start) / (end - start)) : 1
    if (step.note) note = step.note
    for (const f of frames) f.changed = ''
    if (step.do === 'push') {
      frames.push({ name: step.name ?? '', vars: { ...step.vars }, changed: '', opacity: p })
    } else if (step.do === 'pop') {
      const top = frames[frames.length - 1]
      if (!top) return
      if (p < 1) top.opacity = 1 - p
      else frames.pop()
    } else if (step.do === 'set' && step.name) {
      const f = frames[frames.length - 1 - step.frame]
      if (f) {
        f.vars[step.name] = step.value ?? ''
        if (p < 1) f.changed = step.name
      }
    }
  })
  return { frames, note }
}

const SCROLL_SECONDS = 0.22
const LANG_NAMES = {
  ts: 'TypeScript',
  js: 'JavaScript',
  py: 'Python',
  c: 'C',
  java: 'Java',
  sql: 'SQL',
  json: 'JSON',
  plain: 'Plain Text',
}

/** What an editor shows at a time: a pure function of it, so any frame can be drawn first. */
export function editorView(source: string, rows: number, cps: number, since: number) {
  const typed = Math.max(0, Math.min(source.length, Math.floor(since * cps)))
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  const before = source.slice(0, typed)
  const line = before.split('\n').length - 1
  // Each line past the last row moves the view up one row, done by the time the caret reaches it.
  let scroll = 0
  for (let k = rows; k < starts.length; k++) {
    const r = clamp((since - starts[k] / cps + SCROLL_SECONDS) / SCROLL_SECONDS)
    scroll += 1 - (1 - r) ** 3
  }
  return {
    typed,
    line,
    col: typed - starts[line],
    scroll: Math.round(scroll * 1000) / 1000,
    lines: starts.length,
  }
}

type RunBlock = Of<'run'>
type Fading = { text: string; opacity: number; going?: boolean }

const ease = (x: number) => 1 - (1 - clamp(x)) ** 3

/** Everything a run block shows at a time: a pure function of it, like the other step blocks. */
/** A run block's tabs: the first is its `file` and `source`. */
export const runTabs = (b: RunBlock) => [{ name: b.file, source: b.source }, ...b.files]

export function runView(b: RunBlock, time: number) {
  const tabs = runTabs(b)
  const totals = tabs.map((t) => t.source.split('\n').length)
  let tab = 0
  const frames: { name: string; vars: Record<string, string | number>; opacity: number }[] = []
  const leaving: typeof frames = []
  const output: Fading[] = []
  const boxes: Record<string, Fading[]> = Object.fromEntries(b.boxes.map((x) => [x.id, []]))
  let line = 0
  let scroll = 0
  // Set inside the forEach below, which TypeScript can't follow, hence the casts.
  let focus = null as string[] | null
  let ring = null as { line: number; text: string; p: number } | null
  let changed: string[] = []
  let note = ''
  const target = (n: number) =>
    Math.max(0, Math.min(totals[tab] - b.rows, n - 1 - Math.floor(b.rows / 2)))
  const times = stepTimes(b)
  b.steps.forEach((step, n) => {
    const { start, end } = times[n]
    if (time < start) return
    const p = end > start ? clamp((time - start) / (end - start)) : 1
    // Highlights belong to the step running now; the state they leave stays.
    leaving.length = 0
    changed = []
    ring = null
    for (const id in boxes) boxes[id] = boxes[id].filter((x) => !x.going)
    if (step.pop && frames.length) {
      const top = frames.pop()!
      if (p < 1) leaving.push({ ...top, opacity: 1 - p })
    }
    if (step.push) frames.push({ name: step.push, vars: { ...step.vars }, opacity: p })
    const top = frames[frames.length - 1]
    if (step.set && top) {
      Object.assign(top.vars, step.set)
      changed = Object.keys(step.set)
    }
    if (step.print !== undefined) output.push({ text: step.print, opacity: p })
    if (step.add && boxes[step.add.box])
      boxes[step.add.box].push({ text: step.add.item, opacity: p })
    if (step.take && boxes[step.take.box]) {
      const list = boxes[step.take.box]
      const item = step.take.item
      const i = item === undefined ? 0 : list.findIndex((x) => x.text === item)
      // It fades out during this step and is gone by the next.
      if (list[i]) {
        if (p < 1) list[i] = { ...list[i], opacity: 1 - p, going: true }
        else list.splice(i, 1)
      }
    }
    if (step.focus) focus = step.focus.length ? step.focus : null
    // A new tab starts with no line and at its top; the view doesn't glide from the old one.
    const found = step.file === undefined ? -1 : tabs.findIndex((t) => t.name === step.file)
    if (found >= 0 && found !== tab) {
      tab = found
      line = 0
      scroll = 0
    }
    if (step.line !== undefined) {
      const from = target(line || step.line)
      scroll = from + (target(step.line) - from) * ease((time - start) / SCROLL_SECONDS)
      line = step.line
    }
    if (step.ring && line) ring = { line, text: step.ring, p }
    if (step.note) note = step.note
  })
  const round = (x: number) => Math.round(x * 1000) / 1000
  return {
    tab,
    line,
    scroll: round(scroll),
    frames: [...frames, ...leaving].map((f) => ({ ...f, opacity: round(f.opacity) })),
    changed,
    output: output.map((o) => ({ ...o, opacity: round(o.opacity) })),
    boxes: Object.fromEntries(
      Object.entries(boxes).map(([id, list]) => [
        id,
        list.map((x) => ({ text: x.text, opacity: round(x.opacity) })),
      ]),
    ),
    focus,
    ring,
    note,
  }
}

type ReviseBlock = Of<'revise'>

/** Lines of `next` that aren't in a longest common run of lines with `prev`: what a step changed. */
export function changedLines(prev: string[], next: string[]): number[] {
  const n = prev.length
  const m = next.length
  // ponytail: O(n*m) table, fine for code that fits on screen.
  const len = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i][j] =
        prev[i] === next[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1])
    }
  }
  const kept = new Set<number>()
  for (let i = 0, j = 0; i < n && j < m;) {
    if (prev[i] === next[j]) {
      kept.add(j)
      i++
      j++
    } else if (len[i + 1][j] >= len[i][j + 1]) i++
    else j++
  }
  return next.flatMap((_, j) => (kept.has(j) ? [] : [j]))
}

// Each step's changed lines depend only on the block, so they're worked out once, not per frame.
const reviseDiffs = new WeakMap<ReviseBlock, { lines: string[][]; changed: number[][] }>()
function diffsOf(b: ReviseBlock) {
  let d = reviseDiffs.get(b)
  if (!d) {
    const lines = b.steps.map((step) => step.source.split('\n'))
    d = { lines, changed: lines.map((l, i) => (i ? changedLines(lines[i - 1], l) : [])) }
    reviseDiffs.set(b, d)
  }
  return d
}

/** What a revise block shows at a time: a pure function of it. */
export function reviseView(b: ReviseBlock, time: number) {
  const times = stepTimes(b)
  let k = 0
  times.forEach((t, i) => {
    if (time >= t.start) k = i
  })
  const { start, end } = times[k]
  const p = time < start ? 0 : end > start ? clamp((time - start) / (end - start)) : 1
  const { lines, changed: diffs } = diffsOf(b)
  const changed = diffs[k]
  let chapter = 0
  const chapterOf = b.steps.map((step) => (chapter = step.chapter ?? chapter))
  const card = b.steps
    .slice(0, k + 1)
    .reduce<ReviseBlock['steps'][number]['card']>((last, step) => step.card ?? last, undefined)
  const fills = b.chapters.map((_, c) => {
    const mine = chapterOf.flatMap((x, i) => (x === c ? [i] : []))
    const done = mine.reduce((sum, i) => sum + (i < k ? 1 : i === k ? p : 0), 0)
    return Math.round((done / Math.max(1, mine.length)) * 1000) / 1000
  })
  // Keep the line that matters in view: the ringed one, else the first changed one.
  const focus = (i: number) => {
    const step = b.steps[i]
    const first = diffs[i][0]
    const line = step.ring?.line ?? (first === undefined ? 1 : first + 1)
    return Math.max(0, Math.min(lines[i].length - b.rows, line - 1 - Math.floor(b.rows / 2)))
  }
  const from = k ? focus(k - 1) : focus(0)
  const scroll = from + (focus(k) - from) * ease((time - start) / SCROLL_SECONDS)
  const ring = b.steps[k].ring
  return {
    step: k,
    p: Math.round(p * 1000) / 1000,
    changed,
    chapter: chapterOf[k],
    card,
    cardIsNew: !!b.steps[k].card,
    fills,
    scroll: Math.round(scroll * 1000) / 1000,
    ring: ring ? { ...ring, col: lines[k][ring.line - 1].indexOf(ring.text) } : null,
  }
}

/** Frames a run block's stack shows before it counts the rest. */
const RUN_FRAMES = 4

/** A loose hand-drawn loop around a w by h box, open where the pen lifts. */
export function ringPath(w: number, h: number) {
  const pts = [10, 24, 6, 6, 90, 2, 95, 18, 99, 34, 18, 40, 6, 26, 2, 16, 22, 8, 38, 7]
  // Curves fall short of their control points, so x is spread 12% to reach the box's ends.
  const at = pts.map(
    (v, i) => Math.round((i % 2 ? (v * h) / 40 : ((50 + (v - 50) * 1.12) * w) / 100) * 10) / 10,
  )
  const pair = (i: number) => `${at[i]} ${at[i + 1]}`
  return `M${pair(0)} C${pair(2)} ${pair(4)} ${pair(6)} C${pair(8)} ${pair(10)} ${pair(12)} C${pair(14)} ${pair(16)} ${pair(18)}`
}

const SVG = 'http://www.w3.org/2000/svg'
const svg = (tag: string, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}
type DoodleItem = Of<'doodle'>['strokes'][number]

/** When each item of a doodle starts and ends: in order, unless one says otherwise. */
export function doodleTimes(
  strokes: Of<'doodle'>['strokes'],
  at = 0,
): { start: number; end: number }[] {
  let clock = at
  return strokes.map((item) => {
    const start = item.at ?? clock
    clock = start + item.seconds
    return { start, end: clock }
  })
}

/** A marker pen with its tip at 0,0, in the doodle's coordinates. */
const PEN: Record<string, string | number>[] = [
  { d: 'M-13 -46 L-7 -16 L0 0 L7 -16 L13 -46 Z', fill: 'var(--panel)' },
  { d: 'M-5 -11 L0 0 L5 -11 Z', fill: 'var(--fg)' },
  { d: 'M-14 -46 H14 V-58 H-14 Z', fill: 'var(--fg)' },
  { d: 'M-14 -58 H14 V-158 Q14 -170 0 -170 Q-14 -170 -14 -158 Z', fill: 'var(--accent)' },
  {
    d: 'M-6 -66 V-152',
    fill: 'none',
    stroke: 'var(--panel)',
    'stroke-width': 4,
    'stroke-linecap': 'round',
    opacity: 0.55,
  },
]

function mountStroke(
  parts: { ink: Element; dots: Element },
  item: Extract<DoodleItem, { d: string }>,
) {
  const path = svg('path', {
    d: item.d,
    fill: 'none',
    stroke: `var(--${item.tone})`,
    'stroke-width': item.width,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    // Dashes measured as a share of the path, however long it is.
    pathLength: 1,
    'stroke-dasharray': '1 1',
  }) as SVGPathElement
  const fill = item.fill
    ? svg('path', { d: item.d, fill: `var(--${item.fill})`, stroke: 'none' })
    : null
  if (fill) parts.ink.append(fill)
  parts.ink.append(path)
  const flow = item.flow
  const dots = flow
    ? Array.from({ length: flow.count }, () =>
        svg('circle', { r: flow.size, fill: `var(--${flow.tone})` }),
      )
    : []
  parts.dots.append(...dots)
  return { path, fill, dots, flow }
}

/**
 * A hand-drawn ring over mono code, inside `text`. Mono text makes a column 1ch,
 * measured once per draw from a probe; offsetWidth, not the on-screen box, so a
 * transition's scale doesn't move it.
 */
function codeRing(text: HTMLElement) {
  const ring = svg('svg', { class: 'run-ring' })
  const loop = svg('path', { pathLength: 1, 'stroke-dasharray': '1 1' })
  ring.append(loop)
  const probe = el('span', 'arr-probe', '0000000000')
  text.append(ring, probe)
  /** Line from 1, column from 0; hidden when `at` is null. */
  const draw = (at: { line: number; col: number; length: number; p: number } | null) => {
    ring.style.visibility = at ? 'visible' : 'hidden'
    if (!at) return
    const ch = probe.offsetWidth / 10
    const row = parseFloat(getComputedStyle(text).lineHeight)
    const w = Math.round((at.length + 1.6) * ch)
    const h = Math.round(row * 1.35)
    ring.setAttribute('width', String(w))
    ring.setAttribute('height', String(h))
    ring.setAttribute('viewBox', `0 0 ${w} ${h}`)
    ring.style.left = `${Math.round((at.col - 0.8) * ch)}px`
    ring.style.top = `${Math.round((at.line - 1) * row - row * 0.18)}px`
    loop.setAttribute('d', ringPath(w, h))
    loop.setAttribute('stroke-dashoffset', String(Math.round((1 - at.p) * 1000) / 1000))
  }
  /** Put the ring back after `text`'s contents are replaced. */
  draw.attach = () => text.append(ring, probe)
  return draw
}

export const BLOCKS: { [T in Block['type']]: BlockDef<Of<T>> } = {
  eyebrow: {
    needs: (b) => (b.at ?? 0) + REVEAL,
    mount: (root, b) => (root.append(el('div', 'eyebrow', esc(b.text))), () => {}),
  },
  headline: {
    needs: (b) => (b.at ?? 0) + REVEAL,
    mount(root, b) {
      const text = esc(b.text)
      const accent = b.accent ? esc(b.accent) : ''
      const i = accent ? text.lastIndexOf(accent) : -1
      const html =
        i < 0 ? text : `${text.slice(0, i)}<em>${accent}</em>${text.slice(i + accent.length)}`
      root.append(el('h2', 'headline', html))
      return () => {}
    },
  },
  text: {
    needs: (b) => (b.at ?? 0) + REVEAL,
    mount: (root, b) => (root.append(el('p', 'text', esc(b.text))), () => {}),
  },
  code: {
    needs: typing,
    mount: (root, b) =>
      typer(
        b.label,
        b.source,
        b.cps ?? DEFAULT_CPS,
        (s) => highlight(b.lang, s),
        'code',
      )(root, b.at ?? 0),
  },
  editor: {
    needs: typing,
    mount(root, b) {
      const at = b.at ?? 0
      const cps = b.cps ?? DEFAULT_CPS
      const box = el('div', 'editor')
      const tabs = el('div', 'ed-tabs')
      tabs.append(el('span', 'ed-tab', esc(b.file)))
      const view = el('div', 'ed-view')
      view.style.height = `calc(${b.rows} * var(--ed-line))`
      const scroller = el('div', 'ed-scroller')
      const current = el('div', 'ed-current')
      const gutter = el('pre', 'ed-gutter')
      const code = el('pre', 'ed-code')
      const typed = el('span', 'typed')
      const caret = el('span', 'ed-caret')
      code.append(typed, caret)
      scroller.append(current, gutter, code)
      const thumb = el('div', 'ed-thumb')
      view.append(scroller, thumb)
      const position = el('span', '')
      const status = el('div', 'ed-status')
      status.append(position, el('span', '', `Spaces: 4 &nbsp; UTF-8 &nbsp; ${LANG_NAMES[b.lang]}`))
      box.append(tabs, view, status)
      root.append(box)

      const total = b.source.split('\n').length
      const numbers = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join('\n')
      gutter.style.minWidth = `${String(total).length + 1}ch`
      // The font scales this, so rows, numbers and scrolling stay in step.
      const fit = fitOnce(view)
      let shown = -1
      let shownLine = -1
      return (local) => {
        if (!fit.done) {
          typed.innerHTML = highlight(b.lang, b.source)
          fit()
          shown = -1
        }
        const v = editorView(b.source, b.rows, cps, local - at)
        if (v.typed !== shown) {
          typed.innerHTML = highlight(b.lang, b.source.slice(0, v.typed))
          position.textContent = `Ln ${v.line + 1}, Col ${v.col + 1}`
          shown = v.typed
        }
        if (v.line !== shownLine) {
          gutter.textContent = numbers(v.line + 1)
          current.style.top = `calc(${v.line} * var(--ed-line))`
          shownLine = v.line
        }
        scroller.style.transform = `translateY(calc(${-v.scroll} * var(--ed-line)))`
        const hidden = Math.max(0, total - b.rows)
        thumb.hidden = !hidden
        thumb.style.height = `${(b.rows / total) * 100}%`
        thumb.style.top = `${(v.scroll / (hidden || 1)) * (100 - (b.rows / total) * 100)}%`
        // Solid while typing, then a steady blink.
        caret.hidden = local < at || (v.typed >= b.source.length && Math.floor(local * 2) % 2 === 1)
      }
    },
  },
  stack: {
    needs: (b) => Math.max(b.at ?? 0, ...stepTimes(b).map((t) => t.end)),
    mount(root, b) {
      const box = el('div', 'stk')
      const pile = el('div', 'stk-pile')
      const note = el('div', 'arr-note')
      box.append(pile, note)
      root.append(box)
      let shown = ''
      return (local) => {
        const view = stackView(b, local)
        const html = view.frames
          .map((f, i) => {
            const vars = Object.entries(f.vars)
              .map(
                ([k, v]) =>
                  `<span class="stk-var${f.changed === k ? ' on' : ''}"><i>${esc(k)}</i><b>${esc(String(v))}</b></span>`,
              )
              .join('')
            const top = i === view.frames.length - 1 ? ' top' : ''
            return `<div class="stk-frame${top}" style="opacity:${Math.round(f.opacity * 100) / 100}"><em>${esc(f.name)}</em>${vars}</div>`
          })
          .reverse()
          .join('')
        if (html !== shown) {
          pile.innerHTML = html
          shown = html
        }
        note.textContent = view.note
      }
    },
  },
  run: {
    needs: (b) => Math.max(b.at ?? 0, ...stepTimes(b).map((t) => t.end)),
    mount(root, b, ctx) {
      const box = el('div', 'run')
      const code = el('div', 'editor run-code')
      code.dataset.part = 'code'
      const files = runTabs(b)
      const tabs = el('div', 'ed-tabs')
      const tabEls = files.map((f) => el('span', 'ed-tab', esc(f.name)))
      tabs.append(...tabEls)
      const view = el('div', 'ed-view')
      view.style.height = `calc(${b.rows} * var(--ed-line))`
      const scroller = el('div', 'ed-scroller')
      const current = el('div', 'ed-current')
      const gutter = el('pre', 'ed-gutter')
      const text = el('pre', 'ed-code')
      const drawRing = codeRing(text)
      // Shows a tab's code; the ring goes back in after the code is replaced.
      const showTab = (source: string) => {
        const lines = source.split('\n').length
        gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n')
        gutter.style.minWidth = `${String(lines).length + 1}ch`
        text.innerHTML = highlight(b.lang, source)
        drawRing.attach()
      }
      // Fitted once to the longest line of any tab, so switching never changes the size.
      const widest = files.reduce((w, f) =>
        Math.max(...f.source.split('\n').map((l) => l.length)) >
        Math.max(...w.source.split('\n').map((l) => l.length))
          ? f
          : w,
      )
      showTab(widest.source)
      scroller.append(current, gutter, text)
      view.append(scroller)
      const position = el('span', '')
      const status = el('div', 'ed-status')
      status.append(position, el('span', '', `UTF-8 &nbsp; ${LANG_NAMES[b.lang]}`))
      code.append(tabs, view, status)
      const note = el('div', 'arr-note run-note')
      const left = el('div', 'run-main')
      left.append(code, note)

      const side = el('div', 'run-side')
      const panel = (part: string, title: string, body: HTMLElement) => {
        const p = el('div', 'run-panel')
        p.dataset.part = part
        p.append(el('div', 'run-title', esc(title)), body)
        side.append(p)
        return p
      }
      // The values reuse the array block whole, driven by the steps' moves at the steps' times.
      let moveValues: ((local: number) => void) | null = null
      if (b.values) {
        const times = stepTimes(b)
        const moves: ArrayBlock = {
          type: 'array',
          count: false,
          values: b.values,
          steps: b.steps.flatMap((step, n) =>
            step.array
              ? [{ ...step.array, at: times[n].start, seconds: times[n].end - times[n].start }]
              : [],
          ),
        }
        const body = el('div', '')
        panel('array', 'Values', body)
        moveValues = BLOCKS.array.mount(body, moves, ctx)
      }
      const pile = el('div', 'stk-pile')
      const out = el('pre', 'run-out')
      if (b.panels.includes('stack')) panel('stack', 'Stack', pile)
      if (b.panels.includes('output')) panel('output', 'Output', out)
      const chips = Object.fromEntries(
        b.boxes.map((x) => [x.id, panel(x.id, x.label, el('div', 'run-items')).lastElementChild!]),
      )
      box.append(left, side)
      root.append(box)

      const fit = fitOnce(view)
      let shownTab = -1
      const shown: Record<string, string> = {}
      const put = (key: string, target: Element, html: string) => {
        if (shown[key] === html) return
        target.innerHTML = html
        shown[key] = html
      }
      const fade = (o: number) => (o < 1 ? ` style="opacity:${o}"` : '')
      return (local) => {
        if (!fit.done) {
          showTab(widest.source)
          fit()
          shownTab = -1
        }
        moveValues?.(local)
        const v = runView(b, local)
        if (v.tab !== shownTab) {
          showTab(files[v.tab].source)
          tabEls.forEach((t, i) => t.classList.toggle('off', i !== v.tab))
          shownTab = v.tab
        }
        current.hidden = !v.line
        current.style.top = `calc(${v.line - 1} * var(--ed-line))`
        scroller.style.transform = `translateY(calc(${-v.scroll} * var(--ed-line)))`
        position.textContent = v.line ? `Ln ${v.line}` : ''
        const col = v.ring
          ? (files[v.tab].source.split('\n')[v.ring.line - 1] ?? '').indexOf(v.ring.text)
          : -1
        drawRing(
          v.ring && col >= 0
            ? { line: v.ring.line, col, length: v.ring.text.length, p: v.ring.p }
            : null,
        )
        // Deep recursion: the top frames, and a count of the rest.
        const hidden = Math.max(0, v.frames.length - RUN_FRAMES)
        put(
          'stack',
          pile,
          v.frames
            .map((f, i) => {
              if (i < hidden)
                return i === hidden - 1 ? `<div class="run-more">+${hidden} more</div>` : ''
              const top = i === v.frames.length - 1 && f.opacity === 1 ? ' top' : ''
              const vars = Object.entries(f.vars)
                .map(
                  ([k, val]) =>
                    `<span class="stk-var${top && v.changed.includes(k) ? ' on' : ''}"><i>${esc(k)}</i><b>${esc(String(val))}</b></span>`,
                )
                .join('')
              return `<div class="stk-frame${top}"${fade(f.opacity)}><em>${esc(f.name)}</em>${vars}</div>`
            })
            .reverse()
            .join(''),
        )
        put(
          'out',
          out,
          v.output.map((o) => `<span${fade(o.opacity)}>${esc(o.text)}\n</span>`).join(''),
        )
        for (const [id, list] of Object.entries(v.boxes)) {
          put(
            id,
            chips[id],
            list.map((x) => `<span${fade(x.opacity)}>${esc(x.text)}</span>`).join(''),
          )
        }
        for (const part of box.querySelectorAll<HTMLElement>('[data-part]')) {
          part.classList.toggle('dim', !!v.focus && !v.focus.includes(part.dataset.part!))
        }
        note.textContent = v.note
      }
    },
  },
  revise: {
    needs: (b) => Math.max(b.at ?? 0, ...stepTimes(b).map((t) => t.end)),
    mount(root, b) {
      const box = el('div', 'rev')
      const code = el('div', 'editor rev-code')
      const tabs = el('div', 'ed-tabs')
      const count = el('span', 'rev-count')
      tabs.append(el('span', 'ed-tab', esc(b.file)), count)
      const view = el('div', 'ed-view')
      view.style.height = `calc(${b.rows} * var(--ed-line))`
      const scroller = el('div', 'ed-scroller')
      const gutter = el('pre', 'ed-gutter')
      const layers = el('div', 'rev-layers')
      const before = el('pre', 'ed-code rev-before')
      const after = el('pre', 'ed-code')
      layers.append(after, before)
      const drawRing = codeRing(after)
      scroller.append(gutter, layers)
      view.append(scroller)
      code.append(tabs, view)
      const card = el('div', 'rev-card')
      const chapters = el('div', 'rev-chapters')
      const bars = b.chapters.map((name) => {
        const ch = el('div', 'rev-ch')
        const fill = el('i', '')
        const bar = el('b', '')
        bar.append(fill)
        ch.append(el('span', '', esc(name)), bar)
        chapters.append(ch)
        return { ch, fill }
      })
      box.append(code, card)
      if (bars.length) box.append(chapters)
      root.append(box)

      const html = (source: string, changed: number[] = []) =>
        source
          .split('\n')
          .map(
            (line, i) =>
              `<div class="rev-line${changed.includes(i) ? ' chg' : ''}">${highlight(b.lang, line) || ' '}</div>`,
          )
          .join('')
      const steps = b.steps.length
      const pad = (n: number) => String(n).padStart(2, '0')
      // Sized once against the widest version, so the font holds still across steps.
      const widest = b.steps.reduce(
        (w, step) => Math.max(w, ...step.source.split('\n').map((l) => l.length)),
        0,
      )
      const fit = fitOnce(view)
      let shown = -1
      return (local) => {
        if (!fit.done) {
          after.innerHTML = html('0'.repeat(widest))
          drawRing.attach()
          fit()
          shown = -1
        }
        const v = reviseView(b, local)
        if (v.step !== shown) {
          const source = b.steps[v.step].source
          const lines = source.split('\n').length
          after.innerHTML = html(source, v.changed)
          drawRing.attach()
          before.innerHTML = v.step ? html(b.steps[v.step - 1].source) : ''
          gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n')
          gutter.style.minWidth = `${String(lines).length + 1}ch`
          count.textContent = `${lines} lines`
          const c = v.card
          card.innerHTML = c
            ? `<div class="rev-head"><span>STEP ${pad(v.step + 1)} / ${pad(steps)}</span>${c.tag ? `<em>${esc(c.tag)}</em>` : ''}</div><h3>${esc(c.title)}</h3>${c.text ? `<p>${esc(c.text)}</p>` : ''}`
            : ''
          shown = v.step
        }
        const fade = ease(v.p / 0.6)
        after.style.opacity = String(v.step ? fade : v.p > 0 ? fade : 0)
        before.style.opacity = String(v.step ? 1 - fade : 0)
        card.style.opacity = String(v.cardIsNew ? fade : 1)
        scroller.style.transform = `translateY(calc(${-v.scroll} * var(--ed-line)))`
        drawRing(
          v.ring && v.ring.col >= 0
            ? {
                line: v.ring.line,
                col: v.ring.col,
                length: v.ring.text.length,
                p: clamp((v.p - 0.4) / 0.6),
              }
            : null,
        )
        bars.forEach(({ ch, fill }, i) => {
          fill.style.width = `${v.fills[i] * 100}%`
          ch.classList.toggle('on', i === v.chapter)
        })
      }
    },
  },
  array: {
    needs: (b) => Math.max(b.at ?? 0, ...arrayTimes(b).map((t) => t.end)),
    mount(root, b) {
      const box = el('div', 'array')
      box.style.setProperty('--n', String(b.values.length))
      const row = el('div', 'arr-row')
      const cells = b.values.map((value) => el('div', 'arr-cell', esc(String(value))))
      row.append(...cells)
      const note = el('div', 'arr-note')
      const count = el('div', 'arr-count')
      const counts = b.count && b.steps.some((s) => s.do === 'compare')
      box.append(row, note)
      if (counts) box.append(count)
      root.append(box)
      let fitted = false
      return (local) => {
        // Once it has a size and its fonts: measure the widest value in the
        // theme's font, and shrink the text if it wouldn't fit inside a cell.
        if (!fitted && cells[0].clientWidth && document.fonts?.status !== 'loading') {
          fitted = true
          const probe = el('span', 'arr-probe')
          cells[0].append(probe)
          let widest = 0
          for (const value of b.values) {
            probe.textContent = String(value)
            widest = Math.max(widest, probe.getBoundingClientRect().width)
          }
          probe.remove()
          const style = getComputedStyle(cells[0])
          const inner =
            cells[0].clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          row.style.fontSize = `calc(var(--arr-text) * var(--u) * ${arrayTextScale(inner, widest)})`
        }
        const view = arrayView(b, local)
        view.items.forEach((it, i) => {
          cells[i].style.left = `calc(${it.x} * 100% / var(--n))`
          cells[i].style.transform = `translateY(calc(${-it.y} * var(--arr-rise)))`
          cells[i].classList.toggle('on', it.active)
          cells[i].classList.toggle('done', it.done)
          cells[i].classList.toggle('dim', it.dim)
        })
        note.textContent = view.note
        if (counts) count.textContent = `comparisons: ${view.compares}`
      }
    },
  },
  terminal: {
    needs: typing,
    mount: (root, b) =>
      typer(b.label, b.source, b.cps ?? DEFAULT_CPS, terminal, 'term')(root, b.at ?? 0),
  },
  tree: {
    needs: (b) => (b.at ?? 0) + b.lines.length * 0.5 + REVEAL,
    mount(root, b) {
      const box = el('div', 'tree')
      const lines = b.lines.map((line) => {
        // A line ending in "/" is a folder.
        const row = el('div', line.trimEnd().endsWith('/') ? 'dir' : '', esc(line))
        box.append(row)
        return row
      })
      root.append(box)
      const fit = fitOnce(box)
      return (local) => {
        fit()
        lines.forEach((row, i) => reveal(row, local - (b.at ?? 0) - i * 0.5))
      }
    },
  },
  stamp: {
    needs: (b) => (b.at ?? 0) + REVEAL,
    mount(root, b) {
      const stamp = el('span', `stamp ${b.tone}`, esc(b.text))
      root.append(stamp)
      return (local) => {
        stamp.style.visibility = b.until !== undefined && local >= b.until ? 'hidden' : ''
      }
    },
  },
  cards: {
    needs: (b) => (b.at ?? 0) + b.items.length * 0.3 + REVEAL,
    mount(root, b) {
      const box = el('div', 'cards')
      const cards = b.items.map((item) => {
        const card = el(
          'div',
          'card',
          `<strong>${esc(item.title)}</strong>${item.sub ? `<span>${esc(item.sub)}</span>` : ''}`,
        )
        box.append(card)
        return card
      })
      root.append(box)
      return (local) => cards.forEach((card, i) => reveal(card, local - (b.at ?? 0) - i * 0.3))
    },
  },
  chips: {
    needs: (b) => (b.at ?? 0) + b.items.length * 0.3 + REVEAL,
    mount(root, b) {
      const box = el('div', 'chips', b.label ? `<b>${esc(b.label)}</b>` : '')
      const chips = b.items.map((item) => {
        const chip = el('span', '', esc(item))
        box.append(chip)
        return chip
      })
      root.append(box)
      return (local) => chips.forEach((chip, i) => reveal(chip, local - (b.at ?? 0) - i * 0.3))
    },
  },
  icon: {
    needs: (b) => (b.at ?? 0) + b.items.length * 0.3 + REVEAL,
    mount(root, b, ctx) {
      const box = el('div', 'icons')
      const items = b.items.map((item) => {
        const fig = el('div', 'icon')
        const img = document.createElement('img')
        img.alt = item.label ?? ''
        img.src = ctx.fileUrl(item.path)
        img.style.height = `calc(${b.size} * var(--u))`
        ctx.load(item.path, img)
        fig.append(img)
        if (item.label) fig.append(el('span', '', esc(item.label)))
        box.append(fig)
        return fig
      })
      root.append(box)
      return (local) => items.forEach((fig, i) => reveal(fig, local - (b.at ?? 0) - i * 0.3))
    },
  },
  doodle: {
    // Every format shares one timeline, so the slower of the two drawings sets it.
    needs: (b) =>
      Math.max(
        (b.at ?? 0) + REVEAL,
        ...[b.strokes, b.tall?.strokes ?? []].flatMap((strokes) =>
          doodleTimes(strokes, b.at).map((t) => t.end),
        ),
      ),
    mount(root, b, ctx) {
      const art = doodleArt(b, ctx.format)
      const times = doodleTimes(art.strokes, b.at)
      const box = svg('svg', { class: 'doodle', viewBox: art.viewBox, role: 'img' })
      const ink = svg('g')
      if (b.wobble) {
        // A fixed seed, so the same wobble in every frame of every render.
        const filter = svg('filter', {
          id: 'wobble',
          x: '-5%',
          y: '-5%',
          width: '110%',
          height: '110%',
        })
        filter.append(
          svg('feTurbulence', { baseFrequency: 0.02, numOctaves: 2, seed: 4 }),
          svg('feDisplacementMap', { in: 'SourceGraphic', scale: 5 }),
        )
        box.append(filter)
        ink.setAttribute('filter', 'url(#wobble)')
      }
      // Over the wobble: it suits lines, but makes small words hard to read.
      const words = svg('g')
      const dots = svg('g')
      const pen = svg('g', { visibility: 'hidden' })
      const tilted = svg('g', { transform: 'rotate(26)' })
      for (const part of PEN) {
        tilted.append(
          svg('path', {
            stroke: 'var(--fg)',
            'stroke-width': 2.5,
            'stroke-linejoin': 'round',
            ...part,
          }),
        )
      }
      pen.append(tilted)
      box.append(ink, words, dots, pen)
      root.append(box)

      const items = art.strokes.map((item) => {
        if ('d' in item) return { item, stroke: mountStroke({ ink, dots }, item) }
        const label = svg('text', {
          class: item.mono ? 'doodle-label doodle-mono' : 'doodle-label',
          x: item.x,
          y: item.y,
          'font-size': item.size,
          fill: `var(--${item.tone})`,
        })
        words.append(label)
        return { item, label }
      })

      return (local) => {
        let tip: { x: number; y: number } | null = null
        items.forEach(({ item, stroke, label }, i) => {
          const { start, end } = times[i]
          const p = end > start ? clamp((local - start) / (end - start)) : local >= start ? 1 : 0
          const drawing = p > 0 && p < 1
          if (stroke) {
            const { path, fill, dots: moving, flow } = stroke
            const stroked = item as Extract<DoodleItem, { d: string }>
            path.setAttribute('visibility', p > 0 && stroked.width > 0 ? 'visible' : 'hidden')
            path.setAttribute('stroke-dashoffset', String(Math.round((1 - p) * 10000) / 10000))
            fill?.setAttribute('opacity', String(Math.round(p * stroked.fillOpacity * 1000) / 1000))
            const length = path.getTotalLength?.() ?? 0
            if (drawing && stroked.width > 0 && length) tip = path.getPointAtLength(length * p)
            if (flow) {
              const since = local - (flow.at ?? end)
              moving.forEach((dot, n) => {
                dot.setAttribute('visibility', since >= 0 && length ? 'visible' : 'hidden')
                if (since < 0 || !length) return
                const along = (((n / flow.count) * length + since * flow.speed) % length) + length
                const at = path.getPointAtLength(along % length)
                dot.setAttribute('cx', at.x.toFixed(1))
                dot.setAttribute('cy', at.y.toFixed(1))
              })
            }
          } else if (label) {
            const words = (item as Extract<DoodleItem, { text: string }>).text
            const shown = words.slice(0, Math.ceil(words.length * p))
            if (label.textContent !== shown) label.textContent = shown
            if (drawing && 'x' in item) {
              const width = (label as SVGTextElement).getComputedTextLength?.() ?? 0
              tip = { x: item.x + width, y: item.y }
            }
          }
        })
        pen.setAttribute('visibility', b.pen && tip ? 'visible' : 'hidden')
        if (tip) {
          const { x, y } = tip as { x: number; y: number }
          pen.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
        }
      }
    },
  },
  stage3d: {
    bleed: true,
    needs: (b) => (b.at ?? 0) + stage3dLength(b),
    mount(root, b, ctx) {
      const canvas = document.createElement('canvas')
      canvas.className = 'stage3d'
      canvas.width = ctx.width
      canvas.height = ctx.height
      root.append(canvas)
      let paint: ((seconds: number) => void) | undefined
      // Loaded on demand: 3D is a large library that most projects never use.
      ctx.wait(
        'stage3d',
        import('./stage3d/stage').then(async ({ mountStage }) => {
          paint = await mountStage(canvas, b, ctx)
        }),
      )
      return (local) => {
        canvas.style.visibility = local < (b.at ?? 0) ? 'hidden' : 'visible'
        // Hidden scenes draw too, to stay in step, but a 3D frame costs real GPU time.
        const scene = (root.getRootNode() as ShadowRoot).host as HTMLElement | undefined
        if (scene?.style.visibility === 'hidden') return
        paint?.(Math.max(0, local - (b.at ?? 0)))
      }
    },
  },
  end: {
    needs: (b) => (b.at ?? 0) + 3 * 0.8 + REVEAL,
    mount(root, b) {
      const box = el('div', 'end')
      const word = el('p', 'wordmark', esc(b.wordmark).replace(/\//g, '<i>/</i>'))
      const parts = [word]
      if (b.tagline) parts.push(el('p', 'text', esc(b.tagline)))
      if (b.command) parts.push(el('span', 'cmd', `$ ${esc(b.command)}`))
      if (b.url) parts.push(el('p', 'url', esc(b.url)))
      box.append(...parts)
      root.append(box)
      const fit = fitOnce(word)
      return (local) => {
        fit()
        parts.forEach((p, i) => reveal(p, local - (b.at ?? 0) - i * 0.8))
      }
    },
  },
}
