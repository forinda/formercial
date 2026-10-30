// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { parseProject } from '@/core/project'
import { resolveTimeline } from '@/core/timeline'
import { sceneNeeds } from '@/player/player'
import { PRESETS, fromPreset } from './index'

describe('presets', () => {
  test('ships the three starters', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'typescript-intro',
      'javascript-basics',
      'python-basics',
    ])
  })

  for (const preset of PRESETS) {
    describe(preset.id, () => {
      const project = parseProject(preset.project)

      test('is a valid project', () => {
        expect(project.scenes.length).toBeGreaterThanOrEqual(4)
      })

      test('runs about 30 seconds before any voice', () => {
        const { total } = resolveTimeline(project, {}, sceneNeeds)
        expect(total).toBeGreaterThanOrEqual(28)
        expect(total).toBeLessThanOrEqual(32)
      })

      test('has spoken lines short enough to keep it near 30s once voiced', () => {
        // About 2.5 words a second; a line plus its 1.3s tail should fit its scene.
        for (const s of project.scenes) {
          const words = s.spoken.trim().split(/\s+/).length
          expect(words / 2.5 + 1.3, `${preset.id}/${s.id}: "${s.spoken}"`).toBeLessThanOrEqual(
            s.minSeconds + 0.5,
          )
        }
      })

      test('shows code in its own language', () => {
        const langs = project.scenes
          .flatMap((s) => (s.kind === 'blocks' ? s.blocks : []))
          .flatMap((b) => (b.type === 'code' ? [b.lang] : []))
        expect(langs.length).toBeGreaterThan(0)
        expect(new Set(langs)).toEqual(new Set([preset.lang]))
      })
    })
  }

  test('fromPreset names the new project and keeps the preset untouched', () => {
    const p = fromPreset('python-basics', 'My Python Ad')
    expect(p.name).toBe('My Python Ad')
    expect(PRESETS.find((x) => x.id === 'python-basics')!.project.name).not.toBe('My Python Ad')
  })

  test('fromPreset refuses an unknown preset and lists the real ones', () => {
    expect(() => fromPreset('cobol', 'x')).toThrow(
      /typescript-intro, javascript-basics, python-basics/,
    )
  })
})
