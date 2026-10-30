import type { Format, Project } from '@/core/project'
import type { Timeline } from '@/core/timeline'
import type { Check } from '@/core/voice/provider'

export interface RenderJob {
  slug: string
  format: Format
  fps: number
  /** Render only the first N seconds. */
  seconds?: number
  timeline: Timeline
  /** The render page for this project and format (it implements window.formercial). */
  renderUrl: string
  /** Music file, relative to the work folder. */
  music?: { path: string; volume: number; duck: number }
  project: Project
}

export interface RenderProgress {
  phase: 'frames' | 'audio' | 'done'
  frame?: number
  frames?: number
}

/**
 * How a render runs. `dir` is a work folder holding the job's clips and music
 * at their project paths; the driver writes its MP4 and SRT there and returns
 * their paths relative to it.
 */
export interface RenderDriver {
  name: string
  check(): Promise<Check>
  render(
    job: RenderJob,
    dir: string,
    progress: (p: RenderProgress) => void,
  ): Promise<{ mp4: string; srt: string }>
}
