// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { parseProject, starterProject, type Project } from '../core/project'
import { resolveTimeline, type Clip } from '../core/timeline'
import { createPlayer, sceneNeeds } from './player'

const project = (scenes: unknown[]): Project => parseProject({ ...starterProject('T'), scenes })

const scenes = [
  {
    id: 's1',
    kind: 'blocks',
    minSeconds: 5,
    caption: 'First',
    blocks: [
      { type: 'headline', text: 'One schema.', accent: 'schema' },
      { type: 'code', at: 1, cps: 10, lang: 'ts', source: 'const users = table("users", {})' },
    ],
  },
  {
    id: 's2',
    kind: 'blocks',
    minSeconds: 5,
    caption: 'Second',
    blocks: [{ type: 'text', text: 'Two' }],
  },
]

function mount(p: Project, clips: Record<string, Clip> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const timeline = resolveTimeline(p, clips, sceneNeeds)
  return { host, timeline, player: createPlayer(host, p, timeline, '16:9', { trusted: true }) }
}

// Shadow roots aren't in innerHTML: serialize each scene's root too.
const snapshot = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[data-scene]')]
    .map((s) => `${s.dataset.scene}|${s.getAttribute('style')}|${s.shadowRoot!.innerHTML}`)
    .join('\n')

const live = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[data-scene]')]
    .filter((s) => s.dataset.live === 'true')
    .map((s) => s.dataset.scene)

describe('player', () => {
  test('same t gives the same DOM', () => {
    const a = mount(project(scenes))
    const b = mount(project(scenes))
    b.player.frame(1.1)
    a.player.frame(7.3)
    b.player.frame(7.3)
    expect(snapshot(a.host)).toBe(snapshot(b.host))
  })

  test('only the scene covering t is visible', () => {
    const { host, player, timeline } = mount(project(scenes))
    player.frame(1)
    expect(live(host)).toEqual(['s1'])
    player.frame(timeline.scenes[1].start + 0.5)
    expect(live(host)).toEqual(['s2'])
  })

  test('typing shows floor((local - at) * cps) characters', () => {
    const { host, player } = mount(project(scenes))
    player.frame(2.5)
    const s1 = host.querySelector<HTMLElement>('[data-scene="s1"]')!.shadowRoot!
    expect(s1.querySelector('.typed')!.textContent).toHaveLength(15)
  })

  test('custom scene error is contained', () => {
    const p = project([
      scenes[1],
      {
        id: 'c',
        kind: 'custom',
        caption: '',
        script: 'export function draw() { throw new Error("boom") }',
      },
      { id: 'n', kind: 'custom', caption: '', script: 'const x = 1' },
    ])
    const { host, player, timeline } = mount(p)
    player.frame(timeline.scenes[1].start + 0.1)
    player.frame(timeline.scenes[2].start + 0.1)
    expect(player.errors.get('c')?.message).toBe('boom')
    expect(player.errors.get('n')?.message).toMatch(/draw/)
    player.frame(0.5)
    expect(live(host)).toEqual(['s2'])
    const c = host.querySelector<HTMLElement>('[data-scene="c"]')!.shadowRoot!
    expect(c.querySelector('.scene-error')!.textContent).toContain('boom')
  })

  test('a custom scene draws from t', () => {
    const p = project([
      {
        id: 'c',
        kind: 'custom',
        caption: '',
        html: '<p id="n"></p>',
        script:
          'export function draw(t, ctx) { ctx.root.getElementById("n").textContent = t.toFixed(1) + "/" + ctx.width }',
      },
    ])
    const { host, player } = mount(p)
    player.frame(1.25)
    const c = host.querySelector<HTMLElement>('[data-scene="c"]')!.shadowRoot!
    expect(c.getElementById('n')!.textContent).toBe('1.3/1920')
  })

  test('sceneNeeds covers the slowest block', () => {
    const [scene] = project([
      {
        id: 'a',
        kind: 'blocks',
        caption: '',
        blocks: [
          { type: 'text', text: 'x' },
          { type: 'code', at: 2, source: 'x'.repeat(68) },
        ],
      },
    ]).scenes
    expect(sceneNeeds(scene)).toBe(5)
  })

  test('captions show only during the clip', () => {
    const { host, player } = mount(project(scenes), {
      s1: { path: 'voice/s1.tts.mp3', seconds: 2 },
    })
    const caption = host.querySelector<HTMLElement>('[data-caption]')!
    player.frame(1)
    expect(caption.hidden).toBe(false)
    expect(caption.textContent).toBe('First')
    player.frame(2.1)
    expect(caption.hidden).toBe(true)
  })

  test('an untrusted project does not run custom scenes', () => {
    const p = project([
      {
        id: 'c',
        kind: 'custom',
        caption: '',
        html: '<img src=x onerror="window.ran = true"><p id="n"></p>',
        css: '</style><img src=x onerror="window.ran = true">',
        script: 'window.ran = true; export function draw() {}',
      },
    ])
    const host = document.createElement('div')
    document.body.append(host)
    const timeline = resolveTimeline(p, {}, sceneNeeds)
    const player = createPlayer(host, p, timeline, '16:9')
    player.frame(0.5)
    expect((window as { ran?: boolean }).ran).toBeUndefined()
    const c = host.querySelector<HTMLElement>('[data-scene="c"]')!.shadowRoot!
    expect(c.getElementById('n')).toBeNull()
    expect(c.querySelector('.scene-locked')!.textContent).toMatch(/trust/i)
  })

  test('custom css cannot break out of its style element', () => {
    const p = project([
      {
        id: 'c',
        kind: 'custom',
        caption: '',
        css: '</style><b id="out">x</b>',
        script: 'export function draw() {}',
      },
    ])
    const { host, player } = mount(p)
    player.frame(0.5)
    const c = host.querySelector<HTMLElement>('[data-scene="c"]')!.shadowRoot!
    expect(c.getElementById('out')).toBeNull()
  })

  test('stored fonts are declared for the stage', () => {
    const base = project([scenes[1]])
    const p = {
      ...base,
      theme: {
        ...base.theme,
        fonts: {
          ...base.theme.fonts,
          files: [{ family: 'Unbounded', weight: 800, path: 'media/fonts/unbounded-800.woff2' }],
        },
      },
    }
    const host = document.createElement('div')
    document.body.append(host)
    createPlayer(host, p, resolveTimeline(p, {}, sceneNeeds), '16:9', {
      fontUrl: (path) => `/files/${path}`,
    })
    expect(host.querySelector('style')!.textContent).toContain(
      "src: url('/files/media/fonts/unbounded-800.woff2')",
    )
  })
})
