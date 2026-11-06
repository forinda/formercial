import { describe, expect, expectTypeOf, test } from 'vitest'
import type { StampItem } from './pdf-job'
import { checkItems, signItems, type SignItem } from './sign-items'

const box = { x: 0.6, y: 0.8, w: 0.3, h: 0.1 }
const signature: SignItem = { kind: 'picture', pages: [2], box, picture: 0 }
const initials: SignItem = { kind: 'picture', pages: [1, 2, 3], box, picture: 1 }

describe('signing items', () => {
  test('accepts a signature on page 2 and initials on every page', () => {
    const items = signItems.parse([signature, initials])
    expect(() => checkItems(items, 3, 2)).not.toThrow()
  })

  test('refuses items outside the page or of no size', () => {
    const off: SignItem = { ...signature, box: { x: 0.9, y: 0.5, w: 0.2, h: 0.1 } }
    expect(() => checkItems([off], 3, 1)).toThrow('an item runs off the page')
    const flat: SignItem = { ...signature, box: { ...box, w: 0 } }
    expect(() => checkItems([flat], 3, 1)).toThrow('an item has no size')
  })

  test("refuses a page the document hasn't got", () => {
    expect(() => checkItems([{ ...signature, pages: [5] }], 3, 1)).toThrow('it has only 3 pages')
    // The page count isn't known before the PDF is opened: that check waits.
    expect(() => checkItems([{ ...signature, pages: [5] }], null, 1)).not.toThrow()
  })

  test("refuses a picture that wasn't sent", () => {
    expect(() => checkItems([{ ...signature, picture: 2 }], 3, 1)).toThrow(
      'a signature picture is missing',
    )
  })

  test('ink is any #rrggbb colour, and nothing else', () => {
    const tick = { kind: 'tick', pages: [1], box }
    for (const ok of ['#000000', '#b3261e', '#1A3D8F'])
      expect(signItems.safeParse([{ ...tick, color: ok }]).success).toBe(true)
    for (const bad of ['blue', '#fff', 'red; x', 'url(#a)', '#12345g'])
      expect(signItems.safeParse([{ ...tick, color: bad }]).success).toBe(false)
  })

  test('refuses more than 500 items', () => {
    const many = Array.from({ length: 501 }, () => signature)
    expect(signItems.safeParse(many).success).toBe(false)
    expect(signItems.safeParse(many.slice(1)).success).toBe(true)
  })

  test('text has bounds on its length and size', () => {
    const text = { kind: 'text', pages: [1], box, text: '6 Nov 2026', size: 12, color: '#1a3d8f' }
    expect(signItems.safeParse([text]).success).toBe(true)
    expect(signItems.safeParse([{ ...text, size: 100 }]).success).toBe(false)
    expect(signItems.safeParse([{ ...text, text: 'x'.repeat(2001) }]).success).toBe(false)
  })
})

test("the worker's copy of the item type matches", () => {
  // pdf-job.ts can't import this module, so it declares the type again; the typecheck fails if they drift.
  expectTypeOf<SignItem>().toEqualTypeOf<StampItem>()
})
