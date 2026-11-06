// Remembered signatures and initials, and the name, for the signing workspace.
import { Controller, Delete, Get, Put, reply, type RequestContext } from '@forinda/kickjs'
import { readBody } from '@/modules/projects/http/read-body'
import { MAX_SIGNATURE, SignatureStore } from './signature-store.service'

@Controller()
export class SignaturesController {
  constructor(private readonly store: SignatureStore) {}

  @Get('/')
  list() {
    return this.store.list()
  }

  @Put('/')
  async add(ctx: RequestContext) {
    const bytes = await readBody(ctx, MAX_SIGNATURE)
    return reply.created(await this.store.add(ctx.query.kind, ctx.query.made, bytes))
  }

  @Put('/name')
  async name(ctx: RequestContext) {
    return { name: await this.store.setName(ctx.body?.name) }
  }

  @Get('/:id')
  async picture(ctx: RequestContext) {
    const bytes = await this.store.read(ctx.params.id)
    return ctx.sendResponse(
      new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: {
          'content-type': 'image/png',
          'x-content-type-options': 'nosniff',
          'content-security-policy': 'sandbox',
          'cache-control': 'no-store',
        },
      }),
    )
  }

  @Delete('/:id')
  async remove(ctx: RequestContext) {
    await this.store.remove(ctx.params.id)
    return reply.noContent()
  }
}
