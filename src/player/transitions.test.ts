import { describe, expect, test } from 'vitest'
import { TRANSITIONS } from '@/core/project'
import { defaultSeconds, transitionEffect } from './transitions'

const W = 1920
const H = 1080

describe('transitionEffect', () => {
  test('every kind is defined, with a sensible default length', () => {
    for (const kind of TRANSITIONS) {
      expect(transitionEffect(kind, 0.5, W, H), kind).toBeDefined()
      expect(defaultSeconds(kind)).toBeGreaterThan(0)
    }
  })

  test('the same moment always looks the same', () => {
    for (const kind of TRANSITIONS) {
      expect(transitionEffect(kind, 0.37, W, H)).toEqual(transitionEffect(kind, 0.37, W, H))
    }
  })

  test('nothing in any look is broken, at any size or moment', () => {
    for (const kind of TRANSITIONS) {
      for (const [w, h] of [
        [W, H],
        [1080, 1920],
        [120, 68],
      ]) {
        for (const p of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
          expect(JSON.stringify(transitionEffect(kind, p, w, h)), `${kind} ${p}`).not.toMatch(
            /NaN|Infinity|undefined/,
          )
        }
      }
    }
  })

  test('a reveal hides the new scene at the start and shows all of it at the end', () => {
    expect(transitionEffect('wipe', 0, W, H).incoming.clipPath).toBe('inset(0 100% 0 0)')
    expect(transitionEffect('wipe', 1, W, H).incoming.clipPath).toBe('inset(0 0% 0 0)')
    expect(transitionEffect('iris', 0, W, H).incoming.clipPath).toContain('circle(0%')
    expect(transitionEffect('iris', 1, W, H).incoming.clipPath).toContain('circle(72%')
    const open = transitionEffect('blinds', 1, W, H).incoming.clipPath!
    expect(open).toContain('M0 0 L240 0 L240 1080 L0 1080 Z')
  })

  test('a break keeps the old scene on top, whole at the start and gone at the end', () => {
    for (const kind of ['shatter', 'crumble'] as const) {
      const start = transitionEffect(kind, 0, W, H)
      const middle = transitionEffect(kind, 0.85, W, H)
      const end = transitionEffect(kind, 1, W, H)
      expect(start.oldOnTop).toBe(true)
      const pieces = (e: typeof start) => e.outgoing!.clipPath!.split('M').length
      expect(pieces(middle)).toBeLessThan(pieces(start))
      expect(end.outgoing!.clipPath).toBe('polygon(0 0, 0 0, 0 0)')
    }
    const crack = transitionEffect('break', 0.5, W, H)
    expect(crack.oldOnTop).toBe(true)
    expect(crack.outgoing!.clipPath!.split('M')).toHaveLength(3)
  })

  test('breaking effects outline their pieces; the others have no edges', () => {
    for (const kind of TRANSITIONS) {
      const { edges } = transitionEffect(kind, 0.5, W, H)
      if (kind === 'break' || kind === 'shatter' || kind === 'crumble') {
        expect(edges, kind).toContain('M')
      } else {
        expect(edges, kind).toBeUndefined()
      }
    }
  })

  test('shatter covers the whole picture before it starts to move', () => {
    const start = transitionEffect('shatter', 0, W, H).outgoing!.clipPath!
    // 8 by 5 cells, two triangles each, meeting the corners exactly.
    expect(start.split('M')).toHaveLength(8 * 5 * 2 + 1)
    expect(start).toContain('M0 0')
    expect(start).toContain(`${W} ${H}`)
  })

  test('a flip shows one side at a time, and ends square on', () => {
    expect(transitionEffect('flip', 0.25, W, H).incoming.opacity).toBe(0)
    expect(transitionEffect('flip', 0.25, W, H).outgoing!.transform).toContain('rotateY(45.0deg)')
    expect(transitionEffect('flip', 0.75, W, H).outgoing).toBeUndefined()
    expect(transitionEffect('flip', 1, W, H).incoming.transform).toContain('rotateY(0.0deg)')
  })
})
