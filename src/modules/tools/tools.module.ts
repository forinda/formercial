import { defineModule } from '@forinda/kickjs'
import { SignaturesController } from './signatures.controller'
import { SigningController } from './signing.controller'
import { ToolsController } from './tools.controller'

export const ToolsModule = defineModule({
  name: 'ToolsModule',
  build: () => ({
    routes() {
      return [
        { path: '/tools/signatures', controller: SignaturesController },
        { path: '/tools/signing', controller: SigningController },
        { path: '/tools', controller: ToolsController },
      ]
    },
  }),
})
