// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { parseProject } from '@/core/project/project'
import { resolveTimeline } from '@/core/project/timeline'
import { createPlayer, sceneNeeds } from '../player'

const project = parseProject({
  version: 1,
  name: 'x',
  formats: ['16:9'],
  captions: false,
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
      minSeconds: 0,
      caption: '',
      blocks: [
        {
          type: 'stage3d',
          actors: [{ kind: 'person', id: 'a' }],
          timeline: [{ at: 1, actor: 'a', seconds: 4, move: [1, 0, 0] }],
        },
      ],
    },
  ],
})

describe('stage3d in the player', () => {
  test('the scene lasts as long as its timeline', () => {
    expect(resolveTimeline(project, {}, sceneNeeds).total).toBeGreaterThanOrEqual(5)
  })

  test('with no GPU, it reports an error and the page keeps going', async () => {
    const timeline = resolveTimeline(project, {}, sceneNeeds)
    const host = document.createElement('div')
    const player = createPlayer(host, project, timeline, '16:9')
    player.frame(0)
    await player.loaded()
    player.frame(2)
    expect(player.errors.has('stage3d')).toBe(true)
    player.destroy()
  }, 20_000)

  test('it fills the scene, and does not lift in like other blocks', () => {
    const timeline = resolveTimeline(project, {}, sceneNeeds)
    const host = document.createElement('div')
    const player = createPlayer(host, project, timeline, '16:9')
    player.frame(0)
    const root = host.querySelector<HTMLElement>('[data-scene="s"]')!.shadowRoot!
    expect(root.querySelector('canvas.stage3d')).not.toBeNull()
    expect(root.querySelector<HTMLElement>('.block')!.style.opacity).toBe('')
    player.destroy()
  })
})

describe('stage3d appearing at a time', () => {
  test('the canvas is hidden until `at`, and again when seeking back', () => {
    const late = structuredClone(project)
    const scene = late.scenes[0]
    if (scene.kind !== 'blocks') throw new Error('not blocks')
    scene.blocks[0].at = 2
    const host = document.createElement('div')
    const player = createPlayer(host, late, resolveTimeline(late, {}, sceneNeeds), '16:9')
    const canvas = () =>
      host.querySelector('[data-scene="s"]')!.shadowRoot!.querySelector<HTMLElement>('canvas')!
    player.frame(1)
    expect(canvas().style.visibility).toBe('hidden')
    player.frame(3)
    expect(canvas().style.visibility).toBe('visible')
    player.frame(1)
    expect(canvas().style.visibility).toBe('hidden')
    player.destroy()
  })
})
