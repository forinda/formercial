import { defineModule } from '@forinda/kickjs'
import { ToolsController } from './tools.controller'

export const ToolsModule = defineModule({
  name: 'ToolsModule',
  build: () => ({
    routes() {
      return [{ path: '/tools', controller: ToolsController }]
    },
  }),
})
