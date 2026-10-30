import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { Command } from 'commander'
import { describe, expect, test } from 'vitest'
import type { RenderDriver } from '@/core/render/driver'
import { parseProject, starterProject } from '@/core/project'
import { createWorkspace } from '@/core/workspace'
import { formercialCliPlugin, resolveProject } from './plugin'

const fakeDriver: RenderDriver = {
  name: 'farm',
  check: async () => ({ ok: false, missing: ['a render farm'] }),
  render: async () => ({ mp4: 'a.mp4', srt: 'a.srt' }),
}

async function run(args: string[], projectRoot: string) {
  const out: string[] = []
  const program = new Command().exitOverride()
  const plugin = formercialCliPlugin({ drivers: [fakeDriver] })
  await plugin.register!(program, {
    cwd: projectRoot,
    projectRoot,
    config: null,
    log: (m) => out.push(m),
  })
  await program.parseAsync(['node', 'kick', ...args])
  return out.join('\n')
}

describe('kick formercial', () => {
  test('new creates a valid project', async () => {
    const root = mkdtempSync(join(tmpdir(), 'formercial-cli-'))
    const out = await run(['formercial', 'new', 'My Product'], root)
    expect(out).toContain('projects/my-product')
    const ws = createWorkspace(diskStorage({ root: join(root, 'projects') }))
    expect((await ws.read('my-product')).project.name).toBe('My Product')
  })

  test('drivers prints each driver with ready or missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'formercial-cli-'))
    const out = await run(['formercial', 'drivers'], root)
    expect(out).toMatch(/chromium-ffmpeg/)
    expect(out).toMatch(/farm\s+missing: a render farm/)
  })

  test('resolves a folder path to root and slug', () => {
    const root = mkdtempSync(join(tmpdir(), 'formercial-cli-'))
    mkdirSync(join(root, 'elsewhere', 'promo'), { recursive: true })
    expect(resolveProject(join(root, 'elsewhere', 'promo'), root)).toEqual({
      root: join(root, 'elsewhere'),
      slug: 'promo',
    })
    expect(resolveProject('promo', root)).toEqual({ root: join(root, 'projects'), slug: 'promo' })
  })

  test('registers exactly the formercial command group', async () => {
    const root = mkdtempSync(join(tmpdir(), 'formercial-cli-'))
    const program = new Command()
    await formercialCliPlugin({}).register!(program, {
      cwd: root,
      projectRoot: root,
      config: null,
      log: () => {},
    })
    expect(program.commands.map((c) => c.name())).toEqual(['formercial'])
    expect(program.commands[0].commands.map((c) => c.name())).toEqual([
      'new',
      'voice',
      'render',
      'drivers',
      'preview',
    ])
  })

  test('render refuses a project whose custom scenes are not trusted', async () => {
    const root = mkdtempSync(join(tmpdir(), 'formercial-cli-'))
    const ws = createWorkspace(diskStorage({ root: join(root, 'projects') }))
    const project = parseProject({
      ...starterProject('C'),
      scenes: [{ id: 'c', kind: 'custom', caption: '', script: 'export function draw() {}' }],
    })
    await ws.write('c', project, null)
    const ready: RenderDriver = {
      ...fakeDriver,
      name: 'ok',
      check: async () => ({ ok: true, missing: [] }),
    }
    const program = new Command().exitOverride()
    await formercialCliPlugin({ drivers: [ready] }).register!(program, {
      cwd: root,
      projectRoot: root,
      config: null,
      log: () => {},
    })
    await expect(
      program.parseAsync(['node', 'kick', 'formercial', 'render', 'c', '--driver', 'ok']),
    ).rejects.toThrow(/trust/)
  })
})
