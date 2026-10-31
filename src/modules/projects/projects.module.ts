import { defineModule } from '@forinda/kickjs'
import { STORAGE, projectsRoot, workspaceId } from '@/adapters/storage'
import { createRegistry } from '@/core/render/registry'
import { createTrust } from '@/core/storage/trust'
import { openWorkspace } from '@/core/storage/workspace'
import formercialConfig from '@/formercial.config'
import { AssetsController } from './controllers/assets.controller'
import { DriversController } from './controllers/drivers.controller'
import { HistoryController } from './controllers/history.controller'
import { PresetsController } from './controllers/presets.controller'
import { ProjectsController } from './controllers/projects.controller'
import { RendersController } from './controllers/renders.controller'
import { SchemaController } from './controllers/schema.controller'
import { VoiceController } from './controllers/voice.controller'
import { REGISTRY, TRUST, WORKSPACE } from './tokens'

export const ProjectsModule = defineModule({
  name: 'ProjectsModule',
  build: () => ({
    register(container) {
      // New functions on every boot, so a reload builds new ones: the container
      // would otherwise reuse the instance, and shutdown closed its history.
      container.registerFactory(REGISTRY, () => createRegistry(formercialConfig))
      container.registerFactory(WORKSPACE, () =>
        openWorkspace(container.resolve(STORAGE), { cwd: process.cwd(), root: projectsRoot() }),
      )
      container.registerFactory(TRUST, () => createTrust({ workspace: workspaceId() }))
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
