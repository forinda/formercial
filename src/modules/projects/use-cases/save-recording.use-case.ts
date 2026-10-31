import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HttpException, Service } from '@forinda/kickjs'
import { probeSeconds } from '@/core/media/media'
import { recordingPath } from '@/core/voice/voice-project'
import { withWorkdir } from '@/core/storage/workdir'
import { Studio } from '../services/studio.service'

const AUDIO = /^audio\/(webm|ogg)\b/

@Service()
export class SaveRecordingUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(input: {
    slug: string
    sceneId: string
    contentType: string
    read: () => Promise<Uint8Array>
  }) {
    const { slug } = input
    const path = recordingPath(input.sceneId)
    this.studio.ws.key(slug, path)
    if (!AUDIO.test(input.contentType)) {
      throw HttpException.badRequest('send audio/webm or audio/ogg')
    }
    const bytes = await input.read()
    if (bytes.length === 0) throw HttpException.badRequest('the recording is empty')
    // Probe before storing, so a file ffprobe can't read never replaces a good one.
    const seconds = await withWorkdir(this.studio.ws, slug, [], async (dir) => {
      await mkdir(join(dir, 'voice'), { recursive: true })
      await writeFile(join(dir, path), bytes)
      const s = await probeSeconds(join(dir, path)).catch(() => {
        throw HttpException.badRequest("that isn't audio ffprobe can read")
      })
      return { result: s, outputs: [path] }
    })
    return { seconds }
  }
}
