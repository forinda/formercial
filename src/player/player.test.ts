// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { parseProject, starterProject, type Project } from '@/core/project/project'
import { resolveTimeline, type Clip } from '@/core/project/timeline'
import { ArrayStepsSchema } from '@/core/project/project'
import { arrayView, doodleTimes, editorView, stackView } from './blocks'
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
      fileUrl: (path) => `/files/${path}`,
    })
    expect(host.querySelector('style')!.textContent).toContain(
      "src: url('/files/media/fonts/unbounded-800.woff2')",
    )
  })

  test('an icon block uses project files, and a failed image is an error', async () => {
    const p = project([
      {
        id: 'a',
        kind: 'blocks',
        minSeconds: 1,
        caption: '',
        spoken: '',
        blocks: [{ type: 'icon', size: 8, items: [{ path: 'media/icons/x.svg', label: 'X' }] }],
      },
    ])
    const host = document.createElement('div')
    document.body.append(host)
    HTMLImageElement.prototype.decode = () => Promise.reject(new Error('nope'))
    const player = createPlayer(host, p, resolveTimeline(p, {}, sceneNeeds), '16:9', {
      fileUrl: (path) => `/files/${path}`,
    })
    const root = host.querySelector<HTMLElement>('[data-scene="a"]')!.shadowRoot!
    expect(root.querySelector('img')!.getAttribute('src')).toBe('/files/media/icons/x.svg')
    await player.loaded()
    expect(player.errors.get('media/icons/x.svg')?.message).toMatch(/can't load/)
  })

  test('locked custom scenes are listed, so a render can refuse them', () => {
    const p = project([
      scenes[1],
      { id: 'c', kind: 'custom', caption: '', script: 'export function draw() {}' },
    ])
    const host = document.createElement('div')
    document.body.append(host)
    const player = createPlayer(host, p, resolveTimeline(p, {}, sceneNeeds), '16:9')
    expect(player.locked).toEqual(['c'])
  })

  test('the stage and caption carry the classes their stylesheet styles', () => {
    const { host } = mount(project(scenes))
    const css = host.querySelector('style')!.textContent!
    const stage = host.querySelector<HTMLElement>('[data-format]')!
    const caption = host.querySelector<HTMLElement>('[data-caption]')!
    expect(css).toContain(`.${stage.className} {`)
    expect(css).toContain(`.${caption.className} {`)
  })
})

describe('doodle block', () => {
  const doodle = (strokes: unknown[], extra = {}) =>
    project([
      {
        id: 'd',
        kind: 'blocks',
        minSeconds: 1,
        caption: '',
        blocks: [{ type: 'doodle', strokes, ...extra }],
      },
    ])
  const parts = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-scene]')!.shadowRoot!

  test('items run in order, unless one says when, and the scene waits for them', () => {
    const p = doodle([
      { d: 'M0 0 H10', seconds: 2 },
      { text: 'hi', x: 0, y: 0, seconds: 1 },
      { d: 'M0 0 H10', at: 10, seconds: 1 },
    ])
    const block = p.scenes[0].kind === 'blocks' ? p.scenes[0].blocks[0] : null
    expect(doodleTimes((block as unknown as { strokes: never }).strokes)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
      { start: 10, end: 11 },
    ])
    expect(sceneNeeds(p.scenes[0])).toBeGreaterThanOrEqual(11)
  })

  test('a line draws from its start, and a label writes itself', () => {
    const { host, player } = mount(
      doodle([
        { d: 'M0 0 H10', seconds: 2 },
        { text: 'abcd', x: 0, y: 0, seconds: 2 },
      ]),
    )
    player.frame(1)
    const root = parts(host)
    expect(root.querySelector('path[pathLength]')!.getAttribute('stroke-dashoffset')).toBe('0.5')
    expect(root.querySelector('text')!.textContent).toBe('')
    player.frame(3)
    expect(root.querySelector('text')!.textContent).toBe('ab')
    player.frame(4)
    expect(root.querySelector('text')!.textContent).toBe('abcd')
  })

  test('only a mono label gets the mono font', () => {
    const { host } = mount(
      doodle([
        { text: 'note', x: 0, y: 0 },
        { text: 'git status', x: 0, y: 60, mono: true },
      ]),
    )
    const labels = parts(host).querySelectorAll('text')
    expect(labels[0].classList.contains('doodle-mono')).toBe(false)
    expect(labels[1].classList.contains('doodle-mono')).toBe(true)
  })

  test('a fill fades in up to its opacity', () => {
    const { host, player } = mount(
      doodle([{ d: 'M0 0 H10', seconds: 2, fill: 'accent', fillOpacity: 0.5 }]),
    )
    player.frame(1)
    const fill = parts(host).querySelector('path[fill="var(--accent)"]')!
    expect(fill.getAttribute('opacity')).toBe('0.25')
    player.frame(2)
    expect(fill.getAttribute('opacity')).toBe('0.5')
  })

  test('the same time draws the same frame, whatever came before', () => {
    const strokes = [
      { d: 'M0 0 H10', seconds: 1, flow: { count: 3, speed: 5 } },
      { text: 'abc', x: 0, y: 0 },
    ]
    const a = mount(doodle(strokes))
    a.player.frame(0.5)
    const b = mount(doodle(strokes))
    b.player.frame(5)
    b.player.frame(0.5)
    expect(snapshot(a.host)).toBe(snapshot(b.host))
  })

  test('9:16 draws its tall art, other formats the wide one, on one timeline', () => {
    const p = doodle([{ text: 'wide', x: 0, y: 0, seconds: 1 }], {
      tall: { strokes: [{ text: 'tall', x: 0, y: 0, seconds: 9 }] },
    })
    expect(sceneNeeds(p.scenes[0])).toBeGreaterThanOrEqual(9)
    const timeline = resolveTimeline(p, {}, sceneNeeds)
    const words = (format: '16:9' | '9:16') => {
      const host = document.createElement('div')
      const player = createPlayer(host, p, timeline, format, { trusted: true })
      player.frame(9)
      return parts(host).querySelector('text')!.textContent
    }
    expect(words('16:9')).toBe('wide')
    expect(words('9:16')).toBe('tall')
  })

  test('the wobble bends lines but not labels', () => {
    const { host, player } = mount(
      doodle([
        { d: 'M0 0 H10', seconds: 0 },
        { text: 'abc', x: 0, y: 0, seconds: 0 },
      ]),
    )
    player.frame(1)
    const root = parts(host)
    expect(root.querySelector('path[pathLength]')!.closest('[filter]')).not.toBeNull()
    expect(root.querySelector('text')!.closest('[filter]')).toBeNull()
  })

  test('a label is text, never markup', () => {
    const { host, player } = mount(doodle([{ text: '<img src=x onerror=alert(1)>', x: 0, y: 0 }]))
    player.frame(5)
    expect(parts(host).querySelector('img')).toBeNull()
  })

  test('a strange viewBox or an unknown field is refused', () => {
    expect(() => doodle([], { viewBox: '"><script>' })).toThrow()
    expect(() => doodle([{ d: 'M0 0', onclick: 'x' }])).toThrow()
  })
})

describe('transitions', () => {
  const two = (transition: string, extra = {}) =>
    project([
      {
        id: 'a',
        kind: 'blocks',
        minSeconds: 2,
        caption: '',
        blocks: [{ type: 'text', text: 'A' }],
      },
      {
        id: 'b',
        kind: 'blocks',
        minSeconds: 2,
        caption: '',
        transition,
        blocks: [{ type: 'text', text: 'B' }],
        ...extra,
      },
    ])
  const scenesOf = (host: HTMLElement) => ({
    a: host.querySelector<HTMLElement>('[data-scene="a"]')!,
    b: host.querySelector<HTMLElement>('[data-scene="b"]')!,
  })

  test('a break keeps the old scene on top until it has gone', () => {
    const { host, player, timeline } = mount(two('shatter'))
    player.frame(timeline.scenes[1].start + 0.2)
    const { a, b } = scenesOf(host)
    expect(a.style.visibility).toBe('visible')
    expect(Number(a.style.zIndex)).toBeGreaterThan(Number(b.style.zIndex))
    expect(host.querySelector('.fm-edges path')!.getAttribute('d')).toContain('M')
    player.frame(timeline.scenes[1].start + 1.5)
    expect(a.style.visibility).toBe('hidden')
    expect(b.style.clipPath).toBe('')
    expect(host.querySelector('.fm-edges path')!.getAttribute('d')).toBe('')
  })

  test('a reveal keeps the new scene on top, and clears its clip when done', () => {
    const { host, player, timeline } = mount(two('iris'))
    player.frame(timeline.scenes[1].start + 0.1)
    const { a, b } = scenesOf(host)
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex))
    expect(b.style.clipPath).toContain('circle')
    player.frame(timeline.scenes[1].start + 1)
    expect(b.style.clipPath).toBe('')
  })

  test('transitionSeconds sets how long it lasts', () => {
    const { host, player, timeline } = mount(two('wipe', { transitionSeconds: 2 }))
    player.frame(timeline.scenes[1].start + 1.5)
    expect(scenesOf(host).a.style.visibility).toBe('visible')
    player.frame(timeline.scenes[1].start + 2)
    expect(scenesOf(host).a.style.visibility).toBe('hidden')
  })

  test('the first scene has nothing to break from, and just appears', () => {
    const p = project([
      { id: 'a', kind: 'blocks', minSeconds: 2, caption: '', transition: 'shatter', blocks: [] },
    ])
    const { host, player } = mount(p)
    player.frame(0.1)
    expect(scenesOf(host).a.style.visibility).toBe('visible')
    expect(scenesOf(host).a.style.clipPath).toBe('')
  })

  test('the same moment draws the same frame, whatever came before', () => {
    const a = mount(two('crumble'))
    const b = mount(two('crumble'))
    const at = a.timeline.scenes[1].start + 0.4
    a.player.frame(at)
    b.player.frame(9)
    b.player.frame(at)
    expect(snapshot(a.host)).toBe(snapshot(b.host))
  })
})

describe('editor block', () => {
  const source = ['a', 'b', 'c', 'd', 'e'].join('\n')

  test('stays still until typing passes the last row', () => {
    expect(editorView(source, 3, 1, 5).scroll).toBe(0)
  })

  test('scrolls one row per line past the view, and ends with the last line shown', () => {
    expect(editorView(source, 3, 1, 7).scroll).toBe(1)
    const end = editorView(source, 3, 1, 100)
    expect(end.scroll).toBe(end.lines - 3)
  })

  test('has room for a new line by the time the caret reaches it', () => {
    expect(editorView(source, 3, 1, 6)).toMatchObject({ line: 3, scroll: 1 })
  })

  test('reports the line and column of the caret', () => {
    expect(editorView(source, 3, 1, 3)).toMatchObject({ typed: 3, line: 1, col: 1 })
  })
})

describe('array block', () => {
  const block = (steps: unknown[]) =>
    ({
      type: 'array',
      values: [5, 1, 4],
      steps: (steps as { seconds?: number }[]).map((s) => ({ seconds: 1, ...s })),
      count: true,
    }) as never
  const xs = (b: never, t: number) => arrayView(b, t).items.map((it) => it.x)

  test("a swap ends with the two items in each other's slots", () => {
    const b = block([{ do: 'swap', a: 0, b: 1 }])
    expect(xs(b, 0)).toEqual([0, 1, 2])
    expect(xs(b, 0.5)).toEqual([0.5, 0.5, 2])
    expect(xs(b, 1)).toEqual([1, 0, 2])
  })

  test('slots follow the items, so a later step moves the right one', () => {
    const b = block([
      { do: 'swap', a: 0, b: 1 },
      { do: 'swap', a: 1, b: 2 },
    ])
    expect(xs(b, 2)).toEqual([2, 0, 1])
  })

  test('lift, shift and drop act like inserting a card', () => {
    const b = block([
      { do: 'lift', a: 1 },
      { do: 'shift', a: 0, b: 1 },
      { do: 'drop', a: 0 },
    ])
    expect(arrayView(b, 1).items[1].y).toBe(1)
    expect(xs(b, 3)).toEqual([1, 0, 2])
    expect(arrayView(b, 3).items[1].y).toBe(0)
  })

  test('a step past the row does nothing, and returns at once', () => {
    const b = block([
      { do: 'mark', a: 0, b: 2_000_000_000 },
      { do: 'shift', a: 0, b: 2_000_000_000 },
      { do: 'lift', a: 1 },
      { do: 'drop', a: 2_000_000_000 },
    ])
    const view = arrayView(b, 10)
    expect(view.items.every((it) => it.done)).toBe(true)
    expect(view.items[0].x).toBe(0)
    expect(view.items[1].x).toBe(1)
  })

  test('the schema refuses slots past the most a row can hold', () => {
    expect(ArrayStepsSchema.safeParse([{ do: 'mark', a: 0, b: 20 }]).success).toBe(false)
  })

  test('counts comparisons, and keeps the latest note', () => {
    const b = block([
      { do: 'compare', a: 0, b: 1, note: 'first' },
      { do: 'compare', a: 1, b: 2 },
      { do: 'mark', a: 0, b: 2, note: 'last' },
    ])
    expect(arrayView(b, 1.5)).toMatchObject({ compares: 2, note: 'first' })
    expect(arrayView(b, 3)).toMatchObject({ compares: 2, note: 'last' })
    expect(arrayView(b, 3).items.every((it) => it.done)).toBe(true)
  })
})

describe('stack block', () => {
  test('has its own class, so scene layout keeps the stack class to itself', () => {
    const p = project([
      {
        id: 's',
        kind: 'blocks',
        minSeconds: 1,
        caption: '',
        blocks: [{ type: 'stack', steps: [{ do: 'push', name: 'main' }] }],
      },
    ])
    const { host } = mount(p)
    const scene = [...host.querySelectorAll('*')].find((e) => e.shadowRoot)?.shadowRoot
    const root = scene ?? host
    expect(root.querySelector('.stk')?.closest('.stack')).not.toBeNull()
  })

  const block = {
    type: 'stack',
    steps: [
      { do: 'push', name: 'main', vars: { n: 21 }, seconds: 1, frame: 0 },
      { do: 'push', name: 'twice', vars: { x: 21 }, seconds: 1, frame: 0, note: 'a copy' },
      { do: 'set', name: 'x', value: 42, seconds: 1, frame: 0 },
      { do: 'set', name: 'n', value: 1, seconds: 1, frame: 1 },
      { do: 'pop', seconds: 1, frame: 0 },
    ],
  } as never

  test('frames pile up, newest last', () => {
    expect(stackView(block, 2).frames.map((f) => f.name)).toEqual(['main', 'twice'])
    expect(stackView(block, 2).note).toBe('a copy')
  })

  test('set changes the frame it names, counted from the top', () => {
    const { frames } = stackView(block, 4)
    expect(frames[1].vars.x).toBe(42)
    expect(frames[0].vars.n).toBe(1)
  })

  test('pop removes the top frame, and any time can be drawn first', () => {
    expect(stackView(block, 5).frames.map((f) => f.name)).toEqual(['main'])
    expect(stackView(block, 0.5).frames.map((f) => f.name)).toEqual(['main'])
  })
})
