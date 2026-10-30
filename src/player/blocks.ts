// The built-in blocks. Each one builds its DOM once and returns a draw(local)
// that sets everything from the scene's local time, so the same time always
// draws the same frame.
import type { Block, Format, Theme } from '../core/project'
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
export function fitOnce(el: HTMLElement): () => void {
  let done = false
  return () => {
    // Measure with the real fonts: a fallback font would size it wrong for good.
    if (done || !el.clientWidth || document.fonts?.status === 'loading') return
    done = true
    let size = parseFloat(getComputedStyle(el).fontSize)
    for (let i = 0; i < 16 && el.scrollWidth > el.clientWidth + 1; i++) {
      size *= 0.94
      el.style.fontSize = `${size}px`
    }
  }
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
    // Measure with the whole text in place, so the font fits the longest line.
    typed.innerHTML = paint(source)
    const fit = fitOnce(box)
    let shown = -1
    return (local: number) => {
      fit()
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
