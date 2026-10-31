import { Logger, ProblemException, Service, Inject } from '@forinda/kickjs'
import type { Registry } from '@/core/render/registry'
import type { Workspace } from '@/core/storage/workspace'
import { voiceProject } from '@/core/voice/voice-project'
import { REGISTRY, WORKSPACE } from '../tokens'

const log = Logger.for('Voice')

@Service()
export class GenerateVoiceUseCase {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(REGISTRY) private readonly registry: Registry,
  ) {}

  async execute(slug: string, only?: string) {
    const provider = this.registry.voices.get('edge-tts')!
    const check = await provider.check()
    if (!check.ok) {
      throw new ProblemException({
        status: 400,
        detail: `${provider.name} can't run here`,
        missing: check.missing,
      })
    }
    const clips = await voiceProject(this.ws, slug, provider, {
      only,
      onProgress: (done, total) => {
        if (total && done === 0) {
          log.info(`${slug} generating ${total} line${total === 1 ? '' : 's'}`)
        } else if (total && done === total) log.info(`${slug} voice done`)
      },
    }).catch((err: Error) => {
      log.error(`${slug} voice failed: ${err.message}`)
      throw err
    })
    return { clips: Object.fromEntries(Object.entries(clips).filter(([, c]) => c)) }
  }
}
