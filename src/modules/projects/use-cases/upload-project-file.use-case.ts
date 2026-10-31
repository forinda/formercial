import { HttpException, Inject, Service } from '@forinda/kickjs'
import type { Workspace } from '@/core/storage/workspace'
import { WORKSPACE } from '../tokens'

@Service()
export class UploadProjectFileUseCase {
  constructor(@Inject(WORKSPACE) private readonly ws: Workspace) {}

  async execute(slug: string, path: string, read: () => Promise<Uint8Array>) {
    if (!path.startsWith('media/')) throw HttpException.badRequest('uploads go under media/')
    this.ws.key(slug, path)
    await this.ws.putFile(slug, path, await read())
  }
}
