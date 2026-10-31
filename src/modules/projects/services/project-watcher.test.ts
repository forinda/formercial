import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { expect, test } from 'vitest'
import { starterProject } from '@/core/project/project'
import { createWorkspace } from '@/core/storage/workspace'
import { ProjectEvents } from './project-events.service'
import { ProjectWatcher } from './project-watcher.service'

test('an outside edit to project.json reaches listeners with its version', async () => {
  const root = mkdtempSync(join(tmpdir(), 'formercial-watch-'))
  const ws = createWorkspace(diskStorage({ root }))
  const events = new ProjectEvents()
  await ws.write('demo', starterProject('Demo'), null)
  const seen: unknown[] = []
  events.listen('demo', { send: (data, event) => seen.push([event, data]) })
  const stop = new ProjectWatcher(ws, events).watch(root)
  writeFileSync(
    join(root, 'demo/project.json'),
    `${JSON.stringify(starterProject('Edited'), null, 2)}\n`,
  )
  await new Promise((r) => setTimeout(r, 600))
  stop()
  const { version } = await ws.read('demo')
  expect(seen).toContainEqual(['project-changed', { version }])
})
