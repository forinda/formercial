import { Service } from '@forinda/kickjs'
import { ProjectHistory } from '../services/project-history.service'

@Service()
export class LabelRevisionUseCase {
  constructor(private readonly history: ProjectHistory) {}

  async execute(slug: string, id: number, label: string) {
    const name = label.trim().slice(0, 80)
    await this.history.require().setLabel(slug, id, name || null)
  }
}
