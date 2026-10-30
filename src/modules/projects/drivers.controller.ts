import { Controller, Get, type RequestContext } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { driverReport } from '@/core/render/registry'
import { Studio } from './studio.service'

@Controller()
export class DriversController {
  constructor(private readonly studio: Studio) {}

  /** Every render driver, ready or with what to install. */
  @McpTool({
    name: 'list_drivers',
    description: 'Render drivers, and for each whether it can run here or what it needs installed.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  async list(ctx: RequestContext) {
    ctx.json(await driverReport(this.studio.registry))
  }
}
