import { memoryStorage } from '@forinda/kickjs-storage'
import { describe, expect, test } from 'vitest'
import { starterProject } from './project'
import { PathError, StaleWriteError, createWorkspace } from './workspace'

const ws = () => createWorkspace(memoryStorage())

describe('workspace', () => {
  test('write then read round-trips and returns the same version', async () => {
    const w = ws()
    const { version } = await w.write('demo', starterProject('Demo'), null)
    const read = await w.read('demo')
    expect(read.version).toBe(version)
    expect(read.project.name).toBe('Demo')
  })

  test('write with a stale baseVersion throws StaleWriteError', async () => {
    const w = ws()
    const v1 = (await w.write('demo', starterProject('One'), null)).version
    const v2 = (await w.write('demo', starterProject('Two'), v1)).version
    const err = await w.write('demo', starterProject('Three'), v1).catch((e) => e)
    expect(err).toBeInstanceOf(StaleWriteError)
    expect(err.current).toBe(v2)
  })

  test('write with null baseVersion refuses an existing project', async () => {
    const w = ws()
    await w.write('demo', starterProject('One'), null)
    await expect(w.write('demo', starterProject('Two'), null)).rejects.toBeInstanceOf(
      StaleWriteError,
    )
  })

  test('list returns slugs with names, sorted', async () => {
    const w = ws()
    await w.write('zeta', starterProject('Zeta'), null)
    await w.write('alpha', starterProject('Alpha'), null)
    await w.putFile('alpha', 'media/logo.svg', '<svg/>')
    expect(await w.list()).toEqual([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'zeta', name: 'Zeta' },
    ])
  })

  test('rejects traversal slugs and file paths', async () => {
    const w = ws()
    await expect(w.read('../x')).rejects.toBeInstanceOf(PathError)
    expect(() => w.key('ok', '../../etc')).toThrow(PathError)
    expect(() => w.key('ok', 'a//b')).toThrow(PathError)
    expect(() => w.key('Bad Slug', 'a')).toThrow(PathError)
    expect(w.key('ok', 'voice/s1.tts.mp3')).toBe('ok/voice/s1.tts.mp3')
  })

  test('files round-trip under the project', async () => {
    const w = ws()
    await w.putFile('demo', 'media/a.txt', 'hi')
    expect(new TextDecoder().decode((await w.getFile('demo', 'media/a.txt'))!)).toBe('hi')
    expect((await w.stat('demo', 'media/a.txt'))?.size).toBe(2)
    await w.deleteFile('demo', 'media/a.txt')
    expect(await w.getFile('demo', 'media/a.txt')).toBeNull()
  })
})
