import { Inject, Service } from '@forinda/kickjs'
import type { Project } from '@/core/project/project'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectEvents } from '../services/project-events.service'
import { ProjectHistory } from '../services/project-history.service'
import { TRUST, WORKSPACE } from '../tokens'

@Service()
export class UpdateProjectUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
    private readonly history: ProjectHistory,
    private readonly events: ProjectEvents,
  ) {}

  async execute(input: {
    slug: string
    project: Project
    baseVersion: string
    from: 'agent' | 'editor' | 'app'
  }) {
    const { slug, from } = input
    // Your own edits in the editor keep a trusted project trusted. Anything
    // else, like an agent's tool call or a pulled change, needs trusting again.
    const before = await this.ws.read(slug).catch(() => null)
    const keepTrust =
      from === 'editor' && before ? await this.trust.isTrusted(slug, before.project) : false
    const { version } = await this.ws.write(slug, input.project, input.baseVersion, from)
    const saved = (await this.ws.read(slug)).project
    if (keepTrust) await this.trust.set(slug, saved, true)
    const trusted = await this.trust.isTrusted(slug, saved)
    this.events.emit(slug, 'project-changed', { version })
    return { version, trusted, history: await this.history.state(slug) }
  }
}
