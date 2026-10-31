import { resolve } from 'node:path'
import { Inject, Service } from '@forinda/kickjs'
import type { Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { projectsRoot } from '@/adapters/storage'
import type { Workspace } from '@/core/storage/workspace'
import { Renders } from '../services/renders.service'
import { WORKSPACE } from '../tokens'

@Service()
export class ListRendersUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly renders: Renders,
  ) {}

  async execute(slug: string) {
    // key() checks the slug; a listing prefix ends in '/', which a key can't.
    const prefix = `${this.ws.key(slug, 'renders')}/`
    const page = await this.storage.list({ prefix })
    return {
      jobs: this.renders.queue.jobs.filter((j) => j.slug === slug),
      files: page.files.map((f) => f.key.slice(slug.length + 1)),
      folder: resolve(projectsRoot(), slug, 'renders'),
    }
  }
}
