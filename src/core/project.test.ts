import { describe, expect, test } from 'vitest'
import { ProjectError, parseProject, starterProject } from './project'

describe('parseProject', () => {
  test('starterProject is valid and has one scene', () => {
    const p = parseProject(starterProject('Demo'))
    expect(p.version).toBe(1)
    expect(p.scenes).toHaveLength(1)
    expect(p.voice).toEqual({ tts: 'en-US-AvaNeural', rate: '-4%' })
    expect(p.formats).toEqual(['16:9'])
  })

  test('spoken defaults to caption', () => {
    const p = parseProject({
      ...starterProject('D'),
      scenes: [{ id: 's1', kind: 'blocks', caption: 'Hi', blocks: [] }],
    })
    expect(p.scenes[0].spoken).toBe('Hi')
    expect(p.scenes[0]).toMatchObject({ minSeconds: 4, transition: 'fade', voice: 'tts' })
  })

  test('rejects duplicate scene ids with the path', () => {
    const s = { id: 's1', kind: 'blocks', caption: 'x', blocks: [] }
    expect(() => parseProject({ ...starterProject('D'), scenes: [s, s] })).toThrow(/scenes\.1\.id/)
  })

  test('rejects an unknown block type', () => {
    const scene = { id: 's1', kind: 'blocks', caption: 'x', blocks: [{ type: 'video' }] }
    expect(() => parseProject({ ...starterProject('D'), scenes: [scene] })).toThrow(ProjectError)
  })

  test('accepts a custom scene', () => {
    const scene = {
      id: 'c',
      kind: 'custom',
      caption: 'x',
      html: '<b></b>',
      css: '',
      script: 'export function draw() {}',
    }
    expect(parseProject({ ...starterProject('D'), scenes: [scene] }).scenes[0].kind).toBe('custom')
  })
})
