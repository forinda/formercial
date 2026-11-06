import { describe, expect, test } from 'vitest'
import { formatDate, history, parsePages, toSignItems, type Placed } from './items'

describe('parsePages', () => {
  test('reads lists and ranges', () => {
    expect(parsePages('1, 3–5', 6)).toEqual([1, 3, 4, 5])
    expect(parsePages('2-3,3', 6)).toEqual([2, 3])
  })

  test("refuses ranges that run backwards and pages it hasn't got", () => {
    expect(parsePages('3-1', 6)).toBeNull()
    expect(parsePages('9', 6)).toBeNull()
    expect(parsePages('', 6)).toBeNull()
    expect(parsePages('two', 6)).toBeNull()
  })
})

describe('history', () => {
  test('undoes and redoes through three changes', () => {
    let h = history.start(0)
    for (const n of [1, 2, 3]) h = history.set(h, n)
    h = history.undo(history.undo(h))
    expect(h.present).toBe(1)
    h = history.redo(h)
    expect(h.present).toBe(2)
    // A new change after undoing drops what could have been redone.
    h = history.set(h, 9)
    expect(history.redo(h).present).toBe(9)
    expect(history.undo(h).present).toBe(2)
  })

  test('undo at the start and redo at the end change nothing', () => {
    const h = history.start('a')
    expect(history.undo(h)).toBe(h)
    expect(history.redo(h)).toBe(h)
  })
})

test('dates in each format', () => {
  const day = new Date(2026, 10, 6)
  expect(formatDate(day, 'long')).toBe('6 Nov 2026')
  expect(formatDate(day, 'dmy')).toBe('06/11/2026')
  expect(formatDate(day, 'iso')).toBe('2026-11-06')
})

test('placed items become what the server takes, pictures numbered in upload order', () => {
  const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }
  const placed: Placed[] = [
    { id: 'a', label: 'initials', pages: [1, 2], box, color: 'blue' },
    { id: 'b', label: 'date', pages: [2], box, color: 'black', text: '6 Nov 2026', size: 12 },
    { id: 'c', label: 'signature', pages: [2], box, color: 'blue' },
    { id: 'd', label: 'initials', pages: [3], box, color: 'blue' },
    { id: 'e', label: 'tick', pages: [1], box, color: 'black' },
  ]
  const { items, pictures } = toSignItems(placed)
  expect(pictures).toEqual(['initials', 'signature'])
  expect(items).toEqual([
    { kind: 'picture', pages: [1, 2], box, picture: 0 },
    { kind: 'text', pages: [2], box, text: '6 Nov 2026', size: 12, color: 'black' },
    { kind: 'picture', pages: [2], box, picture: 1 },
    { kind: 'picture', pages: [3], box, picture: 0 },
    { kind: 'tick', pages: [1], box, color: 'black' },
  ])
})
