import { defineModule } from '@forinda/kickjs'
import { SignaturesController } from './signatures.controller'
import { ToolsController } from './tools.controller'

export const ToolsModule = defineModule({
  name: 'ToolsModule',
  build: () => ({
    routes() {
      return [
        { path: '/tools/signatures', controller: SignaturesController },
        { path: '/tools', controller: ToolsController },
      ]
    },
  }),
})
