import { HttpException, Inject, Service } from '@forinda/kickjs'
import { storeFontFromUrl } from '@/core/assets/font-links'
import { storeGoogleFont } from '@/core/assets/fonts'
import type { Workspace } from '@/core/storage/workspace'
import { ProjectEvents } from '../services/project-events.service'
import { WORKSPACE } from '../tokens'

/** Download a Google Fonts family, or what a link holds, into the project's media/fonts/. */
@Service()
export class AddFontUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    private readonly events: ProjectEvents,
  ) {}

  async execute(slug: string, input: { url: string; family: string; weight?: number }) {
    const { url, family, weight } = input
    if ((family || !url) && !/^[A-Za-z0-9 ]{1,60}$/.test(family)) {
      throw HttpException.badRequest('a font family is letters, digits and spaces')
    }
    if (weight !== undefined && !(Number.isInteger(weight) && weight >= 1 && weight <= 1000)) {
      throw HttpException.badRequest('a font weight is a whole number from 1 to 1000')
    }
    const files = url
      ? await storeFontFromUrl(this.ws, slug, {
          url,
          family: family || undefined,
          weight,
        }).catch((err: Error) => {
          throw HttpException.badRequest(err.message)
        })
      : await storeGoogleFont(this.ws, slug, family)
    this.events.emit(slug, 'project-changed', {
      version: (await this.ws.read(slug)).version,
    })
    return { files }
  }
}
