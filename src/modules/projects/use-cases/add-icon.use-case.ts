import { HttpException, Inject, Service } from '@forinda/kickjs'
import { storeIcon } from '@/core/assets/icons'
import type { Workspace } from '@/core/storage/workspace'
import { WORKSPACE } from '../tokens'

@Service()
export class AddIconUseCase {
  constructor(@Inject(WORKSPACE) private readonly ws: Workspace) {}

  async execute(slug: string, name: string) {
    const path = await storeIcon(this.ws, slug, name).catch((err: Error) => {
      throw HttpException.badRequest(err.message)
    })
    return { path }
  }
}
