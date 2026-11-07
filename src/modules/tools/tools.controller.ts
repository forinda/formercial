// Utilities: list them, make a job, add files, start it, poll it, download.
import { Controller, Delete, Get, Post, Put, reply, type RequestContext } from '@forinda/kickjs'
import { readBody } from '@/modules/projects/http/read-body'
import { ToolJobs, type ToolJob } from './tool-jobs.service'

/** Kinds a browser may show in place; anything else only downloads. */
const SHOWN: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
}

@Controller()
export class ToolsController {
  constructor(private readonly jobs: ToolJobs) {}

  private view = (job: ToolJob) => ({
    id: job.id,
    tool: job.tool,
    state: job.state,
    files: job.files,
    outputs: job.outputs.map((file) => ({ file, name: this.jobs.nameFor(job, file) })),
    result: job.result,
    error: job.error,
  })

  @Get('/')
  list() {
    return this.jobs.list()
  }

  @Post('/:tool/jobs')
  async create(ctx: RequestContext) {
    return reply.created(this.view(await this.jobs.create(ctx.params.tool, ctx.body?.options)))
  }

  @Get('/jobs/:job')
  status(ctx: RequestContext) {
    return this.view(this.jobs.status(ctx.params.job))
  }

  @Put('/jobs/:job/files')
  async upload(ctx: RequestContext) {
    const bytes = await readBody(ctx, this.jobs.sizeLimit(ctx.params.job))
    return this.view(
      await this.jobs.addFile(ctx.params.job, String(ctx.query.name ?? 'file'), bytes),
    )
  }

  /** A job its page gave up on before starting it. */
  @Delete('/jobs/:job')
  async drop(ctx: RequestContext) {
    await this.jobs.drop(ctx.params.job)
    return reply.noContent()
  }

  @Post('/jobs/:job/start')
  start(ctx: RequestContext) {
    return this.view(this.jobs.start(ctx.params.job))
  }

  @Get('/jobs/:job/files/:name')
  async download(ctx: RequestContext) {
    const { bytes, name } = await this.jobs.output(ctx.params.job, ctx.params.name)
    // ?view=1 shows it in place, for the result's preview; sandboxed, so nothing in it can run.
    const shown = ctx.query.view ? SHOWN[name.split('.').pop() ?? ''] : undefined
    return ctx.sendResponse(
      new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: {
          'content-type': shown ?? 'application/octet-stream',
          'content-security-policy': 'sandbox',
          'x-content-type-options': 'nosniff',
          'content-disposition': `${shown ? 'inline' : 'attachment'}; filename="${name.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'cache-control': 'no-store',
        },
      }),
    )
  }
}
