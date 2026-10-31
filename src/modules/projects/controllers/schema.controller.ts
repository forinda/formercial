import { Controller, Get } from '@forinda/kickjs'
import { McpTool } from '@forinda/kickjs-mcp'
import { z } from 'zod'
import { ProjectSchema } from '@/core/project/project'

@Controller()
export class SchemaController {
  @McpTool({
    name: 'project_schema',
    description:
      'The JSON Schema of project.json. Read it before writing a project with update_project.',
    annotations: { readOnlyHint: true },
  })
  @Get('/')
  schema() {
    return z.toJSONSchema(ProjectSchema, { io: 'input', unrepresentable: 'any' })
  }
}
