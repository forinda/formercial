import { defineModule } from '@forinda/kickjs'
import { createRegistry } from '@/core/render/registry'
import formercialConfig from '@/formercial.config'
import { AssetsController } from './controllers/assets.controller'
import { DriversController } from './controllers/drivers.controller'
import { HistoryController } from './controllers/history.controller'
import { PresetsController } from './controllers/presets.controller'
import { ProjectsController } from './controllers/projects.controller'
import { RendersController } from './controllers/renders.controller'
import { SchemaController } from './controllers/schema.controller'
import { VoiceController } from './controllers/voice.controller'
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
        { path: '/projects', controller: HistoryController },
        { path: '/projects', controller: AssetsController },
        { path: '/projects', controller: VoiceController },
        { path: '/projects', controller: RendersController },
        { path: '/drivers', controller: DriversController },
        { path: '/presets', controller: PresetsController },
        { path: '/project-schema', controller: SchemaController },
      ]
    },
  }),
})
