// The signing workspace's items, as the page keeps them, and turning them into
// what the server stamps (src/core/tools/sign-items.ts).
import { useState } from 'react'
import type { Placed, SignItem } from '@/core/tools/sign-items'

export type Label = Placed['label']
/** An ink: a #rrggbb colour. */
export type Ink = string

/** The usual inks; any other colour can be picked too. */
export const INKS = [
  { name: 'Black', color: '#111111' },
  { name: 'Blue', color: '#1a3d8f' },
  { name: 'Bright blue', color: '#2563eb' },
  { name: 'Red', color: '#b3261e' },
  { name: 'Green', color: '#1e6b3a' },
  { name: 'Purple', color: '#5b2a86' },
  { name: 'Brown', color: '#6b3e1e' },
]
export const DEFAULT_INK = INKS[1].color

/** One placed thing (checked by the server when a document is saved). */
export type { Placed }

export const isPicture = (label: Label) => label === 'signature' || label === 'initials'
export const isText = (label: Label) => label === 'date' || label === 'name' || label === 'text'

/** The items for the server, and which picture (signature, initials) goes up first, second. */
export function toSignItems(placed: Placed[]): { items: SignItem[]; pictures: Label[] } {
  const pictures: Label[] = []
  const items = placed.map((p): SignItem => {
    const { pages, box, color } = p
    if (isPicture(p.label)) {
      if (!pictures.includes(p.label)) pictures.push(p.label)
      return { kind: 'picture', pages, box, picture: pictures.indexOf(p.label) }
    }
    if (p.label === 'tick') return { kind: 'tick', pages, box, color }
    return { kind: 'text', pages, box, text: p.text ?? '', size: p.size ?? 12, color }
  })
  return { items, pictures }
}

/** "1, 3–5" to [1, 3, 4, 5]; null if it isn't a list of this document's pages. */
export function parsePages(text: string, pageCount: number): number[] | null {
  const pages = new Set<number>()
  for (const part of text.split(',')) {
    const m = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(part)
    if (!m) return null
    const [from, to] = [Number(m[1]), Number(m[2] ?? m[1])]
    if (from < 1 || to > pageCount || from > to) return null
    for (let n = from; n <= to; n++) pages.add(n)
  }
  return [...pages].sort((a, b) => a - b)
}

export type DateFormat = 'long' | 'dmy' | 'iso'
export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'long', label: '6 Nov 2026' },
  { value: 'dmy', label: '06/11/2026' },
  { value: 'iso', label: '2026-11-06' },
]

export function formatDate(day: Date, format: DateFormat) {
  const two = (n: number) => String(n).padStart(2, '0')
  const [d, m, y] = [day.getDate(), day.getMonth() + 1, day.getFullYear()]
  if (format === 'iso') return `${y}-${two(m)}-${two(d)}`
  if (format === 'dmy') return `${two(d)}/${two(m)}/${y}`
  return `${d} ${day.toLocaleString('en-GB', { month: 'short' })} ${y}`
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

export type History<T> = { past: T[]; present: T; future: T[] }

export const history = {
  start: <T>(present: T): History<T> => ({ past: [], present, future: [] }),
  set: <T>(h: History<T>, next: T): History<T> => ({
    past: h.past.concat([h.present]).slice(-200),
    present: next,
    future: [],
  }),
  undo: <T>(h: History<T>): History<T> =>
    h.past.length
      ? {
          past: h.past.slice(0, -1),
          present: h.past[h.past.length - 1],
          future: [h.present].concat(h.future),
        }
      : h,
  redo: <T>(h: History<T>): History<T> =>
    h.future.length
      ? { past: h.past.concat([h.present]), present: h.future[0], future: h.future.slice(1) }
      : h,
}

export function useHistory<T>(initial: T) {
  const [h, setH] = useState(() => history.start(initial))
  return {
    value: h.present,
    set: (next: T) => setH((cur) => history.set(cur, next)),
    /** A change worked out from the value as it is when applied. */
    update: (change: (now: T) => T) => setH((cur) => history.set(cur, change(cur.present))),
    undo: () => setH(history.undo<T>),
    redo: () => setH(history.redo<T>),
    /** Starts over from `value`, with nothing to undo (a document just opened). */
    reset: (value: T) => setH(history.start(value)),
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }
}
