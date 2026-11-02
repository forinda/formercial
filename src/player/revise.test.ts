import { describe, expect, test } from 'vitest'
import { parseProject, starterProject, type Block } from '@/core/project/project'
import { changedLines, reviseView } from './blocks'

type Revise = Extract<Block, { type: 'revise' }>
const revise = (extra: object): Revise => {
  const p = parseProject({
    ...starterProject('D'),
    scenes: [{ id: 's1', kind: 'blocks', caption: 'x', blocks: [{ type: 'revise', ...extra }] }],
  })
  const scene = p.scenes[0]
  if (scene.kind !== 'blocks') throw new Error('blocks')
  return scene.blocks[0] as Revise
}

describe('changedLines', () => {
  test('marks new and edited lines, not moved-up ones', () => {
    expect(changedLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([1, 3])
    expect(changedLines(['a', 'b', 'c'], ['a', 'c'])).toEqual([])
    expect(changedLines([], ['a'])).toEqual([0])
  })
})

describe('reviseView', () => {
  const b = revise({
    rows: 3,
    chapters: ['one', 'two'],
    steps: [
      { at: 0, seconds: 1, source: 'a\nb', chapter: 0, card: { tag: 'T', title: 'first' } },
      { at: 2, seconds: 1, source: 'a\nc\nd\ne\nf\ng', ring: { line: 6, text: 'g' } },
      { at: 4, seconds: 1, source: 'a', chapter: 1, card: { title: 'last' } },
    ],
  })

  test('the first step fades in from its start', () => {
    expect(reviseView(b, -1)).toMatchObject({ step: 0, p: 0, changed: [] })
    expect(reviseView(b, 0.5)).toMatchObject({ step: 0, p: 0.5, chapter: 0 })
  })

  test('a later step marks what changed, keeps the last card and chapter', () => {
    const v = reviseView(b, 3)
    expect(v.changed).toEqual([1, 2, 3, 4, 5])
    expect(v.card?.title).toBe('first')
    expect(v.cardIsNew).toBe(false)
    expect(v.chapter).toBe(0)
    expect(v.fills).toEqual([1, 0])
  })

  test('scrolls to the ringed line and finds its column', () => {
    const v = reviseView(b, 3)
    expect(v.scroll).toBe(3)
    expect(v.ring).toEqual({ line: 6, text: 'g', col: 0 })
  })

  test('chapters fill as their steps run', () => {
    expect(reviseView(b, 4.5).fills).toEqual([1, 0.5])
    expect(reviseView(b, 9).fills).toEqual([1, 1])
  })

  test('rejects a ring that is not on its line, and a chapter past the list', () => {
    expect(() => revise({ steps: [{ source: 'a', ring: { line: 1, text: 'b' } }] })).toThrow(
      /doesn't contain "b"/,
    )
    expect(() => revise({ steps: [{ source: 'a', chapter: 0 }] })).toThrow(/0 chapters/)
  })
})
