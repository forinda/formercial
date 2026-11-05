import { Controller, Get, type RequestContext, Inject } from '@forinda/kickjs'
import { inertia } from '@forinda/kickjs-inertia'
import { FORMATS, type Format } from '@/core/project/project'
import type { Trust } from '@/core/storage/trust'
import { summaryOf, type Workspace } from '@/core/storage/workspace'
import { clipLengths } from '@/core/voice/voice-project'
import { CODE } from '@/fun/rooms'
import { FunRooms } from '@/modules/fun/fun-rooms.service'
import { MemeStore } from '@/modules/memes/meme-store.service'
import { ToolJobs } from '@/modules/tools/tool-jobs.service'
import { ProjectHistory } from '@/modules/projects/services/project-history.service'
import { TRUST, WORKSPACE } from '@/modules/projects/tokens'
import { PRESETS } from '@/presets'

const notFound = (message: string) => inertia('Error', { status: 404, message }, { status: 404 })

@Controller()
export class PagesController {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
    private readonly history: ProjectHistory,
    private readonly memes: MemeStore,
    private readonly fun: FunRooms,
    private readonly tools: ToolJobs,
  ) {}

  // Each page loads the project from the workspace; a missing or invalid one
  // is a 404 page rather than an error.
  private async load(slug: string) {
    try {
      const { project, version } = await this.ws.read(slug)
      const clips = Object.fromEntries(
        Object.entries(await clipLengths(this.ws, slug, project)).filter(([, c]) => c),
      )
      return {
        slug,
        project,
        version,
        clips,
        trusted: await this.trust.isTrusted(slug, project),
        history: await this.history.state(slug),
      }
    } catch {
      return null
    }
  }

  @Get('/')
  async home() {
    return inertia(
      'Projects',
      {
        projects: await this.ws.list(),
        presets: PRESETS.map(({ id, title, description, project }) => ({
          id,
          title,
          description,
          ...summaryOf(id, project),
        })),
      },
      { meta: { title: 'Projects' } },
    )
  }

  @Get('/p/:slug')
  async editor(ctx: RequestContext) {
    const props = await this.load(ctx.params.slug)
    if (!props) return notFound(`No project "${ctx.params.slug}".`)
    return inertia('Editor', props, { meta: { title: props.project.name } })
  }

  /** What render drivers open: the player alone, at the format's size. */
  @Get('/p/:slug/render/:format')
  async render(ctx: RequestContext) {
    const format = String(ctx.params.format).replace('x', ':') as Format
    if (!(format in FORMATS)) return notFound(`No format "${ctx.params.format}".`)
    const props = await this.load(ctx.params.slug)
    if (!props) return notFound(`No project "${ctx.params.slug}".`)
    return inertia(
      'Render',
      { ...props, format },
      { meta: { title: `${props.project.name} ${format}` } },
    )
  }

  @Get('/fun')
  funPage() {
    return inertia('Fun', { games: this.fun.rooms.games() }, { meta: { title: 'Fun Club' } })
  }

  /** A room's page; the browser brings its own player token, kept from making or joining it. */
  /** A solo arcade game; the page finds it by id in the arcade's list. */
  @Get('/fun/play/:id')
  funPlay(ctx: RequestContext) {
    const id = String(ctx.params.id)
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return notFound('No such game.')
    return inertia('FunPlay', { id }, { meta: { title: 'Fun Club' } })
  }

  @Get('/fun/:code')
  funRoom(ctx: RequestContext) {
    // Only a real room code reaches the page: it ends up in request paths there.
    const code = String(ctx.params.code).toUpperCase()
    if (!CODE.test(code)) return notFound('That is not a room code.')
    return inertia('FunRoom', { code }, { meta: { title: `Room ${code}` } })
  }

  @Get('/memes')
  async memesPage() {
    return inertia('Memes', { memes: await this.memes.list() }, { meta: { title: 'Memes' } })
  }

  @Get('/memes/:id')
  async memePage(ctx: RequestContext) {
    let meme
    try {
      meme = await this.memes.read(ctx.params.id)
    } catch {
      return notFound(`No meme called "${ctx.params.id}".`)
    }
    return inertia('Meme', { id: ctx.params.id, meme }, { meta: { title: meme.name } })
  }

  @Get('/utilities')
  async utilitiesPage() {
    return inertia(
      'Utilities',
      { tools: await this.tools.list() },
      { meta: { title: 'Utilities' } },
    )
  }

  @Get('/utilities/:id')
  async utilityPage(ctx: RequestContext) {
    const tool = (await this.tools.list()).find((t) => t.id === ctx.params.id)
    if (!tool) return notFound('No such utility.')
    return inertia('Utility', { tool }, { meta: { title: tool.title } })
  }
}
