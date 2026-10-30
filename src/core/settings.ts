// Formercial's own configuration, validated once for the app and the CLI alike.
// `kick env example` writes these variables and descriptions into .env.example.
import { defineSettings } from '@forinda/kickjs'
import { z } from 'zod'

const fps = z.coerce.number().int().min(1).max(60)

export const FormercialSettings = defineSettings(
  'FORMERCIAL',
  z
    .object({
      projects: z.string().min(1).default('projects').describe('Folder holding the projects'),
      trustFile: z
        .string()
        .optional()
        .describe(
          'Where trust for custom scenes is kept, outside the projects folder; default ~/.config/formercial/trust.json',
        ),
      voice: z.string().min(1).default('en-US-AvaNeural').describe('Voice for new projects'),
      fps: fps.default(30).describe('Render frame rate unless a render asks for another, 1 to 60'),
      driver: z
        .string()
        .min(1)
        .default('chromium-ffmpeg')
        .describe('Render driver unless a render asks for another'),
      // vite.config.ts reads this one itself: it loads before the app does.
      render: z
        .stringbool()
        .default(false)
        .describe('Set by kick formercial render on its own server: no hot reload'),
    })
    .describe('Where projects live, and defaults for new projects and renders'),
)

/** A frame rate from a request or a flag. */
export function checkFps(value: unknown): number {
  const parsed = fps.safeParse(value)
  if (!parsed.success) throw new Error('fps is a whole number from 1 to 60')
  return parsed.data
}
