import { HttpException, Service } from '@forinda/kickjs'
import { storeFontFromUrl } from '@/core/font-links'
import { storeGoogleFont } from '@/core/fonts'
import { Studio } from '../services/studio.service'

/** Download a Google Fonts family, or what a link holds, into the project's media/fonts/. */
@Service()
export class AddFontUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, input: { url: string; family: string; weight?: number }) {
    const { url, family, weight } = input
    if ((family || !url) && !/^[A-Za-z0-9 ]{1,60}$/.test(family)) {
      throw HttpException.badRequest('a font family is letters, digits and spaces')
    }
    if (weight !== undefined && !(Number.isInteger(weight) && weight >= 1 && weight <= 1000)) {
      throw HttpException.badRequest('a font weight is a whole number from 1 to 1000')
    }
    const files = url
      ? await storeFontFromUrl(this.studio.ws, slug, {
          url,
          family: family || undefined,
          weight,
        }).catch((err: Error) => {
          throw HttpException.badRequest(err.message)
        })
      : await storeGoogleFont(this.studio.ws, slug, family)
    this.studio.emit(slug, 'project-changed', {
      version: (await this.studio.ws.read(slug)).version,
    })
    return { files }
  }
}
