// One render of one format, used by the app's queue and by `kick formercial render`:
// voice (when a provider is given), resolve the timeline, copy the clips and
// music into a work folder, run the driver, and keep its MP4 and SRT.
import { sceneNeeds } from '@/player/player'
import type { Format } from '@/core/project'
import { resolveTimeline } from '@/core/timeline'
import type { VoiceProvider } from '@/core/voice/provider'
import { clipLengths, voiceProject } from '@/core/voice/voice-project'
import { withWorkdir } from '@/core/workdir'
import type { Workspace } from '@/core/workspace'
import type { RenderDriver, RenderProgress } from './driver'

/** Formats appear in URLs and file names as 16x9, 9x16, 1x1. */
export const formatToken = (format: Format) => format.replace(':', 'x')

export async function renderProject(opts: {
  ws: Workspace
  slug: string
  format: Format
  driver: RenderDriver
  fps?: number
  seconds?: number
  /** The app's origin, e.g. http://127.0.0.1:3000 — the render page lives under it. */
  origin: string
  voice?: VoiceProvider
  onProgress?: (p: RenderProgress) => void
}): Promise<{ mp4: string; srt: string }> {
  const { ws, slug, format } = opts
  if (opts.voice) await voiceProject(ws, slug, opts.voice)
  const { project } = await ws.read(slug)
  const clips = await clipLengths(ws, slug, project)
  const timeline = resolveTimeline(project, clips, sceneNeeds)
  const inputs = timeline.scenes.flatMap((s) => (s.clip ? [s.clip.path] : []))
  if (project.music) inputs.push(project.music.file)
  return withWorkdir(ws, slug, inputs, async (dir) => {
    const out = await opts.driver.render(
      {
        slug,
        format,
        fps: opts.fps ?? 30,
        seconds: opts.seconds,
        timeline,
        renderUrl: `${opts.origin}/p/${slug}/render/${formatToken(format)}`,
        music: project.music && {
          path: project.music.file,
          volume: project.music.volume,
          duck: project.music.duck,
        },
        project,
      },
      dir,
      opts.onProgress ?? (() => {}),
    )
    return { result: out, outputs: [out.mp4, out.srt] }
  })
}
