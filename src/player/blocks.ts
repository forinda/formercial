// The built-in blocks. Each one builds its DOM once and returns a draw(local)
// that sets everything from the scene's local time, so the same time always
// draws the same frame.
import type { Block, Format, Theme } from '@/core/project'
import { esc, highlight, terminal } from './highlight'

export type BlockCtx = { theme: Theme; format: Format; width: number; height: number }
type Of<T extends Block['type']> = Extract<Block, { type: T }>
export interface BlockDef<B extends Block> {
  needs(b: B): number
  mount(root: HTMLElement, b: B, ctx: BlockCtx): (local: number) => void
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
const PEN = [
  { d: 'M0 0 L18 -34 L34 -26 L12 8 Z', fill: 'var(--fg)' },
  { d: 'M18 -34 L70 -130 L92 -118 L34 -26 Z', fill: 'var(--accent)' },
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
      const art = ctx.format === '9:16' && b.tall ? b.tall : b
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
      for (const part of PEN) {
        pen.append(svg('path', { ...part, stroke: 'var(--fg)', 'stroke-width': 3 }))
      }
      box.append(ink, words, dots, pen)
      root.append(box)

      const items = art.strokes.map((item) => {
        if ('d' in item) return { item, stroke: mountStroke({ ink, dots }, item) }
        const label = svg('text', {
          class: 'doodle-label',
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
