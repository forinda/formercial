import { HttpException, ProblemException, Service, Inject } from '@forinda/kickjs'
import { FORMATS, type Format } from '@/core/project/project'
import type { Registry } from '@/core/render/registry'
import { FormercialSettings, checkFps } from '@/core/settings'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { Renders } from '../services/renders.service'
import { REGISTRY, TRUST, WORKSPACE } from '../tokens'

@Service()
export class StartRenderUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
    @Inject(REGISTRY) private readonly registry: Registry,
    private readonly renders: Renders,
  ) {}

  async execute(input: {
    slug: string
    driver?: string
    format: unknown
    fps: unknown
    origin: string
  }) {
    const { slug, origin } = input
    const { project } = await this.ws.read(slug)
    const name = input.driver ?? FormercialSettings.get().driver
    const driver = this.registry.drivers.get(name)
    if (!driver) throw HttpException.badRequest(`no render driver "${name}"`)
    const check = await driver.check()
    if (!check.ok) {
      throw new ProblemException({
        status: 400,
        detail: `${name} can't run here`,
        missing: check.missing,
      })
    }
    if (!(await this.trust.isTrusted(slug, project))) {
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
    return { jobs: asked.map((format) => this.renders.start(slug, format, name, origin, fps)) }
  }
}
