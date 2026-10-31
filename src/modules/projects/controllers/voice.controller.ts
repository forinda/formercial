import { Controller, Delete, Post, Put, reply, type RequestContext } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { readBody } from '../http/read-body'
import { DropRecordingUseCase } from '../use-cases/drop-recording.use-case'
import { GenerateVoiceUseCase } from '../use-cases/generate-voice.use-case'
import { SaveRecordingUseCase } from '../use-cases/save-recording.use-case'

const MAX_UPLOAD = 50 * 1024 * 1024

@Controller()
export class VoiceController {
  constructor(
    private readonly generateVoice: GenerateVoiceUseCase,
    private readonly saveRecording: SaveRecordingUseCase,
    private readonly dropRecordingUseCase: DropRecordingUseCase,
  ) {}

  @McpTool({
    name: 'voice_project',
    description:
      "Generate any missing or changed voice lines with edge-tts. Lines are sent to Microsoft's speech service.",
    inputSchema: z.object({}),
  })
  @Post('/:slug/voice')
  voiceAll(ctx: RequestContext) {
    return this.generateVoice.execute(ctx.params.slug)
  }

  @Post('/:slug/voice/:sceneId')
  voiceOne(ctx: RequestContext) {
    return this.generateVoice.execute(ctx.params.slug, ctx.params.sceneId)
  }

  @Put('/:slug/recordings/:sceneId')
  record(ctx: RequestContext) {
    const { slug, sceneId } = ctx.params
    return this.saveRecording.execute({
      slug,
      sceneId,
      contentType: String(ctx.headers['content-type'] ?? ''),
      read: () => readBody(ctx, MAX_UPLOAD),
    })
  }

  @Delete('/:slug/recordings/:sceneId')
  async dropRecording(ctx: RequestContext) {
    await this.dropRecordingUseCase.execute(ctx.params.slug, ctx.params.sceneId)
    return reply.noContent()
  }
}
