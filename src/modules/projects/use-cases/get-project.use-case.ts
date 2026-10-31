import { Inject, Service } from '@forinda/kickjs'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { clipLengths } from '@/core/voice/voice-project'
import { ProjectHistory } from '../services/project-history.service'
import { TRUST, WORKSPACE } from '../tokens'

@Service()
export class GetProjectUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
    private readonly history: ProjectHistory,
  ) {}

  async execute(slug: string) {
    const { project, version } = await this.ws.read(slug)
    const clips = await clipLengths(this.ws, slug, project)
    return {
      project,
      version,
      clips: Object.fromEntries(Object.entries(clips).filter(([, c]) => c)),
      trusted: await this.trust.isTrusted(slug, project),
      history: await this.history.state(slug),
    }
  }
}
