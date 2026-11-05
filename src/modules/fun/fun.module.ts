import { defineModule } from '@forinda/kickjs'
import { FunController } from './fun.controller'
// Imported for its decorator: @WsController registers the socket with WsAdapter.
import './fun.ws'

export const FunModule = defineModule({
  name: 'FunModule',
  build: () => ({
    routes() {
      return [{ path: '/fun', controller: FunController }]
    },
  }),
})
