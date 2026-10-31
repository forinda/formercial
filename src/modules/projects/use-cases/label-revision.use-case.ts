import { Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

@Service()
export class LabelRevisionUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, id: number, label: string) {
    const name = label.trim().slice(0, 80)
    await this.studio.requireHistory().setLabel(slug, id, name || null)
  }
}
