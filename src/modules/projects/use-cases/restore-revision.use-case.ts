import { Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectHistory } from '../services/project-history.service'
import { WORKSPACE } from '../tokens'

@Service()
export class RestoreRevisionUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    private readonly history: ProjectHistory,
  ) {}

  async execute(slug: string, id: number, baseVersion?: string) {
    this.history.require()
    const { version } = await this.ws.restore(slug, id, baseVersion)
    return this.history.changedUnderneath(slug, version)
  }
}
