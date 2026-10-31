import { Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

const PAGE = 200

@Service()
export class ListHistoryUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, before?: number) {
    const history = this.studio.requireHistory()
    // Edits made while the app wasn't running show up here too.
    await this.studio.ws.remember(
      slug,
      await this.studio.ws.getFile(slug, 'project.json'),
      'outside',
    )
    // One more than a page, to know whether there are older ones.
    const found = await history.list(slug, { limit: PAGE + 1, before })
    return {
      current: (await history.head(slug))?.id ?? null,
      revisions: found.slice(0, PAGE),
      older: found.length > PAGE,
    }
  }
}
