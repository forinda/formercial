import { describe, expect, test } from 'vitest'
import { audioGraph } from './audio'
import { parseProject, starterProject, type Project } from './project'
import { toSrt } from './srt'
import { resolveTimeline } from './timeline'

export const proj = (scenes: { id: string; minSeconds: number; caption?: string }[]): Project =>
  parseProject({
    ...starterProject('T'),
    scenes: scenes.map((s) => ({
      kind: 'blocks',
      blocks: [],
      caption: `Caption ${s.id.toUpperCase()}`,
      ...s,
    })),
  })

const two = () =>
  resolveTimeline(
    proj([
      { id: 'a', minSeconds: 4 },
      { id: 'b', minSeconds: 4 },
    ]),
    { a: { path: 'voice/a.tts.mp3', seconds: 6.04 } },
    () => 5,
  )

describe('timeline', () => {
  test('scene length is the longest of min, needs and clip + 1.3', () => {
    const t = two()
    expect(t.scenes.map((s) => [s.start, s.length])).toEqual([
      [0, 7.4],
      [7.4, 5],
    ])
    expect(t.total).toBe(12.4)
    expect(t.scenes[0].clip).toEqual({ path: 'voice/a.tts.mp3', seconds: 6.04 })
  })

  test('starts stay exact over many scenes', () => {
    const scenes = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, minSeconds: 0.1 }))
    const t = resolveTimeline(proj(scenes), {}, () => 0)
    expect(t.scenes[29].start).toBe(2.9)
    expect(t.total).toBe(3)
  })
})

describe('srt', () => {
  test('srt cue ends with the clip, not the scene', () => {
    const p = proj([
      { id: 'a', minSeconds: 4 },
      { id: 'b', minSeconds: 4 },
    ])
    const srt = toSrt(p, two())
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:06,040\nCaption A')
    expect(srt).toContain('2\n00:00:07,400 --> 00:00:12,400\nCaption B')
  })
})

describe('audioGraph', () => {
  test('audio graph delays each clip to its scene start', () => {
    const t = resolveTimeline(
      proj([
        { id: 'a', minSeconds: 4 },
        { id: 'b', minSeconds: 4 },
      ]),
      { a: { path: 'voice/a.mp3', seconds: 2 }, b: { path: 'voice/b.mp3', seconds: 2 } },
      () => 0,
    )
    const g = audioGraph(t)
    expect(g.inputs).toEqual(['voice/a.mp3', 'voice/b.mp3'])
    expect(g.filter).toContain('[1:a]adelay=0:all=1')
    expect(g.filter).toContain('[2:a]adelay=4000:all=1')
    expect(g.filter).toMatch(/amix=inputs=2:normalize=0\[aout\]$/)
  })

  test('music is ducked by the voice', () => {
    const g = audioGraph(two(), { input: 2, volume: 0.25, duck: 0.35 })
    expect(g.filter).toMatch(/\[2:a\]volume=0\.25/)
    expect(g.filter).toMatch(/sidechaincompress/)
    expect(g.filter).toMatch(/\[aout\]$/)
  })

  test('no clips and no music gives no graph', () => {
    expect(audioGraph(resolveTimeline(proj([{ id: 'a', minSeconds: 1 }]), {}, () => 0))).toEqual({
      filter: '',
      inputs: [],
    })
  })
})
