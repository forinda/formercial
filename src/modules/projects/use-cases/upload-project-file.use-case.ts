import { HttpException, Service } from '@forinda/kickjs'
import { Studio } from '../services/studio.service'

@Service()
export class UploadProjectFileUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, path: string, read: () => Promise<Uint8Array>) {
    if (!path.startsWith('media/')) throw HttpException.badRequest('uploads go under media/')
    this.studio.ws.key(slug, path)
    await this.studio.ws.putFile(slug, path, await read())
  }
}
