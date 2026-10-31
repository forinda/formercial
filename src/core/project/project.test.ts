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

  test('rejects scene ids that could leave the project folder', () => {
    for (const id of ['../x', 'a/b', '', 'a b', '.hidden']) {
      const scene = { id, kind: 'blocks', caption: 'x', blocks: [] }
      expect(() => parseProject({ ...starterProject('D'), scenes: [scene] })).toThrow(ProjectError)
    }
  })

  test('theme values that end up in CSS are plain', () => {
    const base = starterProject('D')
    const bad = [
      {
        ...base.theme,
        fonts: { ...base.theme.fonts, display: "X'; } body { background: url(//evil) }" },
      },
      { ...base.theme, colors: { ...base.theme.colors, bg: 'red; --x: url(//evil)' } },
      {
        ...base.theme,
        fonts: {
          ...base.theme.fonts,
          files: [{ family: "a'b", weight: 400, path: 'media/fonts/a.woff2' }],
        },
      },
      {
        ...base.theme,
        fonts: {
          ...base.theme.fonts,
          files: [{ family: 'A', weight: 5000, path: 'media/fonts/a.woff2' }],
        },
      },
    ]
    for (const theme of bad) expect(() => parseProject({ ...base, theme })).toThrow(ProjectError)
    expect(
      parseProject({
        ...base,
        theme: { ...base.theme, colors: { ...base.theme.colors, bg: '#0D2226' } },
      }).theme.colors.bg,
    ).toBe('#0D2226')
  })
})
