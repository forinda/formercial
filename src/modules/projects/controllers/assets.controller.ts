// What a project holds besides project.json: icons, fonts and its files by `?path=`,
// checked against the project folder on every call.
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
import { readBody } from '../http/read-body'
import { AddFontUseCase } from '../use-cases/add-font.use-case'
import { AddIconUseCase } from '../use-cases/add-icon.use-case'
import { ReadProjectFileUseCase } from '../use-cases/read-project-file.use-case'
import { SearchIconsUseCase } from '../use-cases/search-icons.use-case'
import { UploadProjectFileUseCase } from '../use-cases/upload-project-file.use-case'

const MAX_UPLOAD = 50 * 1024 * 1024

function pathOf(ctx: RequestContext): string {
  const path = String(ctx.query.path ?? '')
  if (!path) throw HttpException.badRequest('path is required')
  return path
}

@Controller()
export class AssetsController {
  constructor(
    private readonly searchIcons: SearchIconsUseCase,
    private readonly addIconUseCase: AddIconUseCase,
    private readonly addFontUseCase: AddFontUseCase,
    private readonly readFile: ReadProjectFileUseCase,
    private readonly uploadFile: UploadProjectFileUseCase,
  ) {}

  @McpTool({
    name: 'search_icons',
    description:
      'Find product and language icons by name, like vscode or typescript. Returns names to pass to add_icon. Searches through Iconify.',
    inputSchema: z.object({ query: z.string() }),
    annotations: { readOnlyHint: true },
  })
  @Get('/:slug/icons')
  findIcons(ctx: RequestContext) {
    return this.searchIcons.execute(String(ctx.query.query ?? ''))
  }

  @McpTool({
    name: 'add_icon',
    description:
      'Download an icon by name, like logos:typescript-icon, into the project. Returns the `path` to use in an icon block.',
    inputSchema: z.object({ name: z.string() }),
  })
  @Post('/:slug/icons')
  addIcon(ctx: RequestContext) {
    return this.addIconUseCase.execute(ctx.params.slug, String(ctx.body?.name ?? ''))
  }

  @Post('/:slug/fonts')
  addFont(ctx: RequestContext) {
    return this.addFontUseCase.execute(ctx.params.slug, {
      url: String(ctx.body?.url ?? '').trim(),
      family: String(ctx.body?.family ?? '').trim(),
      weight: ctx.body?.weight === undefined ? undefined : Number(ctx.body.weight),
    })
  }

  /** A stream, with its own status and headers, so it can't be a returned value. */
  @Get('/:slug/file')
  async file(ctx: RequestContext) {
    const range = ctx.headers.range === undefined ? undefined : String(ctx.headers.range)
    return ctx.sendResponse(await this.readFile.execute(ctx.params.slug, pathOf(ctx), range))
  }

  @Put('/:slug/file')
  async upload(ctx: RequestContext) {
    await this.uploadFile.execute(ctx.params.slug, pathOf(ctx), () => readBody(ctx, MAX_UPLOAD))
    return reply.noContent()
  }
}
