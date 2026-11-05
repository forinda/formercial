// Memes: create, read, save, delete, and their pictures by `?path=media/...`.
import {
  Controller,
  Delete,
  Get,
  HttpException,
  Post,
  Put,
  reply,
  type RequestContext,
} from '@forinda/kickjs'
import { readBody } from '@/modules/projects/http/read-body'
import { MemeStore } from './meme-store.service'

const MAX_UPLOAD = 25 * 1024 * 1024
const pathOf = (ctx: RequestContext) => {
  const path = String(ctx.query.path ?? '')
  if (!path) throw HttpException.badRequest('path is required')
  return path
}

@Controller()
export class MemesController {
  constructor(private readonly memes: MemeStore) {}

  @Get('/')
  list() {
    return this.memes.list()
  }

  @Post('/')
  async create(ctx: RequestContext) {
    return reply.created(await this.memes.create(String(ctx.body?.name ?? '')))
  }

  @Get('/:id')
  read(ctx: RequestContext) {
    return this.memes.read(ctx.params.id)
  }

  @Put('/:id')
  save(ctx: RequestContext) {
    return this.memes.write(ctx.params.id, ctx.body)
  }

  @Delete('/:id')
  async remove(ctx: RequestContext) {
    await this.memes.remove(ctx.params.id)
    return reply.noContent()
  }

  @Get('/:id/file')
  async file(ctx: RequestContext) {
    const { bytes, type } = await this.memes.getFile(ctx.params.id, pathOf(ctx))
    return ctx.sendResponse(
      new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: { 'content-type': type, 'cache-control': 'no-cache' },
      }),
    )
  }

  @Put('/:id/file')
  async upload(ctx: RequestContext) {
    await this.memes.putFile(ctx.params.id, pathOf(ctx), await readBody(ctx, MAX_UPLOAD))
    return reply.noContent()
  }
}
