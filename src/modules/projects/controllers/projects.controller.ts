// Projects are addressed by slug. Each route hands its task to a use case.
import {
  Controller,
  Get,
  HttpException,
  Post,
  Put,
  reply,
  type RequestContext,
} from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { SLUG, type Project } from '@/core/project'
import { Studio } from '../services/studio.service'
import { CreateProjectUseCase } from '../use-cases/create-project.use-case'
import { GetProjectUseCase } from '../use-cases/get-project.use-case'
import { SetTrustUseCase } from '../use-cases/set-trust.use-case'
import { UpdateProjectUseCase } from '../use-cases/update-project.use-case'

@Controller()
export class ProjectsController {
  constructor(
    private readonly studio: Studio,
    private readonly createProject: CreateProjectUseCase,
    private readonly getProject: GetProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly setTrustUseCase: SetTrustUseCase,
  ) {}

  @McpTool({
    name: 'list_projects',
    description: 'Every commercial in the workspace, as { slug, name }.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  list() {
    return this.studio.ws.list()
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
  async create(ctx: RequestContext) {
    const preset = ctx.body?.preset ? String(ctx.body.preset) : undefined
    return reply.created(
      await this.createProject.execute({ name: String(ctx.body?.name ?? ''), preset }),
    )
  }

  @McpTool({
    name: 'get_project',
    description:
      'Read a commercial: its project.json as `project`, the `version` to send back with update_project, its voice `clips`, and whether its custom scenes are `trusted`.',
    annotations: { readOnlyHint: true },
  })
  @Get('/:slug')
  read(ctx: RequestContext) {
    return this.getProject.execute(ctx.params.slug)
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
    const { project, baseVersion } = ctx.body ?? {}
    const viaAgent = Boolean(ctx.headers['x-mcp-tool'])
    const fromEditor = ctx.headers['x-formercial-editor'] === '1' && !viaAgent
    return this.updateProject.execute({
      slug: ctx.params.slug,
      project: project as Project,
      baseVersion: String(baseVersion ?? ''),
      from: viaAgent ? 'agent' : fromEditor ? 'editor' : 'app',
    })
  }

  @Post('/:slug/trust')
  async setTrust(ctx: RequestContext) {
    await this.setTrustUseCase.execute(ctx.params.slug, ctx.body?.trusted === true)
    return reply.noContent()
  }

  @Get('/:slug/events')
  events(ctx: RequestContext) {
    const { slug } = ctx.params
    if (!SLUG.test(slug)) throw HttpException.badRequest('invalid project name')
    const sse = ctx.sse()
    sse.onClose(this.studio.listen(slug, sse))
  }
}
