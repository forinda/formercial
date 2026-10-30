// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { parseProject, type Block, type Project, type Scene } from '@/core/project'
import { resolveTimeline } from '@/core/timeline'
import { createPlayer, sceneNeeds } from '@/player/player'
import { PRESETS, fromPreset } from './index'

const blocksOf = (project: Project) =>
  project.scenes.flatMap((s) => (s.kind === 'blocks' ? s.blocks : []))

// A Record, so adding a block type won't compile until the presets are checked for it.
const BLOCK_TYPES: Record<Block['type'], true> = {
  eyebrow: true,
  headline: true,
  text: true,
  code: true,
  terminal: true,
  tree: true,
  stamp: true,
  cards: true,
  chips: true,
  end: true,
}
const TRANSITIONS: Scene['transition'][] = ['fade', 'cut', 'slide']
const LANGS = ['ts', 'js', 'py', 'sql', 'json', 'plain']

describe('presets', () => {
  test('ships the showcase and the three language tours', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'showcase',
      'typescript-intro',
      'javascript-basics',
      'python-basics',
    ])
  })

  for (const preset of PRESETS) {
    describe(preset.id, () => {
      const project = parseProject(preset.project)

      test('uses every block type and every transition', () => {
        expect(new Set(blocksOf(project).map((b) => b.type))).toEqual(
          new Set(Object.keys(BLOCK_TYPES)),
        )
        expect(new Set(project.scenes.map((s) => s.transition))).toEqual(new Set(TRANSITIONS))
      })

      test('has enough scenes to choose from, in about a minute or more', () => {
        expect(project.scenes.length).toBeGreaterThanOrEqual(10)
        expect(resolveTimeline(project, {}, sceneNeeds).total).toBeGreaterThanOrEqual(50)
      })

      test('has spoken lines that fit their scenes once voiced', () => {
        // About 2.5 words a second; a line plus its 1.3s tail should fit its scene.
        for (const s of project.scenes) {
          const words = s.spoken.trim().split(/\s+/).length
          expect(words / 2.5 + 1.3, `${preset.id}/${s.id}: "${s.spoken}"`).toBeLessThanOrEqual(
            s.minSeconds + 0.5,
          )
        }
      })

      test('draws every moment in every format without an error', () => {
        for (const format of ['16:9', '9:16', '1:1'] as const) {
          const timeline = resolveTimeline(project, {}, sceneNeeds)
          const host = document.createElement('div')
          const player = createPlayer(host, project, timeline, format, { trusted: true })
          for (let t = 0; t < timeline.total; t += 0.5) player.frame(t)
          expect([...player.errors]).toEqual([])
          player.destroy()
        }
      })

      if (preset.lang !== 'mixed') {
        test('shows code in its own language', () => {
          const langs = blocksOf(project).flatMap((b) => (b.type === 'code' ? [b.lang] : []))
          expect(new Set(langs)).toEqual(new Set([preset.lang]))
        })

        test('renders as-is, with no custom code to trust', () => {
          expect(project.scenes.every((s) => s.kind === 'blocks')).toBe(true)
        })
      }
    })
  }

  describe('showcase', () => {
    const project = PRESETS.find((p) => p.id === 'showcase')!.project
    const blocks = blocksOf(project)

    test('shows every code language', () => {
      expect(new Set(blocks.flatMap((b) => (b.type === 'code' ? [b.lang] : [])))).toEqual(
        new Set(LANGS),
      )
    })

    test('shows both stamp tones, and one leaving again', () => {
      const stamps = blocks.flatMap((b) => (b.type === 'stamp' ? [b] : []))
      expect(new Set(stamps.map((b) => b.tone))).toEqual(new Set(['good', 'bad']))
      expect(stamps.some((b) => b.until !== undefined)).toBe(true)
    })

    test('shows a custom scene, a silent scene and one with no caption', () => {
      expect(project.scenes.some((s) => s.kind === 'custom')).toBe(true)
      expect(project.scenes.some((s) => !s.spoken.trim())).toBe(true)
      expect(project.scenes.some((s) => !s.caption.trim())).toBe(true)
    })
  })

  test('fromPreset names the new project and keeps the preset untouched', () => {
    const p = fromPreset('python-basics', 'My Python Ad')
    expect(p.name).toBe('My Python Ad')
    expect(PRESETS.find((x) => x.id === 'python-basics')!.project.name).not.toBe('My Python Ad')
  })

  test('fromPreset refuses an unknown preset and lists the real ones', () => {
    expect(() => fromPreset('cobol', 'x')).toThrow(
      /showcase, typescript-intro, javascript-basics, python-basics/,
    )
  })

  test('fromPreset can use another voice', () => {
    expect(fromPreset('python-basics', 'x', 'en-GB-SoniaNeural').voice.tts).toBe(
      'en-GB-SoniaNeural',
    )
    expect(fromPreset('python-basics', 'x').voice.tts).toBe('en-US-AvaNeural')
  })
})
