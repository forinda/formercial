// @vitest-environment happy-dom
import { memoryStorage } from '@forinda/kickjs-storage'
import { describe, expect, test, vi } from 'vitest'
import { createWorkspace } from '@/core/storage/workspace'
import { parseProject, TRANSITIONS, type Block, type Project } from '@/core/project/project'
import { resolveTimeline } from '@/core/project/timeline'
import { createPlayer, sceneNeeds } from '@/player/player'
import { PRESETS, fromPreset, storePresetFonts } from './index'

const blocksOf = (project: Project) =>
  project.scenes.flatMap((s) => (s.kind === 'blocks' ? s.blocks : []))

// The stages of a lesson, in teaching order: see site/guide/teaching-videos.md.
const LESSON_STAGES = ['hook', 'why', 'try', 'reflect', 'challenge', 'check']
const secondsToSay = (spoken: string) => spoken.trim().split(/\s+/).length / 2.5

// A Record, so adding a block type won't compile until the showcase is checked for it.
const BLOCK_TYPES: Record<Block['type'], true> = {
  eyebrow: true,
  headline: true,
  text: true,
  code: true,
  editor: true,
  array: true,
  stack: true,
  terminal: true,
  tree: true,
  stamp: true,
  cards: true,
  chips: true,
  icon: true,
  end: true,
  doodle: true,
  stage3d: true,
}
const LANGS = ['ts', 'js', 'py', 'sql', 'json', 'plain']

describe('presets', () => {
  test('ships the showcase and the four lessons', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'showcase',
      'doodle-light-bulb',
      'typescript-types',
      'javascript-const-let',
      'python-objects',
    ])
  })

  for (const preset of PRESETS) {
    describe(preset.id, () => {
      const project = parseProject(preset.project)

      test('uses the main transitions', () => {
        const used = new Set(project.scenes.map((s) => s.transition))
        for (const t of ['fade', 'cut', 'slide'] as const) expect(used.has(t), t).toBe(true)
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

      if (preset.lang !== 'mixed' && preset.lang !== 'none') {
        test('shows code in its own language', () => {
          const langs = blocksOf(project).flatMap((b) => (b.type === 'code' ? [b.lang] : []))
          expect(new Set(langs)).toEqual(new Set([preset.lang]))
        })
      }

      if (preset.id !== 'showcase') {
        test('renders as-is, with no custom code to trust', () => {
          expect(project.scenes.every((s) => s.kind === 'blocks')).toBe(true)
        })

        test('follows the lesson stages, in order', () => {
          const ids = project.scenes.map((s) => s.id)
          expect(ids.filter((id) => LESSON_STAGES.includes(id))).toEqual(LESSON_STAGES)
          expect(ids[0]).toBe('hook')
        })

        test('gives its answer straight after the challenge', () => {
          const ids = project.scenes.map((s) => s.id)
          expect(ids.indexOf('check')).toBe(ids.indexOf('challenge') + 1)
        })

        test('tells viewers to pause for the challenge, and leaves time to reach it', () => {
          const scene = project.scenes.find((s) => s.id === 'challenge')!
          expect(scene.spoken).toMatch(/pause|stop here/i)
          expect(scene.minSeconds).toBeGreaterThanOrEqual(secondsToSay(scene.spoken) + 5)
        })

        test('holds the try-it-first scene long enough to reach pause', () => {
          const scene = project.scenes.find((s) => s.id === 'try')!
          expect(scene.minSeconds).toBeGreaterThanOrEqual(secondsToSay(scene.spoken) + 5)
        })
      }
    })
  }

  describe('doodle-light-bulb', () => {
    const preset = PRESETS.find((p) => p.id === 'doodle-light-bulb')!
    test('teaches with doodles, in a handwriting that reads on a phone', () => {
      const types = blocksOf(preset.project).map((b) => b.type)
      expect(types.filter((t) => t === 'doodle').length).toBeGreaterThanOrEqual(14)
      expect(preset.project.theme.fonts.display).toBe('Kalam')
    })
    test('every drawing has a tall version for TikTok and Shorts', () => {
      for (const b of blocksOf(preset.project)) {
        if (b.type === 'doodle') expect(b.tall?.strokes.length).toBeGreaterThan(0)
      }
    })
    test('every label fits inside its drawing', () => {
      // Kalam runs about 0.5 of its size per character at this weight.
      const check = (strokes: Extract<Block, { type: 'doodle' }>['strokes'], width: number) => {
        for (const s of strokes) {
          if ('text' in s) {
            expect(s.x + s.text.length * s.size * 0.5, s.text).toBeLessThanOrEqual(width)
          }
        }
      }
      for (const b of blocksOf(preset.project)) {
        if (b.type !== 'doodle') continue
        check(b.strokes, 1600)
        check(b.tall!.strokes, 900)
      }
    })
    test('runs long enough to explain it', () => {
      expect(resolveTimeline(preset.project, {}, sceneNeeds).total).toBeGreaterThanOrEqual(100)
    })
  })

  describe('python-objects', () => {
    const blocks = blocksOf(PRESETS.find((p) => p.id === 'python-objects')!.project)

    test('draws the ideas and shows the implementation in real code', () => {
      const types = blocks.map((b) => b.type)
      expect(types.filter((t) => t === 'doodle').length).toBeGreaterThanOrEqual(5)
      expect(types.filter((t) => t === 'code').length).toBeGreaterThanOrEqual(4)
    })

    test('every drawing has a tall version, and every label fits', () => {
      for (const b of blocks) {
        if (b.type !== 'doodle') continue
        expect(b.tall?.strokes.length).toBeGreaterThan(0)
        for (const [strokes, width] of [
          [b.strokes, 1600],
          [b.tall!.strokes, 900],
        ] as const) {
          for (const s of strokes) {
            if ('text' in s) {
              expect(s.x + s.text.length * s.size * 0.5, s.text).toBeLessThanOrEqual(width)
            }
          }
        }
      }
    })
  })

  describe('showcase', () => {
    const project = PRESETS.find((p) => p.id === 'showcase')!.project
    const blocks = blocksOf(project)

    test('uses every block type, except icons and 3D', () => {
      // Icons are files a project downloads, and 3D needs a GPU, which tests don't have.
      const wanted = Object.keys(BLOCK_TYPES).filter(
        (type) => type !== 'icon' && type !== 'stage3d',
      )
      expect(new Set(blocks.map((b) => b.type))).toEqual(new Set(wanted))
    })

    test('shows every transition', () => {
      expect(new Set(project.scenes.map((s) => s.transition))).toEqual(new Set(TRANSITIONS))
    })

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

  describe('storePresetFonts', () => {
    const css = (family: string) =>
      `/* latin */\n@font-face {\n  font-family: '${family}';\n  font-weight: 400;\n  src: url(https://fonts.gstatic.com/s/x/${family.replace(/ /g, '')}.woff2) format('woff2');\n}`
    const google = vi.fn(async (url: string | URL | Request) => {
      const address = String(url)
      if (address.includes('fonts.gstatic.com')) return new Response(new Uint8Array([1, 2, 3]))
      const family = decodeURIComponent(/family=([^:]+)/.exec(address)![1]).replace(/\+/g, ' ')
      return new Response(css(family))
    }) as unknown as typeof fetch

    async function start(id: string) {
      const ws = createWorkspace(memoryStorage())
      await ws.write('a', fromPreset(id, 'A'), null)
      return ws
    }

    for (const preset of PRESETS) {
      test(`${preset.id} keeps every font it uses in the project`, async () => {
        const ws = await start(preset.id)
        await storePresetFonts(ws, 'a', preset.id, google)
        const { files, display, body, mono } = (await ws.read('a')).project.theme.fonts
        const stored = new Set(files!.map((f) => f.family))
        expect(stored).toEqual(new Set([display, body, mono]))
        for (const f of files!) expect(await ws.getFile('a', f.path)).not.toBeNull()
      })
    }

    test('no network costs the fonts, not the project, and stops after one try', async () => {
      const ws = await start('python-objects')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const offline = vi.fn(async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch
      await expect(storePresetFonts(ws, 'a', 'python-objects', offline)).resolves.toBeUndefined()
      expect((await ws.read('a')).project.theme.fonts.files).toBeUndefined()
      expect(warn).toHaveBeenCalledTimes(1)
      warn.mockRestore()
    })
  })

  test('fromPreset names the new project and keeps the preset untouched', () => {
    const p = fromPreset('python-objects', 'My Python Ad')
    expect(p.name).toBe('My Python Ad')
    expect(PRESETS.find((x) => x.id === 'python-objects')!.project.name).not.toBe('My Python Ad')
  })

  test('fromPreset refuses an unknown preset and lists the real ones', () => {
    expect(() => fromPreset('cobol', 'x')).toThrow(
      /showcase, doodle-light-bulb, typescript-types, javascript-const-let, python-objects/,
    )
  })

  test('fromPreset can use another voice', () => {
    expect(fromPreset('python-objects', 'x', 'en-GB-SoniaNeural').voice.tts).toBe(
      'en-GB-SoniaNeural',
    )
    expect(fromPreset('python-objects', 'x').voice.tts).toBe('en-US-AvaNeural')
  })
})
