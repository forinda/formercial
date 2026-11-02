// A still from a project's latest render, for its card on the projects page.
// Made the first time it's asked for, then kept beside the project in thumbs/.
import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Inject, Service } from '@forinda/kickjs'
import type { Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { probeSeconds, run } from '@/core/media/media'
import { withWorkdir } from '@/core/storage/workdir'
import type { Workspace } from '@/core/storage/workspace'
import { WORKSPACE } from '../tokens'

/** The render a card shows: the newest 16:9 one, else the newest of any shape. */
export function latestRender(paths: string[]): string | null {
  const mp4s = paths
    .filter((p) => /^renders\/[^/]+\.mp4$/.test(p))
    .sort()
    .reverse()
  return mp4s.find((p) => basename(p).startsWith('16x9-')) ?? mp4s[0] ?? null
}

@Service()
export class ProjectThumbnailUseCase {
  // One at a time: a page of cards mustn't start twenty ffmpeg runs at once.
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** The thumbnail's path in the project, or null before anything is rendered. */
  async execute(slug: string): Promise<string | null> {
    const prefix = `${this.ws.key(slug, 'renders')}/`
    const { files } = await this.storage.list({ prefix })
    const render = latestRender(files.map((f) => f.key.slice(slug.length + 1)))
    if (!render) return null
    const thumb = `thumbs/${basename(render, '.mp4')}.jpg`
    if (await this.ws.stat(slug, thumb)) return thumb
    const job = this.queue.then(async () => {
      if (await this.ws.stat(slug, thumb)) return
      await withWorkdir(this.ws, slug, [render], async (dir) => {
        const video = join(dir, render)
        // A quarter of the way in: past the silent title, into the first idea.
        const at = (await probeSeconds(video)) * 0.25
        await mkdir(join(dir, 'thumbs'), { recursive: true })
        await run('ffmpeg', [
          '-protocol_whitelist',
          'file,pipe',
          '-v',
          'error',
          '-y',
          '-ss',
          at.toFixed(2),
          '-i',
          video,
          '-frames:v',
          '1',
          '-vf',
          'scale=480:-2',
          '-q:v',
          '4',
          join(dir, thumb),
        ])
        return { result: undefined, outputs: [thumb] }
      })
    })
    this.queue = job.catch(() => {})
    await job
    return thumb
  }
}
