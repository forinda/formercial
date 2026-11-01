import { describe, expect, test } from 'vitest'
import { parseProject } from '@/core/project/project'
import { stage3dLength, stageAt, stageProblems, WALK_STRIDE, type Stage3d } from './timeline'

/** A block through the real schema, so its defaults are the ones a project gets. */
function block(actors: unknown[], timeline: unknown[] = [], camera: unknown = {}) {
  const project = parseProject({
    version: 1,
    name: 'x',
    formats: ['16:9'],
    voice: { tts: 'en-US-AvaNeural', rate: '+0%' },
    theme: {
      colors: {
        bg: '#000',
        panel: '#000',
        line: '#000',
        fg: '#fff',
        muted: '#fff',
        accent: '#fff',
        good: '#fff',
        bad: '#fff',
      },
      fonts: { display: 'A', body: 'B', mono: 'C' },
    },
    scenes: [
      {
        id: 's',
        kind: 'blocks',
        caption: '',
        blocks: [{ type: 'stage3d', actors, timeline, camera }],
      },
    ],
  })
  const scene = project.scenes[0]
  if (scene.kind !== 'blocks') throw new Error('not blocks')
  return scene.blocks[0] as Stage3d
}

const person = { kind: 'person', id: 'a', position: [0, 0, 0] }

describe('stage3d timeline', () => {
  test('a move reaches its end, and stops there', () => {
    const b = block([person], [{ at: 1, actor: 'a', seconds: 2, ease: 'linear', move: [4, 0, 0] }])
    expect(stageAt(b, 0.5).actors.get('a')!.position).toEqual([0, 0, 0])
    expect(stageAt(b, 2).actors.get('a')!.position).toEqual([2, 0, 0])
    expect(stageAt(b, 9).actors.get('a')!.position).toEqual([4, 0, 0])
  })

  test('moves follow on from each other', () => {
    const b = block(
      [person],
      [
        { at: 0, actor: 'a', seconds: 1, ease: 'linear', move: [2, 0, 0] },
        { at: 1, actor: 'a', seconds: 1, ease: 'linear', move: [2, 0, 3] },
      ],
    )
    expect(stageAt(b, 1.5).actors.get('a')!.position).toEqual([2, 0, 1.5])
    expect(stageAt(b, 2).actors.get('a')!.travelled).toBe(5)
  })

  test('the same moment gives the same state, whatever came before', () => {
    const b = block([person], [{ at: 0, actor: 'a', seconds: 3, move: [3, 0, 3] }])
    const direct = stageAt(b, 2.2)
    stageAt(b, 2.9)
    stageAt(b, 0.1)
    expect(stageAt(b, 2.2)).toEqual(direct)
  })

  test('order in the list does not matter, only `at`', () => {
    const first = { at: 0, actor: 'a', seconds: 1, ease: 'linear', move: [1, 0, 0] }
    const second = { at: 1, actor: 'a', seconds: 1, ease: 'linear', move: [1, 0, 1] }
    const forward = stageAt(block([person], [first, second]), 1.5)
    expect(stageAt(block([person], [second, first]), 1.5)).toEqual(forward)
  })

  test('a person faces the way they walk, and the feet keep pace', () => {
    const b = block(
      [{ ...person, scale: 2 }],
      [{ at: 0, actor: 'a', seconds: 2, ease: 'linear', move: [8, 0, 0] }],
    )
    const s = stageAt(b, 1).actors.get('a')!
    expect(s.rotate).toBeCloseTo(Math.PI / 2)
    expect(s.clip!.name).toBe('walk')
    // 4 units a second, for a stride of 3.44 at this scale.
    expect(s.clip!.time).toBeCloseTo(4 / (WALK_STRIDE * 2))
  })

  test('a person stands again when the walk ends, blending between the two', () => {
    const b = block([person], [{ at: 0, actor: 'a', seconds: 1, move: [1, 0, 0] }])
    const justAfter = stageAt(b, 1.1).actors.get('a')!.clip!
    expect(justAfter.name).toBe('stand')
    expect(justAfter.from!.name).toBe('walk')
    expect(justAfter.blend).toBeCloseTo(0.4)
    expect(stageAt(b, 3).actors.get('a')!.clip!.blend).toBe(1)
  })

  test('a clip with no seconds keeps playing, at the speed asked for', () => {
    const b = block([person], [{ at: 1, actor: 'a', clip: 'dance', speed: 0.5 }])
    const s = stageAt(b, 5).actors.get('a')!.clip!
    expect(s.name).toBe('dance')
    expect(s.time).toBe(2)
  })

  test('turning takes the short way round', () => {
    const b = block(
      [{ ...person, rotate: 170 }],
      [{ at: 0, actor: 'a', seconds: 1, ease: 'linear', rotate: -170 }],
    )
    expect(stageAt(b, 0.5).actors.get('a')!.rotate).toBeCloseTo(Math.PI)
  })

  test('things show, hide, open and scale over time', () => {
    const b = block(
      [{ kind: 'building', id: 'bank', hidden: true }],
      [
        { at: 1, actor: 'bank', show: true },
        { at: 2, actor: 'bank', seconds: 2, ease: 'linear', open: 1 },
        { at: 4, actor: 'bank', show: false },
      ],
    )
    expect(stageAt(b, 0).actors.get('bank')!.visible).toBe(false)
    expect(stageAt(b, 1).actors.get('bank')!.visible).toBe(true)
    expect(stageAt(b, 3).actors.get('bank')!.open).toBe(0.5)
    expect(stageAt(b, 4).actors.get('bank')!.visible).toBe(false)
  })

  test('the camera moves, retargets and zooms', () => {
    const b = block(
      [],
      [
        {
          at: 0,
          actor: 'camera',
          seconds: 2,
          ease: 'linear',
          move: [0, 0, 10],
          target: [1, 1, 1],
          size: 5,
        },
      ],
      {
        position: [0, 0, 20],
        target: [0, 0, 0],
        size: 15,
      },
    )
    const c = stageAt(b, 1).camera
    expect(c.position).toEqual([0, 0, 15])
    expect(c.target).toEqual([0.5, 0.5, 0.5])
    expect(c.size).toBe(10)
  })

  test('a block lasts until its last action ends', () => {
    expect(
      stage3dLength(
        block(
          [person],
          [
            { at: 1, actor: 'a', seconds: 2, move: [1, 0, 0] },
            { at: 2, actor: 'a', clip: 'dance' },
          ],
        ),
      ),
    ).toBe(3)
    expect(stage3dLength(block([person]))).toBe(0)
  })

  test('names a timeline action for an actor that does not exist', () => {
    expect(stageProblems(block([person], [{ at: 0, actor: 'ghost', show: true }]))).toEqual([
      'no actor called "ghost"',
    ])
    expect(stageProblems(block([person, person]))).toEqual(['two actors are called "a"'])
    expect(stageProblems(block([person], [{ at: 0, actor: 'camera', size: 3 }]))).toEqual([])
  })

  test('a model must be a .glb inside media/', () => {
    expect(() => block([{ kind: 'model', id: 'm', path: 'media/car.glb' }])).not.toThrow()
    expect(() => block([{ kind: 'model', id: 'm', path: '../secret.glb' }])).toThrow()
    expect(() => block([{ kind: 'model', id: 'm', path: 'media/../../secret.glb' }])).toThrow()
    expect(() => block([{ kind: 'model', id: 'm', path: 'media/car.exe' }])).toThrow()
  })

  test('refuses a misspelled field, so a mistake is not silently ignored', () => {
    expect(() => block([{ kind: 'box', id: 'b', size: [1, 1, 1], colour: '#fff' }])).toThrow()
    expect(() => block([person], [{ at: 0, actor: 'a', mvoe: [1, 0, 0] }])).toThrow()
  })
})
