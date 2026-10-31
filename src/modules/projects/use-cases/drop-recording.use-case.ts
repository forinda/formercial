import { Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { recordingPath } from '@/core/voice/voice-project'
import { WORKSPACE } from '../tokens'

@Service()
export class DropRecordingUseCase {
  constructor(@Inject(WORKSPACE) private readonly ws: Workspace) {}

  async execute(slug: string, sceneId: string) {
    await this.ws.deleteFile(slug, recordingPath(sceneId))
  }
}
