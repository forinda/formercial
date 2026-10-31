import { Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

@Service()
export class SetTrustUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, trusted: boolean) {
    const { project } = await this.studio.ws.read(slug)
    await this.studio.trust.set(slug, project, trusted)
  }
}
