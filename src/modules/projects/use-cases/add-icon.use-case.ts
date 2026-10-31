import { HttpException, Service } from '@forinda/kickjs'
import { storeIcon } from '@/core/icons'
import { Studio } from '../services/studio.service'

@Service()
export class AddIconUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, name: string) {
    const path = await storeIcon(this.studio.ws, slug, name).catch((err: Error) => {
      throw HttpException.badRequest(err.message)
    })
    return { path }
  }
}
