import { resolve } from 'node:path'
import { Service } from '@forinda/kickjs'
import { projectsRoot } from '@/adapters/storage'
import { Studio } from '../services/studio.service'

@Service()
export class ListRendersUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string) {
    // key() checks the slug; a listing prefix ends in '/', which a key can't.
    const prefix = `${this.studio.ws.key(slug, 'renders')}/`
    const page = await this.studio.storage.list({ prefix })
    return {
      jobs: this.studio.queue.jobs.filter((j) => j.slug === slug),
      files: page.files.map((f) => f.key.slice(slug.length + 1)),
      folder: resolve(projectsRoot(), slug, 'renders'),
    }
  }
}
