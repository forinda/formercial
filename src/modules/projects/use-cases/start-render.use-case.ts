import { HttpException, ProblemException, Service } from '@forinda/kickjs'
import { FORMATS, type Format } from '@/core/project/project'
import { FormercialSettings, checkFps } from '@/core/settings'
import { Studio } from '../services/studio.service'

@Service()
export class StartRenderUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(input: {
    slug: string
    driver?: string
    format: unknown
    fps: unknown
    origin: string
  }) {
    const { slug, origin } = input
    const { project } = await this.studio.ws.read(slug)
    const name = input.driver ?? FormercialSettings.get().driver
    const driver = this.studio.registry.drivers.get(name)
    if (!driver) throw HttpException.badRequest(`no render driver "${name}"`)
    const check = await driver.check()
    if (!check.ok) {
      throw new ProblemException({
        status: 400,
        detail: `${name} can't run here`,
        missing: check.missing,
      })
    }
    if (!(await this.studio.trust.isTrusted(slug, project))) {
      throw HttpException.forbidden('this project has custom scenes: trust it before rendering')
    }
    const asked: unknown[] = input.format === 'all' ? project.formats : [input.format]
    if (!asked.every((f): f is Format => typeof f === 'string' && f in FORMATS)) {
      throw HttpException.badRequest('format is 16:9, 9:16, 1:1 or all')
    }
    let fps: number | undefined
    try {
      fps = input.fps === undefined ? undefined : checkFps(input.fps)
    } catch (err) {
      throw HttpException.badRequest((err as Error).message)
    }
    return { jobs: asked.map((format) => this.studio.render(slug, format, name, origin, fps)) }
  }
}
