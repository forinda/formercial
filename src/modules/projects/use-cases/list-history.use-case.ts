import { Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectHistory } from '../services/project-history.service'
import { WORKSPACE } from '../tokens'

const PAGE = 200

@Service()
export class ListHistoryUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    private readonly history: ProjectHistory,
  ) {}

  async execute(slug: string, before?: number) {
    const history = this.history.require()
    // Edits made while the app wasn't running show up here too.
    await this.ws.remember(slug, await this.ws.getFile(slug, 'project.json'), 'outside')
    // One more than a page, to know whether there are older ones.
    const found = await history.list(slug, { limit: PAGE + 1, before })
    return {
      current: (await history.head(slug))?.id ?? null,
      revisions: found.slice(0, PAGE),
      older: found.length > PAGE,
    }
  }
}
