// Everything the projects routes share: the workspace over the app's storage,
// trust, the render queue and the per-project event streams.
import { watch as fsWatch } from 'node:fs'
import { Inject, Service } from '@forinda/kickjs'
import type { Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import type { Format } from '../../core/project'
import type { Registry } from '../../core/render/registry'
import { renderProject } from '../../core/render/render-project'
import { createTrust } from '../../core/trust'
import { createWorkspace, type Workspace } from '../../core/workspace'
import { RenderQueue, type JobInfo } from './render-queue'
import { REGISTRY } from './tokens'

type Listener = { send(data: unknown, event?: string): void }

@Service()
export class Studio {
  readonly ws: Workspace
  readonly trust: ReturnType<typeof createTrust>
  readonly queue: RenderQueue
  private listeners = new Map<string, Set<Listener>>()

  constructor(
    @Inject(STORAGE) readonly storage: Storage,
    @Inject(REGISTRY) readonly registry: Registry,
  ) {
    this.ws = createWorkspace(storage)
    this.trust = createTrust(storage)
    this.queue = new RenderQueue((job) => this.emit(job.slug, 'job', job))
  }

  listen(slug: string, listener: Listener): () => void {
    const set = this.listeners.get(slug) ?? new Set()
    set.add(listener)
    this.listeners.set(slug, set)
    return () => set.delete(listener)
  }

  emit(slug: string, event: string, data: unknown) {
    for (const l of this.listeners.get(slug) ?? []) l.send(data, event)
  }

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
            ({ version }) => this.emit(slug, 'project-changed', { version }),
            () => {},
          )
        }, 200),
      )
    })
    return () => watcher.close()
  }

  /** The edge-tts (or configured) voice when it can run here, else none. */
  async voice() {
    const provider = this.registry.voices.get('edge-tts')
    return provider && (await provider.check()).ok ? provider : undefined
  }

  render(slug: string, format: Format, driverName: string, origin: string, fps?: number): JobInfo {
    const driver = this.registry.drivers.get(driverName)!
    return this.queue.enqueue({ slug, format, driver: driverName }, async (_job, progress) =>
      renderProject({
        ws: this.ws,
        slug,
        format,
        driver,
        fps,
        origin,
        voice: await this.voice(),
        onProgress: progress,
      }),
    )
  }
}
