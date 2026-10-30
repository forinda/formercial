import { describe, expect, test } from 'vitest'
import { memoryStorage } from '@forinda/kickjs-storage'
import { describeChange } from './history-change'
import { createHistory, historyFileFor } from './history'
import { parseProject, starterProject, type Project } from './project'
import { createWorkspace } from './workspace'

const scene = (id: string, caption = id) => ({
  id,
  kind: 'blocks',
  blocks: [],
  caption,
  spoken: '',
  minSeconds: 1,
})
const project = (...scenes: ReturnType<typeof scene>[]): Project =>
  parseProject({ ...starterProject('T'), scenes })

function setup() {
  let time = 1_000_000
  const history = createHistory(':memory:', () => time)
  const ws = createWorkspace(memoryStorage(), { history })
  return { history, ws, tick: (ms: number) => (time += ms) }
}

/** Write as the next edit, from whatever is there now. */
async function edit(ws: ReturnType<typeof setup>['ws'], p: Project, source = 'editor') {
  const { version } = await ws.read('a')
  return ws.write('a', p, version, source)
}

describe('describeChange', () => {
  const base = project(scene('a'), scene('b'))
  test('names what happened', () => {
    expect(describeChange(null, base).text).toBe('Created')
    expect(describeChange(base, project(scene('a'))).text).toBe('Deleted scene 2')
    expect(describeChange(base, project(scene('a'), scene('b'), scene('c'))).text).toBe(
      'Added scene 3',
    )
    expect(describeChange(base, project(scene('b'), scene('a'))).text).toBe('Reordered scenes')
    expect(describeChange(base, { ...base, name: 'New' }).text).toBe('Changed name')
  })
  test('an edit to one scene has a key, so its saves can merge; structure does not', () => {
    const edited = project(scene('a', 'hello'), scene('b'))
    expect(describeChange(base, edited)).toEqual({ text: 'Edited scene 1', key: 'scene:a' })
    expect(describeChange(base, project(scene('b'), scene('a'))).key).toBe('')
  })
  test('the same two projects give the same answer', () => {
    const edited = project(scene('b', 'x'), scene('c'))
    expect(describeChange(base, edited)).toEqual(describeChange(base, edited))
  })
})

describe('historyFileFor', () => {
  test('lives in the ignored folder, one file per projects folder, the same every time', () => {
    const a = historyFileFor('/app', 'projects')
    expect(a).toMatch(/^\/app\/\.formercial\/history-[0-9a-f]{12}\.sqlite$/)
    expect(historyFileFor('/app', '/app/projects')).toBe(a)
    expect(historyFileFor('/app', '/elsewhere')).not.toBe(a)
    expect(historyFileFor('/app', 'projects', '/my/history.db')).toBe('/my/history.db')
  })
})

describe('history', () => {
  test('every save is recorded and an identical one is not', async () => {
    const { history, ws } = setup()
    const p = project(scene('a'))
    await ws.write('a', p, null, 'editor')
    await edit(ws, p)
    expect((await history.list('a')).map((r) => r.summary)).toEqual(['Created'])
    await edit(ws, project(scene('a'), scene('b')))
    expect((await history.list('a')).map((r) => r.summary)).toEqual(['Added scene 2', 'Created'])
  })

  test('saves of one edit merge into a step; a pause or another scene starts a new one', async () => {
    const { history, ws, tick } = setup()
    await ws.write('a', project(scene('a'), scene('b')), null, 'editor')
    await edit(ws, project(scene('a', 'h'), scene('b')))
    await edit(ws, project(scene('a', 'he'), scene('b')))
    expect((await history.list('a')).length).toBe(2)
    await edit(ws, project(scene('a', 'he'), scene('b', 'x')))
    expect((await history.list('a')).length).toBe(3)
    tick(31_000)
    await edit(ws, project(scene('a', 'he'), scene('b', 'xy')))
    expect((await history.list('a')).length).toBe(4)
  })

  test('undo restores the exact bytes, redo returns, and history survives both', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    const first = await ws.getFile('a', 'project.json')
    await edit(ws, project(scene('a'), scene('b')))
    const second = await ws.getFile('a', 'project.json')

    await ws.undo('a')
    expect(await ws.getFile('a', 'project.json')).toEqual(first)
    expect((await history.list('a')).length).toBe(2)
    await ws.redo('a')
    expect(await ws.getFile('a', 'project.json')).toEqual(second)
    expect(await ws.redo('a')).toBeNull()
  })

  test('an edit after an undo branches, and the abandoned step can still be restored', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a'), scene('b')))
    const abandoned = (await history.head('a'))!.id
    const bytes = await ws.getFile('a', 'project.json')
    await ws.undo('a')
    await edit(ws, project(scene('a'), scene('c')))
    expect(await ws.redo('a')).toBeNull()
    await ws.restore('a', abandoned)
    expect(await ws.getFile('a', 'project.json')).toEqual(bytes)
  })

  test('a change made outside the app is kept before a save replaces it', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    const outside = `${JSON.stringify(project(scene('a'), scene('z')), null, 2)}\n`
    await ws.putFile('a', 'project.json', new TextEncoder().encode(outside))
    await edit(ws, project(scene('q')))
    const revisions = await history.list('a')
    expect(revisions.map((r) => r.source)).toEqual(['editor', 'outside', 'editor'])
    await ws.restore('a', revisions[1].id)
    expect(new TextDecoder().decode((await ws.getFile('a', 'project.json'))!)).toBe(outside)
  })

  test('merging drops the version it replaced, unless another step still has it', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a', 'h')))
    const merged = (await history.head('a'))!.hash
    await edit(ws, project(scene('a', 'he')))
    const steps = await history.list('a')
    expect(steps.length).toBe(2)
    expect(steps.some((r) => r.hash === merged)).toBe(false)
    await ws.restore('a', steps[1].id)
    await ws.redo('a')
    expect((await history.head('a'))!.id).toBe(steps[0].id)
  })

  test('an edit after coming back to a step does not merge into it', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a', 'h')))
    const kept = await ws.getFile('a', 'project.json')
    await ws.undo('a')
    await ws.redo('a')
    await edit(ws, project(scene('a', 'he')))
    expect((await history.list('a')).length).toBe(3)
    await ws.undo('a')
    expect(await ws.getFile('a', 'project.json')).toEqual(kept)
  })

  test('list pages through every step, newest first', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a'), scene('b')))
    await edit(ws, project(scene('a'), scene('b'), scene('c')))
    const all = await history.list('a')
    expect(all.length).toBe(3)
    const first = await history.list('a', { limit: 2 })
    expect(first.map((r) => r.id)).toEqual([all[0].id, all[1].id])
    const rest = await history.list('a', { limit: 2, before: first[1].id })
    expect(rest.map((r) => r.id)).toEqual([all[2].id])
  })

  test('a named step does not merge with the next save', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a', 'h')))
    await history.setLabel('a', (await history.head('a'))!.id, 'v1')
    await edit(ws, project(scene('a', 'he')))
    const [latest, named] = await history.list('a')
    expect(latest.label).toBeNull()
    expect(named.label).toBe('v1')
  })

  test('a stale restore is refused and a missing step is an error', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    await edit(ws, project(scene('a'), scene('b')))
    const first = (await history.list('a')).at(-1)!.id
    await expect(ws.restore('a', first, 'wrong-version')).rejects.toThrow('changed')
    await expect(ws.restore('a', 999)).rejects.toThrow('no step 999')
  })

  test('a broken history never blocks a save', async () => {
    const { history, ws } = setup()
    await ws.write('a', project(scene('a')), null, 'editor')
    history.close()
    await expect(edit(ws, project(scene('a'), scene('b')))).resolves.toBeDefined()
  })
})
