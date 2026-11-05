// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { parseProject, starterProject } from '@/core/project/project'
import { resolveTimeline } from '@/core/project/timeline'
import { gifFrame } from './blocks'
import { createPlayer, sceneNeeds } from './player'

describe('gifFrame', () => {
  // Three frames: 0.1 s, 0.2 s and 0.3 s long, 0.6 s in all.
  const starts = [0, 0.1, 0.3]
  const total = 0.6

  test('picks the frame showing at a time', () => {
    expect(gifFrame(starts, total, 0, true)).toBe(0)
    expect(gifFrame(starts, total, 0.05, true)).toBe(0)
    expect(gifFrame(starts, total, 0.1, true)).toBe(1)
    expect(gifFrame(starts, total, 0.29, true)).toBe(1)
    expect(gifFrame(starts, total, 0.45, true)).toBe(2)
  })

  test('loops back to the start, or holds the last frame', () => {
    expect(gifFrame(starts, total, 0.65, true)).toBe(0)
    expect(gifFrame(starts, total, 0.75, true)).toBe(1)
    expect(gifFrame(starts, total, 0.65, false)).toBe(2)
    expect(gifFrame(starts, total, 99, false)).toBe(2)
  })

  test('a single frame or a time before the start shows the first frame', () => {
    expect(gifFrame([0], 0.1, 5, true)).toBe(0)
    expect(gifFrame(starts, total, -1, true)).toBe(0)
  })
})

describe('gif block', () => {
  const scene = (block: Record<string, unknown>) => ({
    id: 'g',
    kind: 'blocks',
    minSeconds: 3,
    caption: '',
    spoken: '',
    blocks: [{ type: 'gif', path: 'media/cat.gif', ...block }],
  })

  test('takes only a .gif under media/', () => {
    const parse = (path: string) => () =>
      parseProject({ ...starterProject('T'), scenes: [scene({ path })] })
    expect(parse('media/cat.gif')).not.toThrow()
    expect(parse('media/cat.png')).toThrow()
    expect(parse('media/../cat.gif')).toThrow()
    expect(parse('cat.gif')).toThrow()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('draws the frame for the scene time, the same way every time', async () => {
    // A fake ImageDecoder: frames of 0.1, 0.2 and 0.1 s; a 10 ms delay plays at 100 ms, like browsers.
    const micros = [100_000, 200_000, 10_000]
    class FakeDecoder {
      tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 3 } }
      decode({ frameIndex }: { frameIndex: number }) {
        return Promise.resolve({ image: { duration: micros[frameIndex], close() {} } })
      }
      close() {}
    }
    vi.stubGlobal('ImageDecoder', FakeDecoder)
    vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(4)))
    let made = 0
    vi.stubGlobal('createImageBitmap', async () => ({
      id: made++,
      width: 40,
      height: 30,
      close() {},
    }))
    const drawn: number[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect() {},
      drawImage: (bitmap: { id: number }) => drawn.push(bitmap.id),
    } as never)

    const p = parseProject({ ...starterProject('T'), scenes: [scene({ at: 1, speed: 2 })] })
    const host = document.createElement('div')
    document.body.append(host)
    const player = createPlayer(host, p, resolveTimeline(p, {}, sceneNeeds), '16:9')
    await player.loaded()
    expect([...player.errors.keys()]).toEqual([])

    // At speed 2 the 0.4 s GIF loops every 0.2 s of scene time, starting at 1 s.
    const at = (t: number) => {
      player.frame(t)
      return drawn.at(-1)
    }
    expect(at(0.5)).toBe(0)
    expect(at(1.06)).toBe(1)
    expect(at(1.18)).toBe(2)
    expect(at(1.22)).toBe(0)
    expect(at(1.18)).toBe(2)
    const root = host.querySelector<HTMLElement>('[data-scene="g"]')!.shadowRoot!
    const canvas = root.querySelector('canvas')!
    expect([canvas.width, canvas.height]).toEqual([40, 30])
  })

  test('a GIF that fails to load is an error, under its path', async () => {
    vi.stubGlobal('ImageDecoder', class {})
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    const p = parseProject({ ...starterProject('T'), scenes: [scene({})] })
    const host = document.createElement('div')
    document.body.append(host)
    const player = createPlayer(host, p, resolveTimeline(p, {}, sceneNeeds), '16:9')
    await player.loaded()
    expect(player.errors.get('media/cat.gif')?.message).toMatch(/can't load/)
  })
})
