import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseProject, starterProject } from '@/core/project/project'
import { createTrust, customHash } from './trust'

const custom = parseProject({
  ...starterProject('T'),
  scenes: [{ id: 'c', kind: 'custom', caption: '', script: 'export function draw() {}' }],
})

describe('trust', () => {
  test('is kept in a per-user file, per workspace', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'formercial-trust-')), 'trust.json')
    const a = createTrust({ file, workspace: '/work/a' })
    const b = createTrust({ file, workspace: '/work/b' })
    expect(await a.isTrusted('demo', custom)).toBe(false)
    await a.set('demo', custom, true)
    expect(await a.isTrusted('demo', custom)).toBe(true)
    expect(await b.isTrusted('demo', custom)).toBe(false)
  })

  test('a trust file shipped inside a shared projects folder is ignored', async () => {
    const shared = mkdtempSync(join(tmpdir(), 'formercial-shared-'))
    writeFileSync(
      join(shared, 'formercial-trust.json'),
      JSON.stringify({ demo: customHash(custom) }),
    )
    const file = join(mkdtempSync(join(tmpdir(), 'formercial-trust-')), 'trust.json')
    expect(await createTrust({ file, workspace: shared }).isTrusted('demo', custom)).toBe(false)
  })

  test('changed custom code needs trusting again', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'formercial-trust-')), 'trust.json')
    const t = createTrust({ file, workspace: '/w' })
    await t.set('demo', custom, true)
    const changed = {
      ...custom,
      scenes: [{ ...custom.scenes[0], script: 'export function draw() { fetch("//x") }' }],
    }
    expect(await t.isTrusted('demo', changed as typeof custom)).toBe(false)
  })
})
