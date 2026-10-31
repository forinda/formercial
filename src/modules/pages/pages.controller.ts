import { Controller, Get, type RequestContext, Inject } from '@forinda/kickjs'
import { inertia } from '@forinda/kickjs-inertia'
import { FORMATS, type Format } from '@/core/project/project'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { clipLengths } from '@/core/voice/voice-project'
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
        presets: PRESETS.map(({ id, title, description }) => ({ id, title, description })),
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
}
