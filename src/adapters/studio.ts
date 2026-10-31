import { mkdirSync } from 'node:fs'
import { defineAdapter } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectWatcher } from '@/modules/projects/services/project-watcher.service'
import { renderInspector } from '@/modules/projects/services/render-inspector'
import { Renders } from '@/modules/projects/services/renders.service'
import { WORKSPACE } from '@/modules/projects/tokens'
import { projectsRoot } from './storage'

/**
 * Starts and stops what runs in the background: the watch on the projects folder
 * for outside edits, and the render queue, which DevTools can browse under Jobs.
 */
export const studioAdapter = defineAdapter({
  name: 'Studio',
  build: () => {
    let renders: Renders | undefined
    let ws: Workspace | undefined
    let stopWatching = () => {}
    return {
      afterStart({ container }) {
        renders = container.resolve(Renders)
        ws = container.resolve(WORKSPACE)
        if (process.env.S3_BUCKET) return
        mkdirSync(projectsRoot(), { recursive: true })
        stopWatching = container.resolve(ProjectWatcher).watch(projectsRoot())
      },
      // Also runs on every hot reload, which starts new services with an empty queue.
      async shutdown() {
        stopWatching()
        await renders?.queue.stop()
        ws?.history?.close()
      },
      jobInspector: () => (renders ? renderInspector(renders.queue) : undefined),
    }
  },
})
