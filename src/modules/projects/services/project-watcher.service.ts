import { watch as fsWatch } from 'node:fs'
import { Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { WORKSPACE } from '../tokens'
import { ProjectEvents } from './project-events.service'

@Service()
export class ProjectWatcher {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    private readonly events: ProjectEvents,
  ) {}

  /**
   * Tell open editors when a project.json changes on disk, from a script or
   * another editor. Disk storage only; the app's own saves come through too,
   * and the editor ignores a version it already has.
   */
  watch(root: string): () => void {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const watcher = fsWatch(root, { recursive: true }, (_event, file) => {
      const m = file && /^([a-z0-9][a-z0-9-]*)[\\/]project\.json$/.exec(String(file))
      if (!m) return
      const slug = m[1]
      clearTimeout(timers.get(slug))
      timers.set(
        slug,
        setTimeout(() => {
          this.ws.read(slug).then(
            async ({ version }) => {
              // An edit from outside the app becomes a step, so it can be undone too.
              // The file may be gone already: editors still hear about the change.
              const bytes = await this.ws.getFile(slug, 'project.json').catch(() => null)
              await this.ws.remember(slug, bytes, 'outside')
              this.events.emit(slug, 'project-changed', { version })
            },
            () => {},
          )
        }, 200),
      )
    })
    return () => {
      watcher.close()
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }
}
