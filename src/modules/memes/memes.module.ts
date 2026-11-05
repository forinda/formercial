import { defineModule } from '@forinda/kickjs'
import { MemesController } from './memes.controller'

export const MemesModule = defineModule({
  name: 'MemesModule',
  build: () => ({
    routes() {
      return [{ path: '/memes', controller: MemesController }]
    },
  }),
})
