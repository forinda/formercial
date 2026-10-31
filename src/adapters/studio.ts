import { mkdirSync } from 'node:fs'
import { defineAdapter } from '@forinda/kickjs'
import { renderInspector } from '@/modules/projects/services/render-inspector'
import { Studio } from '@/modules/projects/services/studio.service'
import { projectsRoot } from './storage'

/**
 * Starts and stops what `Studio` runs in the background: the watch on the projects
 * folder for outside edits, and the render queue, which DevTools can browse under Jobs.
 */
export const studioAdapter = defineAdapter({
  name: 'Studio',
  build: () => {
    let studio: Studio | undefined
    let stopWatching = () => {}
    return {
      afterStart({ container }) {
        studio = container.resolve(Studio)
        if (process.env.S3_BUCKET) return
        mkdirSync(projectsRoot(), { recursive: true })
        stopWatching = studio.watch(projectsRoot())
      },
      // Also runs on every hot reload, which starts a new Studio with an empty queue.
      async shutdown() {
        stopWatching()
        await studio?.stop()
      },
      jobInspector: () => (studio ? renderInspector(studio.queue) : undefined),
    }
  },
})
