// When each scene starts and how long it lasts. Every render driver gets this
// resolved timeline, so they all cut the same way.
import type { Project, Scene } from './project'

export type Clip = { path: string; seconds: number }
export type TimelineScene = { id: string; start: number; length: number; clip?: Clip }
export type Timeline = { scenes: TimelineScene[]; total: number }

/** Picture kept after a scene's voice ends. */
export const VOICE_TAIL = 1.3

// Tenths of a second, as integers, so starts don't drift over many scenes.
const tenths = (seconds: number) => Math.ceil(Math.round(seconds * 1000) / 100)

export function resolveTimeline(
  project: Project,
  clips: Record<string, Clip | undefined>,
  needs: (s: Scene) => number,
): Timeline {
  let at = 0
  const scenes = project.scenes.map((scene) => {
    const clip = clips[scene.id]
    const length = tenths(
      Math.max(scene.minSeconds, needs(scene), clip ? clip.seconds + VOICE_TAIL : 0),
    )
    const entry: TimelineScene = { id: scene.id, start: at / 10, length: length / 10 }
    if (clip) entry.clip = clip
    at += length
    return entry
  })
  return { scenes, total: at / 10 }
}
