import { HttpException, Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectHistory } from '../services/project-history.service'
import { WORKSPACE } from '../tokens'

@Service()
export class StepHistoryUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    private readonly history: ProjectHistory,
  ) {}

  async execute(slug: string, direction: 'undo' | 'redo') {
    this.history.require()
    const done = await this.ws[direction](slug)
    if (!done) throw HttpException.conflict(`nothing to ${direction}`)
    return this.history.changedUnderneath(slug, done.version)
  }
}
