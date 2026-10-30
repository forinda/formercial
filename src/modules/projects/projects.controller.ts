// JSON routes the editor calls. Projects are addressed by slug; files inside a
// project by `?path=`, checked against the project folder on every call.
import { join } from 'node:path'
import { Controller, Delete, Get, Post, Put, type RequestContext } from '@forinda/kickjs'
import { checkRange } from '@forinda/kickjs-storage'
import { storeGoogleFont } from '../../core/fonts'
import { probeSeconds } from '../../core/media'
import {
  FORMATS,
  ProjectError,
  SLUG,
  slugFrom,
  starterProject,
  type Format,
  type Project,
} from '../../core/project'
import { clipLengths, recordingPath, voiceProject } from '../../core/voice/voice-project'
import { withWorkdir } from '../../core/workdir'
import { PathError, StaleWriteError } from '../../core/workspace'
import { Studio } from './studio.service'

const MAX_UPLOAD = 50 * 1024 * 1024
const AUDIO = /^audio\/(webm|ogg)\b/

const TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  srt: 'application/x-subrip',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
}
const typeOf = (path: string) =>
  TYPES[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/** Read a request body as bytes, refusing more than `limit`. */
async function readBody(ctx: RequestContext, limit: number): Promise<Uint8Array> {
  const declared = Number(ctx.headers['content-length'] ?? 0)
  if (declared > limit) throw new HttpError(413, `larger than ${limit / 1024 / 1024} MB`)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of ctx.req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > limit) throw new HttpError(413, `larger than ${limit / 1024 / 1024} MB`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

@Controller()
export class ProjectsController {
  constructor(private readonly studio: Studio) {}

  private async handle(ctx: RequestContext, fn: () => Promise<unknown>) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof HttpError)
        return ctx.json({ error: err.message, ...err.extra }, err.status)
      if (err instanceof PathError) return ctx.json({ error: err.message }, 400)
      if (err instanceof ProjectError)
        return ctx.json({ error: err.message, issues: err.issues }, 400)
      if (err instanceof StaleWriteError)
        return ctx.json({ error: err.message, current: err.current }, 409)
      throw err
    }
  }

  private filePath(ctx: RequestContext): string {
    const path = String(ctx.query.path ?? '')
    if (!path) throw new HttpError(400, 'path is required')
    return path
  }

  @Get('/')
  list(ctx: RequestContext) {
    return this.handle(ctx, async () => ctx.json(await this.studio.ws.list()))
  }

  @Post('/')
  create(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const name = String(ctx.body?.name ?? '').trim()
      if (!name) throw new HttpError(400, 'name is required')
      const taken = new Set((await this.studio.ws.list()).map((p) => p.slug))
      const base = slugFrom(name)
      let slug = base
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
      if (!SLUG.test(slug)) throw new HttpError(400, `can't make a project name from "${name}"`)
      await this.studio.ws.write(slug, starterProject(name), null)
      return ctx.json({ slug }, 201)
    })
  }

  @Get('/:slug')
  read(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project, version } = await this.studio.ws.read(slug)
      const clips = await clipLengths(this.studio.ws, slug, project)
      const trusted = await this.studio.trust.isTrusted(slug, project)
      return ctx.json({
        project,
        version,
        clips: Object.fromEntries(Object.entries(clips).filter(([, c]) => c)),
        trusted,
      })
    })
  }

  @Put('/:slug')
  write(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project, baseVersion } = ctx.body ?? {}
      const { version } = await this.studio.ws.write(
        slug,
        project as Project,
        String(baseVersion ?? ''),
      )
      this.studio.emit(slug, 'project-changed', { version })
      return ctx.json({ version })
    })
  }

  @Post('/:slug/trust')
  setTrust(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project } = await this.studio.ws.read(slug)
      await this.studio.trust.set(slug, project, ctx.body?.trusted === true)
      return ctx.noContent()
    })
  }

  /** Download a Google Fonts family into the project's media/fonts/. */
  @Post('/:slug/fonts')
  addFont(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const family = String(ctx.body?.family ?? '').trim()
      if (!/^[A-Za-z0-9 ]{1,60}$/.test(family))
        throw new HttpError(400, 'a font family is letters, digits and spaces')
      const files = await storeGoogleFont(this.studio.ws, ctx.params.slug, family)
      this.studio.emit(ctx.params.slug, 'project-changed', {
        version: (await this.studio.ws.read(ctx.params.slug)).version,
      })
      return ctx.json({ files })
    })
  }

  @Post('/:slug/voice')
  voiceAll(ctx: RequestContext) {
    return this.handle(ctx, () => this.voice(ctx))
  }

  @Post('/:slug/voice/:sceneId')
  voiceOne(ctx: RequestContext) {
    return this.handle(ctx, () => this.voice(ctx, ctx.params.sceneId))
  }

  private async voice(ctx: RequestContext, only?: string) {
    const provider = this.studio.registry.voices.get('edge-tts')!
    const check = await provider.check()
    if (!check.ok)
      throw new HttpError(400, `${provider.name} can't run here`, { missing: check.missing })
    const clips = await voiceProject(this.studio.ws, ctx.params.slug, provider, { only })
    return ctx.json({ clips: Object.fromEntries(Object.entries(clips).filter(([, c]) => c)) })
  }

  @Put('/:slug/recordings/:sceneId')
  record(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug, sceneId } = ctx.params
      const path = recordingPath(sceneId)
      this.studio.ws.key(slug, path)
      if (!AUDIO.test(String(ctx.headers['content-type'] ?? ''))) {
        throw new HttpError(400, 'send audio/webm or audio/ogg')
      }
      const bytes = await readBody(ctx, MAX_UPLOAD)
      if (bytes.length === 0) throw new HttpError(400, 'the recording is empty')
      // Probe before storing, so a file ffprobe can't read never replaces a good one.
      const seconds = await withWorkdir(this.studio.ws, slug, [], async (dir) => {
        const { writeFile, mkdir } = await import('node:fs/promises')
        await mkdir(join(dir, 'voice'), { recursive: true })
        await writeFile(join(dir, path), bytes)
        const s = await probeSeconds(join(dir, path)).catch(() => {
          throw new HttpError(400, "that isn't audio ffprobe can read")
        })
        return { result: s, outputs: [path] }
      })
      return ctx.json({ seconds })
    })
  }

  @Delete('/:slug/recordings/:sceneId')
  dropRecording(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      await this.studio.ws.deleteFile(ctx.params.slug, recordingPath(ctx.params.sceneId))
      return ctx.noContent()
    })
  }

  @Get('/:slug/file')
  file(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const path = this.filePath(ctx)
      const key = this.studio.ws.key(slug, path)
      const info = await this.studio.storage.stat(key)
      if (!info) return ctx.notFound()
      const headers: Record<string, string> = {
        'content-type': typeOf(path),
        'accept-ranges': 'bytes',
        // Uploaded files (an SVG logo, say) can hold script: served sandboxed,
        // so opening one directly can't act as the app. <img>, <audio> and
        // fonts are unaffected.
        'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        'x-content-type-options': 'nosniff',
      }
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(ctx.headers.range ?? ''))
      if (m && (m[1] || m[2])) {
        const start = m[1] ? Number(m[1]) : Math.max(0, info.size - Number(m[2]))
        const end = m[1] && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1
        if (start > end || start >= info.size) {
          return ctx.sendResponse(
            new Response(null, {
              status: 416,
              headers: { 'content-range': `bytes */${info.size}` },
            }),
          )
        }
        const stream = await this.studio.storage.getStream(
          key,
          checkRange({ start, end }) ?? undefined,
        )
        headers['content-range'] = `bytes ${start}-${end}/${info.size}`
        headers['content-length'] = String(end - start + 1)
        return ctx.sendResponse(new Response(stream, { status: 206, headers }))
      }
      headers['content-length'] = String(info.size)
      return ctx.sendResponse(
        new Response(await this.studio.storage.getStream(key), { status: 200, headers }),
      )
    })
  }

  @Put('/:slug/file')
  upload(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const path = this.filePath(ctx)
      if (!path.startsWith('media/')) throw new HttpError(400, 'uploads go under media/')
      this.studio.ws.key(ctx.params.slug, path)
      await this.studio.ws.putFile(ctx.params.slug, path, await readBody(ctx, MAX_UPLOAD))
      return ctx.noContent()
    })
  }

  @Get('/:slug/renders')
  renders(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      // key() checks the slug; a listing prefix ends in '/', which a key can't.
      const prefix = `${this.studio.ws.key(slug, 'renders')}/`
      const page = await this.studio.storage.list({ prefix })
      return ctx.json({
        jobs: this.studio.queue.jobs.filter((j) => j.slug === slug),
        files: page.files.map((f) => f.key.slice(slug.length + 1)),
      })
    })
  }

  @Post('/:slug/renders')
  render(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project } = await this.studio.ws.read(slug)
      const name = String(ctx.body?.driver ?? 'chromium-ffmpeg')
      const driver = this.studio.registry.drivers.get(name)
      if (!driver) throw new HttpError(400, `no render driver "${name}"`)
      const check = await driver.check()
      if (!check.ok) throw new HttpError(400, `${name} can't run here`, { missing: check.missing })
      if (!(await this.studio.trust.isTrusted(slug, project))) {
        throw new HttpError(403, 'this project has custom scenes: trust it before rendering')
      }
      const asked = ctx.body?.format === 'all' ? project.formats : [ctx.body?.format]
      if (!asked.every((f: unknown): f is Format => typeof f === 'string' && f in FORMATS)) {
        throw new HttpError(400, 'format is 16:9, 9:16, 1:1 or all')
      }
      // Chromium opens the render page on this server's own loopback port;
      // never from the Host header, which the request controls.
      const port = (ctx.req as unknown as { socket: { localPort?: number } }).socket.localPort
      const origin = `http://127.0.0.1:${port}`
      const fps = ctx.body?.fps === undefined ? undefined : Number(ctx.body.fps)
      if (fps !== undefined && !(Number.isInteger(fps) && fps >= 1 && fps <= 60)) {
        throw new HttpError(400, 'fps is a whole number from 1 to 60')
      }
      const jobs = asked.map((format: Format) =>
        this.studio.render(slug, format, name, origin, fps),
      )
      return ctx.json({ jobs }, 202)
    })
  }

  @Get('/:slug/events')
  events(ctx: RequestContext) {
    const { slug } = ctx.params
    if (!SLUG.test(slug)) return ctx.json({ error: 'invalid project name' }, 400)
    const sse = ctx.sse()
    const stop = this.studio.listen(slug, sse)
    sse.onClose(stop)
  }
}
