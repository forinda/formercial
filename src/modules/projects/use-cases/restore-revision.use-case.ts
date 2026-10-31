import { Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

@Service()
export class RestoreRevisionUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, id: number, baseVersion?: string) {
    this.studio.requireHistory()
    const { version } = await this.studio.ws.restore(slug, id, baseVersion)
    return this.studio.changedUnderneath(slug, version)
  }
}
