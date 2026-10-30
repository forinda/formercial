import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { memoryStorage } from '@forinda/kickjs-storage'
import { describe, expect, test } from 'vitest'
import { withWorkdir } from './workdir'
import { createWorkspace } from './workspace'

describe('withWorkdir', () => {
  test('withWorkdir copies inputs, uploads outputs, removes the folder', async () => {
    const ws = createWorkspace(memoryStorage())
    await ws.putFile('demo', 'voice/a.mp3', 'clip')
    let seen = ''
    const result = await withWorkdir(ws, 'demo', ['voice/a.mp3'], async (dir) => {
      seen = dir
      expect(readFileSync(join(dir, 'voice/a.mp3'), 'utf8')).toBe('clip')
      writeFileSync(join(dir, 'out.txt'), 'made')
      return { result: 42, outputs: ['out.txt'] }
    })
    expect(result).toBe(42)
    expect(new TextDecoder().decode((await ws.getFile('demo', 'out.txt'))!)).toBe('made')
    expect(existsSync(seen)).toBe(false)
  })

  test('withWorkdir removes the folder when fn throws', async () => {
    const ws = createWorkspace(memoryStorage())
    let seen = ''
    await expect(
      withWorkdir(ws, 'demo', [], async (dir) => {
        seen = dir
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(seen).not.toBe('')
    expect(existsSync(seen)).toBe(false)
  })

  test('refuses paths that escape the work folder', async () => {
    const ws = createWorkspace(memoryStorage())
    await expect(
      withWorkdir(ws, 'demo', ['../x'], async () => ({ result: 1, outputs: [] })),
    ).rejects.toThrow(/outside/)
    await expect(
      withWorkdir(ws, 'demo', [], async () => ({ result: 1, outputs: ['../../etc/x'] })),
    ).rejects.toThrow(/outside/)
  })
})
