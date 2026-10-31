import { Controller, Get, Post, getEnv, reply, type RequestContext } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { renderOrigin } from '../http/render-origin'
import { ListRendersUseCase } from '../use-cases/list-renders.use-case'
import { StartRenderUseCase } from '../use-cases/start-render.use-case'

@Controller()
export class RendersController {
  constructor(
    private readonly listRenders: ListRendersUseCase,
    private readonly startRender: StartRenderUseCase,
  ) {}

  @McpTool({
    name: 'get_renders',
    description:
      'Render jobs with their state and progress, the finished files, and `folder`: where the files are on disk.',
    annotations: { readOnlyHint: true },
  })
  @Get('/:slug/renders')
  renders(ctx: RequestContext) {
    return this.listRenders.execute(ctx.params.slug)
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
  async render(ctx: RequestContext) {
    return reply.accepted(
      await this.startRender.execute({
        slug: ctx.params.slug,
        driver: ctx.body?.driver === undefined ? undefined : String(ctx.body.driver),
        format: ctx.body?.format,
        fps: ctx.body?.fps,
        origin: renderOrigin(ctx.req as never, getEnv('PORT')),
      }),
    )
  }
}
