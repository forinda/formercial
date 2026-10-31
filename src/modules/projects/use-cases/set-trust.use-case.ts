import { Inject, Service } from '@forinda/kickjs'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { TRUST, WORKSPACE } from '../tokens'

@Service()
export class SetTrustUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
  ) {}

  async execute(slug: string, trusted: boolean) {
    const { project } = await this.ws.read(slug)
    await this.trust.set(slug, project, trusted)
  }
}
