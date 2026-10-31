import { Service } from '@forinda/kickjs'
import { clipLengths } from '@/core/voice/voice-project'
import { Studio } from '../services/studio.service'

@Service()
export class GetProjectUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string) {
    const { project, version } = await this.studio.ws.read(slug)
    const clips = await clipLengths(this.studio.ws, slug, project)
    return {
      project,
      version,
      clips: Object.fromEntries(Object.entries(clips).filter(([, c]) => c)),
      trusted: await this.studio.trust.isTrusted(slug, project),
      history: await this.studio.historyState(slug),
    }
  }
}
