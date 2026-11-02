import type { Project } from '@/core/project/project'
import type { Timeline } from '@/core/project/timeline'
import { captionChunks } from './caption-chunks'

const stamp = (s: number) => {
  const ms = Math.round(s * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

/** Short cues for each scene with a caption: on while its voice plays, or for the whole scene without one. */
export function toSrt(project: Project, timeline: Timeline): string {
  const captions = new Map(project.scenes.map((s) => [s.id, s.caption]))
  return timeline.scenes
    .filter((s) => captions.get(s.id)?.trim())
    .flatMap((s) =>
      captionChunks(
        captions.get(s.id)!,
        s.clip ? s.clip.seconds : s.length,
        undefined,
        s.clip?.words,
      ).map((c) => ({
        text: c.text,
        start: s.start + c.start,
        end: s.start + c.end,
      })),
    )
    .map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`)
    .join('\n')
}
