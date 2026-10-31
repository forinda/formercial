import { Service } from '@forinda/kickjs'
import { recordingPath } from '@/core/voice/voice-project'
import { Studio } from '../services/studio.service'

@Service()
export class DropRecordingUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, sceneId: string) {
    await this.studio.ws.deleteFile(slug, recordingPath(sceneId))
  }
}
