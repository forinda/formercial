import { Controller, Get, type RequestContext } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { ProjectSchema } from '@/core/project'

@Controller()
export class SchemaController {
  @McpTool({
    name: 'project_schema',
    description:
      'The JSON Schema of project.json. Read it before writing a project with update_project.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  schema(ctx: RequestContext) {
    ctx.json(z.toJSONSchema(ProjectSchema, { io: 'input', unrepresentable: 'any' }))
  }
}
