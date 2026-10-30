import { defineModule } from '@forinda/kickjs'
import { createRegistry } from '@/core/render/registry'
import formercialConfig from '@/formercial.config'
import { DriversController } from './drivers.controller'
import { ProjectsController } from './projects.controller'
import { REGISTRY } from './tokens'

export const ProjectsModule = defineModule({
  name: 'ProjectsModule',
  build: () => ({
    register(container) {
      container.registerFactory(REGISTRY, () => createRegistry(formercialConfig))
    },
    routes() {
      return [
        { path: '/projects', controller: ProjectsController },
        { path: '/drivers', controller: DriversController },
      ]
    },
  }),
})
