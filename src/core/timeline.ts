// When each scene starts and how long it lasts. Every render driver gets this
// resolved timeline, so they all cut the same way.
import type { Project, Scene } from './project'

export type Clip = { path: string; seconds: number }
export type TimelineScene = { id: string; start: number; length: number; clip?: Clip }
export type Timeline = { scenes: TimelineScene[]; total: number }

// Tenths of a second, as integers, so starts don't drift over many scenes.
const tenths = (seconds: number) => Math.ceil(Math.round(seconds * 1000) / 100)

export function resolveTimeline(
  project: Project,
  clips: Record<string, Clip | undefined>,
  /** How long a scene's blocks take to appear, plus `read` seconds to read them. */
  needs: (s: Scene, read?: number) => number,
): Timeline {
  let at = 0
  const scenes = project.scenes.map((scene) => {
    const clip = clips[scene.id]
    const pause = project.pauseSeconds
    // A voiced scene has been explained already: a short pause shortens its reading time too.
    const length = tenths(
      Math.max(
        scene.minSeconds,
        needs(scene, clip ? Math.min(1, pause) : 1),
        clip ? clip.seconds + pause : 0,
      ),
    )
    const entry: TimelineScene = { id: scene.id, start: at / 10, length: length / 10 }
    if (clip) entry.clip = clip
    at += length
    return entry
  })
  return { scenes, total: at / 10 }
}
