// The render queue, and starting a render on it.
import { Inject, Logger, Service } from '@forinda/kickjs'
import type { Format } from '@/core/project/project'
import type { Registry } from '@/core/render/registry'
import { renderProject } from '@/core/render/render-project'
import type { Workspace } from '@/core/storage/workspace'
import { REGISTRY, WORKSPACE } from '../tokens'
import { ProjectEvents } from './project-events.service'
import { RenderQueue, jobActivity, type JobInfo } from './render-queue'

@Service()
export class Renders {
  readonly queue: RenderQueue

  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(REGISTRY) private readonly registry: Registry,
    events: ProjectEvents,
  ) {
    const activity = jobActivity(Logger.for('Render'))
    this.queue = new RenderQueue((job) => {
      activity(job)
      events.emit(job.slug, 'job', job)
    })
  }

  /** The edge-tts (or configured) voice when it can run here, else none. */
  private async voice() {
    const provider = this.registry.voices.get('edge-tts')
    return provider && (await provider.check()).ok ? provider : undefined
  }

  start(slug: string, format: Format, driverName: string, origin: string, fps?: number): JobInfo {
    const driver = this.registry.drivers.get(driverName)!
    return this.queue.enqueue(
      { slug, format, driver: driverName },
      async (_job, progress, signal) =>
        renderProject({
          ws: this.ws,
          slug,
          format,
          driver,
          fps,
          origin,
          voice: await this.voice(),
          onProgress: progress,
          signal,
        }),
    )
  }
}
