import { defineModules } from '@forinda/kickjs'
import { MemesModule } from './memes/memes.module'
import { PagesModule } from './pages/pages.module'
import { ProjectsModule } from './projects/projects.module'
import { SeoModule } from './seo/seo.module'

// Every module the app mounts. `kick g module <name>` appends a `.mount(...)`
// line here; `kick rm module <name>` takes one out.
export const modules = defineModules()
  .mount(ProjectsModule())
  .mount(MemesModule())
  .mount(PagesModule())
  .mount(SeoModule())
