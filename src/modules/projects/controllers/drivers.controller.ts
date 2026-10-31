import { Controller, Get } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { driverReport } from '@/core/render/registry'
import { FormercialSettings } from '@/core/settings'
import { Studio } from '../services/studio.service'

@Controller()
export class DriversController {
  constructor(private readonly studio: Studio) {}

  /** Every render driver, ready or with what to install; the default one first. */
  @McpTool({
    name: 'list_drivers',
    description: 'Render drivers, and for each whether it can run here or what it needs installed.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  async list() {
    const { driver } = FormercialSettings.get()
    const report = await driverReport(this.studio.registry)
    return report.sort((a, b) => Number(b.name === driver) - Number(a.name === driver))
  }
}
