import { mkdirSync } from 'node:fs'
import { defineAdapter } from '@forinda/kickjs'
import { Studio } from '@/modules/projects/studio.service'
import { projectsRoot } from './storage'

/** Watches the projects folder for outside edits while files are on disk. */
export const projectsWatchAdapter = defineAdapter({
  name: 'ProjectsWatch',
  build: () => {
    let stop = () => {}
    return {
      afterStart({ container }) {
        if (process.env.S3_BUCKET) return
        mkdirSync(projectsRoot(), { recursive: true })
        stop = container.resolve(Studio).watch(projectsRoot())
      },
      shutdown() {
        stop()
      },
    }
  },
})
