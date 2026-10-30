import type { Project } from './project'
import type { Timeline } from './timeline'

const stamp = (s: number) => {
  const ms = Math.round(s * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

/** One cue per scene with a caption: on while its voice plays, or for the whole scene without one. */
export function toSrt(project: Project, timeline: Timeline): string {
  const captions = new Map(project.scenes.map((s) => [s.id, s.caption]))
  return timeline.scenes
    .filter((s) => captions.get(s.id)?.trim())
    .map((s, i) => {
      const end = s.start + (s.clip ? s.clip.seconds : s.length)
      return `${i + 1}\n${stamp(s.start)} --> ${stamp(end)}\n${captions.get(s.id)}\n`
    })
    .join('\n')
}
