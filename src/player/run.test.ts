import { describe, expect, test } from 'vitest'
import { parseProject, starterProject, type Block } from '@/core/project/project'
import { runView } from './blocks'

type Run = Extract<Block, { type: 'run' }>
const run = (extra: object): Run => {
  const p = parseProject({
    ...starterProject('D'),
    scenes: [
      {
        id: 's1',
        kind: 'blocks',
        caption: 'x',
        blocks: [{ type: 'run', source: 'a\nb\nc\nd\ne\nf\ng\nh', rows: 4, ...extra }],
      },
    ],
  })
  const scene = p.scenes[0]
  if (scene.kind !== 'blocks') throw new Error('blocks')
  return scene.blocks[0] as Run
}

describe('runView', () => {
  const b = run({
    boxes: [{ id: 'q', label: 'Queue' }],
    steps: [
      { at: 0, seconds: 0, line: 1, push: 'main', vars: { n: 1 } },
      { at: 1, seconds: 0, line: 2, set: { n: 2 }, print: 'one', add: { box: 'q', item: 'job' } },
      { at: 2, seconds: 0, line: 8, push: 'f', ring: 'h', focus: ['stack'] },
      { at: 3, seconds: 1, pop: true, take: { box: 'q' }, focus: [] },
    ],
  })

  test('nothing before the first step', () => {
    expect(runView(b, -1)).toMatchObject({ line: 0, frames: [], output: [], focus: null })
  })

  test('state builds up, highlights belong to the step running now', () => {
    const v = runView(b, 1)
    expect(v.line).toBe(2)
    expect(v.frames).toEqual([{ name: 'main', vars: { n: 2 }, opacity: 1 }])
    expect(v.changed).toEqual(['n'])
    expect(v.output).toEqual([{ text: 'one', opacity: 1 }])
    expect(v.boxes.q).toEqual([{ text: 'job', opacity: 1 }])
    expect(runView(b, 1.5).changed).toEqual(['n'])
    expect(runView(b, 2).changed).toEqual([])
  })

  test('scrolls to keep the line in view, rings it, focuses', () => {
    const v = runView(b, 2.5)
    expect(v.scroll).toBe(4)
    expect(v.ring).toEqual({ line: 8, text: 'h', p: 1 })
    expect(v.focus).toEqual(['stack'])
  })

  test('pop and take fade out during their step, then are gone', () => {
    const mid = runView(b, 3.5)
    expect(mid.frames.map((f) => [f.name, f.opacity])).toEqual([
      ['main', 1],
      ['f', 0.5],
    ])
    expect(mid.boxes.q).toEqual([{ text: 'job', opacity: 0.5 }])
    expect(mid.focus).toBeNull()
    const after = runView(b, 4)
    expect(after.frames.map((f) => f.name)).toEqual(['main'])
    expect(after.boxes.q).toEqual([])
  })

  test('rejects a step that names a missing box or line', () => {
    expect(() => run({ steps: [{ add: { box: 'nope', item: 'x' } }] })).toThrow(/no box "nope"/)
    expect(() => run({ steps: [{ line: 9 }] })).toThrow(/8 lines/)
  })

  test('rejects box ids that clash, and focus on parts that are not there', () => {
    expect(() => run({ boxes: [{ id: 'stack', label: 'S' }] })).toThrow(/reserved or repeated/)
    const twice = [
      { id: 'q', label: 'A' },
      { id: 'q', label: 'B' },
    ]
    expect(() => run({ boxes: twice })).toThrow(/reserved or repeated/)
    expect(() => run({ steps: [{ focus: ['Stack'] }] })).toThrow(/"Stack" to focus on/)
    expect(() => run({ panels: ['stack'], steps: [{ focus: ['output'] }] })).toThrow(/"output"/)
    expect(() => run({ steps: [{ focus: ['code', 'stack', 'output'] }] })).not.toThrow()
  })

  test('array moves need values, real slots, and a b to swap with', () => {
    expect(() => run({ steps: [{ array: { do: 'compare', a: 0 } }] })).toThrow(/add values/)
    expect(() => run({ values: [1, 2], steps: [{ array: { do: 'mark', a: 2 } }] })).toThrow(
      /2 slots/,
    )
    expect(() => run({ values: [1, 2], steps: [{ array: { do: 'swap', a: 0 } }] })).toThrow(
      /needs a slot b/,
    )
    expect(() => run({ values: [1, 2], steps: [{ focus: ['array'] }] })).not.toThrow()
    expect(() => run({ steps: [{ focus: ['array'] }] })).toThrow(/"array"/)
  })

  test('tabs: a step switches by name, later steps stay, a new tab starts at its top', () => {
    const t = run({
      file: 'main.c',
      files: [{ name: 'list.c', source: '1\n2\n3\n4\n5\n6\n7\n8\n9' }],
      steps: [
        { at: 0, seconds: 0, line: 8 },
        { at: 1, seconds: 0, file: 'list.c' },
        { at: 2, seconds: 0, line: 9 },
        { at: 3, seconds: 0, file: 'main.c', line: 2 },
      ],
    })
    expect(runView(t, 0.5)).toMatchObject({ tab: 0, line: 8, scroll: 4 })
    expect(runView(t, 1.5)).toMatchObject({ tab: 1, line: 0, scroll: 0 })
    expect(runView(t, 2.5)).toMatchObject({ tab: 1, line: 9, scroll: 5 })
    expect(runView(t, 3.5)).toMatchObject({ tab: 0, line: 2, scroll: 0 })
  })

  test('tabs: names are unique, steps name real tabs, lines fit the tab shown', () => {
    expect(() => run({ file: 'a.c', files: [{ name: 'a.c', source: 'x' }] })).toThrow(
      /two tabs are called "a.c"/,
    )
    expect(() => run({ steps: [{ file: 'nope.c' }] })).toThrow(/no tab "nope.c"/)
    const two = { file: 'a.c', files: [{ name: 'b.c', source: 'one line' }] }
    expect(() => run({ ...two, steps: [{ file: 'b.c' }, { line: 2 }] })).toThrow(/b.c has 1 line\b/)
    expect(() => run({ ...two, steps: [{ line: 8 }] })).not.toThrow()
  })
})
