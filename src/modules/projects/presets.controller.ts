import { Controller, Get, type RequestContext } from '@forinda/kickjs'
import { PRESETS } from '@/presets'

@Controller()
export class PresetsController {
  /** Ready-made commercials a new project can start from. */
  @Get('/')
  list(ctx: RequestContext) {
    ctx.json(PRESETS.map(({ id, title, description, lang }) => ({ id, title, description, lang })))
  }
}
