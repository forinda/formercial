import { HttpException, Inject, Service } from '@forinda/kickjs'
import { SLUG, slugFrom, starterProject } from '@/core/project/project'
import { FormercialSettings } from '@/core/settings'
import type { Workspace } from '@/core/storage/workspace'
import { fromPreset, storePresetFonts } from '@/presets'
import { WORKSPACE } from '../tokens'

@Service()
export class CreateProjectUseCase {
  constructor(@Inject(WORKSPACE) private readonly ws: Workspace) {}

  async execute(input: { name: string; preset?: string }) {
    const name = input.name.trim()
    if (!name) throw HttpException.badRequest('name is required')
    const taken = new Set((await this.ws.list()).map((p) => p.slug))
    const base = slugFrom(name)
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    if (!SLUG.test(slug)) throw HttpException.badRequest(`can't make a project name from "${name}"`)
    let project
    try {
      const { voice } = FormercialSettings.get()
      project = input.preset ? fromPreset(input.preset, name, voice) : starterProject(name, voice)
    } catch (err) {
      throw HttpException.badRequest((err as Error).message)
    }
    await this.ws.write(slug, project, null)
    if (input.preset) await storePresetFonts(this.ws, slug, input.preset)
    return { slug }
  }
}
