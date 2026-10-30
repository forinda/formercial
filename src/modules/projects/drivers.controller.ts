import { Controller, Get, type RequestContext } from '@forinda/kickjs'
import { driverReport } from '../../core/render/registry'
import { Studio } from './studio.service'

@Controller()
export class DriversController {
  constructor(private readonly studio: Studio) {}

  /** Every render driver, ready or with what to install. */
  @Get('/')
  async list(ctx: RequestContext) {
    ctx.json(await driverReport(this.studio.registry))
  }
}
