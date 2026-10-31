import { HttpException, Service } from '@forinda/kickjs'
import { searchIcons } from '@/core/assets/icons'

@Service()
export class SearchIconsUseCase {
  async execute(query: string) {
    const icons = await searchIcons(query).catch((err: Error) => {
      throw new HttpException(502, err.message)
    })
    return { icons }
  }
}
