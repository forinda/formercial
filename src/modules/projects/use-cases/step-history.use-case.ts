import { HttpException, Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

@Service()
export class StepHistoryUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, direction: 'undo' | 'redo') {
    this.studio.requireHistory()
    const done = await this.studio.ws[direction](slug)
    if (!done) throw HttpException.conflict(`nothing to ${direction}`)
    return this.studio.changedUnderneath(slug, done.version)
  }
}
