// Signing documents kept on this machine: list, open, save what's placed,
// keep signed copies as versions, delete.
import { Controller, Delete, Get, Post, Put, reply, type RequestContext } from '@forinda/kickjs'
import { readBody } from '@/modules/projects/http/read-body'
import { MAX_SIGNING_PDF, SigningStore } from './signing-store.service'
import { ToolJobs } from './tool-jobs.service'

const pdf = (bytes: Uint8Array, name: string, inline = false) =>
  new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': 'application/pdf',
      'content-security-policy': 'sandbox',
      'x-content-type-options': 'nosniff',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  })

@Controller()
export class SigningController {
  constructor(
    private readonly store: SigningStore,
    private readonly jobs: ToolJobs,
  ) {}

  @Get('/')
  list() {
    return this.store.list()
  }

  @Post('/')
  async create(ctx: RequestContext) {
    const bytes = await readBody(ctx, MAX_SIGNING_PDF)
    return reply.created(await this.store.create(ctx.query.name, ctx.query.pages, bytes))
  }

  @Get('/:id')
  read(ctx: RequestContext) {
    return this.store.read(ctx.params.id)
  }

  @Delete('/:id')
  async remove(ctx: RequestContext) {
    await this.store.remove(ctx.params.id)
    return reply.noContent()
  }

  @Put('/:id/items')
  async items(ctx: RequestContext) {
    return this.store.saveItems(ctx.params.id, ctx.body?.items)
  }

  @Get('/:id/original')
  async original(ctx: RequestContext) {
    const { name } = await this.store.read(ctx.params.id)
    return ctx.sendResponse(pdf(await this.store.original(ctx.params.id), name))
  }

  @Put('/:id/pictures/:label')
  async putPicture(ctx: RequestContext) {
    const bytes = await readBody(ctx, 2 * 1024 * 1024)
    return this.store.putPicture(ctx.params.id, ctx.params.label, bytes)
  }

  @Get('/:id/pictures/:label')
  async picture(ctx: RequestContext) {
    const bytes = await this.store.picture(ctx.params.id, ctx.params.label)
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

  /**
   * Binds a signing job, before it starts, to this document: when it finishes
   * the server keeps its output as the next version, whether or not the page is
   * still open. Digitally signed only if a certificate went in (and the copy
   * carries a signature).
   */
  @Post('/:id/jobs/:job')
  async bind(ctx: RequestContext) {
    const id = ctx.params.id
    await this.store.read(id)
    this.jobs.whenDone(ctx.params.job, 'pdf-workspace-sign', async (job) => {
      const { bytes } = await this.jobs.output(job.id, job.outputs[0])
      const p12 = job.files.some((f) => f.kind === 'p12')
      return { version: (await this.store.addVersion(id, bytes, p12)).n }
    })
    return reply.noContent()
  }

  @Get('/:id/versions/:n')
  async version(ctx: RequestContext) {
    const { bytes, name } = await this.store.version(ctx.params.id, Number(ctx.params.n))
    return ctx.sendResponse(pdf(bytes, name, !!ctx.query.view))
  }
}
