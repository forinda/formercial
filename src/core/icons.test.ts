import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { expect, test } from 'vitest'
import { searchIcons, storeIcon } from './icons'
import { parseProject, starterProject } from './project'
import { createWorkspace } from './workspace'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
const answering = (body: string, seen: string[] = []) =>
  (async (url: string) => {
    seen.push(url)
    return new Response(body)
  }) as unknown as typeof fetch

async function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'icons-'))
  return createWorkspace(diskStorage({ root }))
}

test('stores an icon once, under media/icons/', async () => {
  const ws = await workspace()
  const seen: string[] = []
  const path = await storeIcon(ws, 'demo', 'logos:typescript-icon', answering(SVG, seen))
  expect(path).toBe('media/icons/logos-typescript-icon.svg')
  expect(seen).toEqual(['https://api.iconify.design/logos/typescript-icon.svg'])
  expect(new TextDecoder().decode((await ws.getFile('demo', path))!)).toBe(SVG)
  await storeIcon(ws, 'demo', 'logos:typescript-icon', answering(SVG, seen))
  expect(seen).toHaveLength(1)
})

test.each(['../etc', 'logos:../x', 'logos', 'logos:a/b', 'Logos:x'])(
  'refuses the name %s',
  async (name) => {
    const ws = await workspace()
    await expect(storeIcon(ws, 'demo', name, answering(SVG))).rejects.toThrow(/isn't an icon name/)
  },
)

test.each(['<html></html>', '<svg><script>alert(1)</script></svg>'])('refuses %s', async (body) => {
  const ws = await workspace()
  await expect(storeIcon(ws, 'demo', 'logos:x', answering(body))).rejects.toThrow(/plain SVG/)
})

test('searches only the real logo sets, and skips an empty query', async () => {
  const seen: string[] = []
  const fetchFn = answering(JSON.stringify({ icons: ['logos:visual-studio-code'] }), seen)
  expect(await searchIcons(' vscode ', fetchFn)).toEqual(['logos:visual-studio-code'])
  expect(seen[0]).toContain('query=vscode')
  expect(seen[0]).toContain('prefixes=logos%2Cvscode-icons')
  expect(await searchIcons('  ', fetchFn)).toEqual([])
  expect(seen).toHaveLength(1)
})

test('an icon block only takes images under media/', () => {
  const withItem = (path: string) => {
    const p = structuredClone(starterProject('Demo', 'en-US-AvaNeural'))
    p.scenes[0] = {
      ...p.scenes[0],
      kind: 'blocks',
      blocks: [{ type: 'icon', size: 8, items: [{ path }] }],
    } as (typeof p.scenes)[number]
    return () => parseProject(p)
  }
  expect(withItem('media/icons/a.svg')).not.toThrow()
  expect(withItem('media/../project.json')).toThrow()
  expect(withItem('media/../a.svg')).toThrow()
  expect(withItem('https://x.test/a.svg')).toThrow()
})
