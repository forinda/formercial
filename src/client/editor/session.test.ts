import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { starterProject } from '@/core/project/project'
import { ProjectSession } from './session'

function server(version = 'v1') {
  const state = { version, puts: [] as { baseVersion: string }[], next: 409 as number | null }
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body))
      state.puts.push(body)
      if (body.baseVersion !== state.version) {
        return new Response(JSON.stringify({ current: state.version }), { status: 409 })
      }
      state.version = `v${state.puts.length + 1}`
      return new Response(JSON.stringify({ version: state.version }), { status: 200 })
    }
    return new Response(
      JSON.stringify({
        project: starterProject('Server'),
        version: state.version,
        clips: {},
        trusted: true,
      }),
    )
  })
  return { state, fetch: fetch as unknown as typeof globalThis.fetch }
}

const session = (fetch: typeof globalThis.fetch) =>
  new ProjectSession(
    'demo',
    { project: starterProject('Local'), version: 'v1', clips: {}, trusted: true },
    fetch,
  )

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ProjectSession', () => {
  test('debounced save sends baseVersion', async () => {
    const { state, fetch } = server()
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    s.set({ ...s.state.project, name: 'B' })
    expect(s.state.status).toBe('saving')
    await vi.advanceTimersByTimeAsync(600)
    expect(state.puts).toHaveLength(1)
    expect(state.puts[0].baseVersion).toBe('v1')
    const [, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]
    expect((init.headers as Record<string, string>)['x-formercial-editor']).toBe('1')
    expect(s.state).toMatchObject({ status: 'saved', version: 'v2' })
  })

  test('travel saves pending edits first, so they can be got back', async () => {
    const { state, fetch } = server()
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    await s.travel('/undo')
    expect(state.puts).toHaveLength(1)
    const urls = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls
    expect(urls.findIndex(([u]) => u.endsWith('/undo'))).toBeGreaterThan(0)
  })

  test('409 sets conflict', async () => {
    const { state, fetch } = server('v9')
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    await vi.advanceTimersByTimeAsync(600)
    expect(s.state.status).toBe('conflict')
    await s.overwrite()
    expect(state.puts.at(-1)!.baseVersion).toBe('v9')
    expect(s.state.status).toBe('saved')
  })

  test('outside change reloads when clean', async () => {
    const { fetch } = server('v5')
    const s = session(fetch)
    await s.outsideChange('v5')
    expect(s.state).toMatchObject({ status: 'saved', version: 'v5' })
    expect(s.state.project.name).toBe('Server')
  })

  test('outside change sets conflict when dirty', async () => {
    const { fetch } = server('v5')
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'Mine' })
    await s.outsideChange('v5')
    expect(s.state.status).toBe('conflict')
    expect(s.state.project.name).toBe('Mine')
  })

  test('its own save echoing back is ignored', async () => {
    const { fetch } = server()
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    await vi.advanceTimersByTimeAsync(600)
    await s.outsideChange('v2')
    expect(s.state).toMatchObject({ status: 'saved', version: 'v2' })
    expect(s.state.project.name).toBe('A')
  })

  test('its own save echoing back before the response is not a conflict', async () => {
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    const names: string[] = []
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        names.push(body.project.name)
        if (names.length === 1) await held
        return new Response(JSON.stringify({ version: `v${names.length + 1}`, trusted: true }))
      }
      return new Response(
        JSON.stringify({
          project: starterProject('Server'),
          version: 'v2',
          clips: {},
          trusted: true,
        }),
      )
    }) as unknown as typeof globalThis.fetch
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    await vi.advanceTimersByTimeAsync(600)
    // The echo of save #1 arrives first, then an edit, then the response.
    const echo = s.outsideChange('v2')
    await vi.advanceTimersByTimeAsync(0)
    expect(s.state.status).not.toBe('conflict')
    s.set({ ...s.state.project, name: 'B' })
    release()
    await echo
    await vi.advanceTimersByTimeAsync(600)
    expect(names).toEqual(['A', 'B'])
    expect(s.state).toMatchObject({ status: 'saved', version: 'v3' })
  })

  test('a network failure while saving shows an error instead of saving forever', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof globalThis.fetch
    const s = session(fetch)
    s.set({ ...s.state.project, name: 'A' })
    await vi.advanceTimersByTimeAsync(600)
    expect(s.state.status).toBe('error')
    expect(s.state.error).toMatch(/Failed to fetch/)
  })
})
