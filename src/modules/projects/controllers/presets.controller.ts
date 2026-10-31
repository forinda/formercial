import { Controller, Get } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { PRESETS } from '@/presets'

@Controller()
export class PresetsController {
  /** Ready-made commercials a new project can start from. */
  @McpTool({
    name: 'list_presets',
    description: 'Ready-made 30-second commercials create_project can start from.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  list() {
    return PRESETS.map(({ id, title, description, lang }) => ({ id, title, description, lang }))
  }
}
