// JSON routes the editor calls. Projects are addressed by slug; files inside a
// project by `?path=`, checked against the project folder on every call.
import { join, resolve } from 'node:path'
import {
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Put,
  getEnv,
  type RequestContext,
} from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { checkRange } from '@forinda/kickjs-storage'
import { storeFontFromUrl } from '@/core/font-links'
import { searchIcons, storeIcon } from '@/core/icons'
import { storeGoogleFont } from '@/core/fonts'
import { probeSeconds } from '@/core/media'
import { FormercialSettings, checkFps } from '@/core/settings'
import {
  FORMATS,
  ProjectError,
  SLUG,
  slugFrom,
  starterProject,
  type Format,
  type Project,
} from '@/core/project'
import { clipLengths, recordingPath, voiceProject } from '@/core/voice/voice-project'
import { withWorkdir } from '@/core/workdir'
import { PathError, StaleWriteError } from '@/core/workspace'
import { projectsRoot } from '@/adapters/storage'
import { fromPreset, storePresetFonts } from '@/presets'
import { renderOrigin } from './render-origin'
import { Studio } from './studio.service'

const MAX_UPLOAD = 50 * 1024 * 1024
const HISTORY_PAGE = 200
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

  @McpTool({
    name: 'list_projects',
    description: 'Every commercial in the workspace, as { slug, name }.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  list(ctx: RequestContext) {
    return this.handle(ctx, async () => ctx.json(await this.studio.ws.list()))
  }

  @McpTool({
    name: 'create_project',
    description:
      'Create a commercial, blank or from a preset (see list_presets). Returns its slug.',
    inputSchema: z.object({
      name: z.string().describe('Display name; the slug comes from it'),
      preset: z.string().optional().describe('A preset id from list_presets'),
    }),
  })
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
      const preset = ctx.body?.preset ? String(ctx.body.preset) : undefined
      let project
      try {
        const { voice } = FormercialSettings.get()
        project = preset ? fromPreset(preset, name, voice) : starterProject(name, voice)
      } catch (err) {
        throw new HttpError(400, (err as Error).message)
      }
      await this.studio.ws.write(slug, project, null)
      if (preset) await storePresetFonts(this.studio.ws, slug, preset)
      return ctx.json({ slug }, 201)
    })
  }

  @McpTool({
    name: 'get_project',
    description:
      'Read a commercial: its project.json as `project`, the `version` to send back with update_project, its voice `clips`, and whether its custom scenes are `trusted`.',
    annotations: { readOnlyHint: true },
  })
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
        history: await this.studio.historyState(slug),
      })
    })
  }

  @McpTool({
    name: 'update_project',
    description:
      'Replace a project.json. Send the version from get_project; a stale one is refused with the current version. Custom scene code needs the user to trust it in the editor before it runs or renders: `trusted: false` in the answer means ask them to.',
    inputSchema: z.object({
      project: z.record(z.string(), z.unknown()).describe('The whole project; see project_schema'),
      baseVersion: z.string().describe('The version this edit started from'),
    }),
  })
  @Put('/:slug')
  write(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project, baseVersion } = ctx.body ?? {}
      // Your own edits in the editor keep a trusted project trusted. Anything
      // else, like an agent's tool call or a pulled change, needs trusting again.
      const before = await this.studio.ws.read(slug).catch(() => null)
      const fromEditor = ctx.headers['x-formercial-editor'] === '1' && !ctx.headers['x-mcp-tool']
      const keepTrust =
        fromEditor && before ? await this.studio.trust.isTrusted(slug, before.project) : false
      const { version } = await this.studio.ws.write(
        slug,
        project as Project,
        String(baseVersion ?? ''),
        ctx.headers['x-mcp-tool'] ? 'agent' : fromEditor ? 'editor' : 'app',
      )
      const saved = (await this.studio.ws.read(slug)).project
      if (keepTrust) await this.studio.trust.set(slug, saved, true)
      const trusted = await this.studio.trust.isTrusted(slug, saved)
      this.studio.emit(slug, 'project-changed', { version })
      return ctx.json({ version, trusted, history: await this.studio.historyState(slug) })
    })
  }

  private history() {
    const { history } = this.studio.ws
    if (!history) throw new HttpError(503, "history is off: SQLite couldn't start")
    return history
  }

  /** After the file changed underneath the editor: tell it, and say what it can do next. */
  private async restored(ctx: RequestContext, slug: string, version: string) {
    const { project } = await this.studio.ws.read(slug)
    this.studio.emit(slug, 'project-changed', { version })
    return ctx.json({
      version,
      trusted: await this.studio.trust.isTrusted(slug, project),
      history: await this.studio.historyState(slug),
    })
  }

  @McpTool({
    name: 'list_history',
    description:
      'The steps a project has been through, newest first, and which one is current. Each has an id, what changed, who changed it, when, and its name if it has one. When `older` is true there are more: ask again with `before` set to the last id.',
    inputSchema: z.object({
      before: z.number().int().optional().describe('Only steps older than this id'),
    }),
    annotations: { readOnlyHint: true },
  })
  @Get('/:slug/history')
  listHistory(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const history = this.history()
      // Edits made while the app wasn't running show up here too.
      await this.studio.ws.remember(
        slug,
        await this.studio.ws.getFile(slug, 'project.json'),
        'outside',
      )
      const before = ctx.query.before ?? ctx.body?.before
      // One more than a page, to know whether there are older ones.
      const found = await history.list(slug, {
        limit: HISTORY_PAGE + 1,
        before: before === undefined ? undefined : Number(before),
      })
      return ctx.json({
        current: (await history.head(slug))?.id ?? null,
        revisions: found.slice(0, HISTORY_PAGE),
        older: found.length > HISTORY_PAGE,
      })
    })
  }

  @McpTool({
    name: 'restore_revision',
    description:
      'Put a project back to a step from list_history, exactly as it was. Nothing is lost: the step it leaves stays in the history. Custom scene code that differs from what the user trusted needs trusting again.',
    inputSchema: z.object({
      id: z.number().int().describe('A step id from list_history'),
      baseVersion: z.string().optional().describe('Refuse if the project has changed since this'),
    }),
  })
  @Post('/:slug/history/:id/restore')
  restoreRevision(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      this.history()
      const baseVersion = ctx.body?.baseVersion
      const { version } = await this.studio.ws.restore(
        slug,
        Number(ctx.params.id),
        baseVersion === undefined ? undefined : String(baseVersion),
      )
      return this.restored(ctx, slug, version)
    })
  }

  @Put('/:slug/history/:id/label')
  labelRevision(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const label = String(ctx.body?.label ?? '')
        .trim()
        .slice(0, 80)
      await this.history().setLabel(ctx.params.slug, Number(ctx.params.id), label || null)
      return ctx.noContent()
    })
  }

  @Post('/:slug/undo')
  undo(ctx: RequestContext) {
    return this.handle(ctx, () => this.step(ctx, 'undo'))
  }

  @Post('/:slug/redo')
  redo(ctx: RequestContext) {
    return this.handle(ctx, () => this.step(ctx, 'redo'))
  }

  private async step(ctx: RequestContext, direction: 'undo' | 'redo') {
    const { slug } = ctx.params
    this.history()
    const done = await this.studio.ws[direction](slug)
    if (!done) throw new HttpError(409, `nothing to ${direction}`)
    return this.restored(ctx, slug, done.version)
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

  @McpTool({
    name: 'search_icons',
    description:
      'Find product and language icons by name, like vscode or typescript. Returns names to pass to add_icon. Searches through Iconify.',
    inputSchema: z.object({ query: z.string() }),
    annotations: { readOnlyHint: true },
  })
  @Get('/:slug/icons')
  findIcons(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const icons = await searchIcons(String(ctx.query.query ?? '')).catch((err: Error) => {
        throw new HttpError(502, err.message)
      })
      return ctx.json({ icons })
    })
  }

  /** Download an Iconify icon into the project's media/icons/. */
  @McpTool({
    name: 'add_icon',
    description:
      'Download an icon by name, like logos:typescript-icon, into the project. Returns the `path` to use in an icon block.',
    inputSchema: z.object({ name: z.string() }),
  })
  @Post('/:slug/icons')
  addIcon(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const path = await storeIcon(
        this.studio.ws,
        ctx.params.slug,
        String(ctx.body?.name ?? ''),
      ).catch((err: Error) => {
        throw new HttpError(400, err.message)
      })
      return ctx.json({ path })
    })
  }

  /** Download a Google Fonts family, or what a link holds, into the project's media/fonts/. */
  @Post('/:slug/fonts')
  addFont(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const url = String(ctx.body?.url ?? '').trim()
      const family = String(ctx.body?.family ?? '').trim()
      if ((family || !url) && !/^[A-Za-z0-9 ]{1,60}$/.test(family))
        throw new HttpError(400, 'a font family is letters, digits and spaces')
      const weight = ctx.body?.weight === undefined ? undefined : Number(ctx.body.weight)
      if (weight !== undefined && !(Number.isInteger(weight) && weight >= 1 && weight <= 1000))
        throw new HttpError(400, 'a font weight is a whole number from 1 to 1000')
      const files = url
        ? await storeFontFromUrl(this.studio.ws, ctx.params.slug, {
            url,
            family: family || undefined,
            weight,
          }).catch((err: Error) => {
            throw new HttpError(400, err.message)
          })
        : await storeGoogleFont(this.studio.ws, ctx.params.slug, family)
      this.studio.emit(ctx.params.slug, 'project-changed', {
        version: (await this.studio.ws.read(ctx.params.slug)).version,
      })
      return ctx.json({ files })
    })
  }

  @McpTool({
    name: 'voice_project',
    description:
      "Generate any missing or changed voice lines with edge-tts. Lines are sent to Microsoft's speech service.",
    inputSchema: z.object({}),
  })
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
    const { slug } = ctx.params
    const log = Logger.for('Voice')
    const clips = await voiceProject(this.studio.ws, slug, provider, {
      only,
      onProgress: (done, total) => {
        if (total && done === 0)
          log.info(`${slug} generating ${total} line${total === 1 ? '' : 's'}`)
        else if (total && done === total) log.info(`${slug} voice done`)
      },
    }).catch((err: Error) => {
      log.error(`${slug} voice failed: ${err.message}`)
      throw err
    })
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

  @McpTool({
    name: 'get_renders',
    description:
      'Render jobs with their state and progress, the finished files, and `folder`: where the files are on disk.',
    annotations: { readOnlyHint: true },
  })
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
        folder: resolve(projectsRoot(), slug, 'renders'),
      })
    })
  }

  @McpTool({
    name: 'render_project',
    description:
      'Queue a render, returning at once with job ids. Poll get_renders for progress. Takes about 2-3 times the length of the spot.',
    inputSchema: z.object({
      format: z
        .enum(['16:9', '9:16', '1:1', 'all'])
        .describe("A format, or 'all' for the project's formats"),
      driver: z
        .string()
        .optional()
        .describe('A driver from list_drivers; default FORMERCIAL_DRIVER'),
      fps: z.number().int().min(1).max(60).optional().describe('Frames per second'),
    }),
  })
  @Post('/:slug/renders')
  render(ctx: RequestContext) {
    return this.handle(ctx, async () => {
      const { slug } = ctx.params
      const { project } = await this.studio.ws.read(slug)
      const name = String(ctx.body?.driver ?? FormercialSettings.get().driver)
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
      const origin = renderOrigin(ctx.req as never, getEnv('PORT'))
      let fps: number | undefined
      try {
        fps = ctx.body?.fps === undefined ? undefined : checkFps(ctx.body.fps)
      } catch (err) {
        throw new HttpError(400, (err as Error).message)
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
