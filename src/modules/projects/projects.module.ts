import { defineModule } from '@forinda/kickjs'
import { createRegistry } from '@/core/render/registry'
import formercialConfig from '@/formercial.config'
import { DriversController } from './drivers.controller'
import { PresetsController } from './presets.controller'
import { ProjectsController } from './projects.controller'
import { SchemaController } from './schema.controller'
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
        { path: '/presets', controller: PresetsController },
        { path: '/project-schema', controller: SchemaController },
      ]
    },
  }),
})
