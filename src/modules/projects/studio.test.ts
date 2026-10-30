import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { expect, test } from 'vitest'
import { starterProject } from '../../core/project'
import { createRegistry } from '../../core/render/registry'
import { Studio } from './studio.service'

test('an outside edit to project.json reaches listeners with its version', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cxc-watch-'))
  const studio = new Studio(diskStorage({ root }), createRegistry({}))
  await studio.ws.write('demo', starterProject('Demo'), null)
  const seen: unknown[] = []
  studio.listen('demo', { send: (data, event) => seen.push([event, data]) })
  const stop = studio.watch(root)
  writeFileSync(
    join(root, 'demo/project.json'),
    `${JSON.stringify(starterProject('Edited'), null, 2)}\n`,
  )
  await new Promise((r) => setTimeout(r, 600))
  stop()
  const { version } = await studio.ws.read('demo')
  expect(seen).toContainEqual(['project-changed', { version }])
})
