import { Controller, Get, Post, Put, reply, type RequestContext } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { LabelRevisionUseCase } from '../use-cases/label-revision.use-case'
import { ListHistoryUseCase } from '../use-cases/list-history.use-case'
import { RestoreRevisionUseCase } from '../use-cases/restore-revision.use-case'
import { StepHistoryUseCase } from '../use-cases/step-history.use-case'

@Controller()
export class HistoryController {
  constructor(
    private readonly listHistoryUseCase: ListHistoryUseCase,
    private readonly restoreRevisionUseCase: RestoreRevisionUseCase,
    private readonly labelRevisionUseCase: LabelRevisionUseCase,
    private readonly stepHistory: StepHistoryUseCase,
  ) {}

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
    const before = ctx.query.before ?? ctx.body?.before
    return this.listHistoryUseCase.execute(
      ctx.params.slug,
      before === undefined ? undefined : Number(before),
    )
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
    const baseVersion = ctx.body?.baseVersion
    return this.restoreRevisionUseCase.execute(
      ctx.params.slug,
      Number(ctx.params.id),
      baseVersion === undefined ? undefined : String(baseVersion),
    )
  }

  @Put('/:slug/history/:id/label')
  async labelRevision(ctx: RequestContext) {
    const { slug, id } = ctx.params
    await this.labelRevisionUseCase.execute(slug, Number(id), String(ctx.body?.label ?? ''))
    return reply.noContent()
  }

  @Post('/:slug/undo')
  undo(ctx: RequestContext) {
    return this.stepHistory.execute(ctx.params.slug, 'undo')
  }

  @Post('/:slug/redo')
  redo(ctx: RequestContext) {
    return this.stepHistory.execute(ctx.params.slug, 'redo')
  }
}
