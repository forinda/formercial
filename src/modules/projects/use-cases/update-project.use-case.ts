import { Service } from '@forinda/kickjs'
import type { Project } from '@/core/project/project'
import { Studio } from '../services/studio.service'

@Service()
export class UpdateProjectUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(input: {
    slug: string
    project: Project
    baseVersion: string
    from: 'agent' | 'editor' | 'app'
  }) {
    const { slug, from } = input
    // Your own edits in the editor keep a trusted project trusted. Anything
    // else, like an agent's tool call or a pulled change, needs trusting again.
    const before = await this.studio.ws.read(slug).catch(() => null)
    const keepTrust =
      from === 'editor' && before ? await this.studio.trust.isTrusted(slug, before.project) : false
    const { version } = await this.studio.ws.write(slug, input.project, input.baseVersion, from)
    const saved = (await this.studio.ws.read(slug)).project
    if (keepTrust) await this.studio.trust.set(slug, saved, true)
    const trusted = await this.studio.trust.isTrusted(slug, saved)
    this.studio.emit(slug, 'project-changed', { version })
    return { version, trusted, history: await this.studio.historyState(slug) }
  }
}
