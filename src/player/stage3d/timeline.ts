// What a 3D scene looks like at any moment, worked out from time alone. Nothing
// here depends on what was drawn before, so frames can be drawn in any order.
import type { Block } from '@/core/project/project'

export type Stage3d = Extract<Block, { type: 'stage3d' }>
type Vec3 = [number, number, number]
type Action = Stage3d['timeline'][number]

export interface ClipState {
  name: string
  time: number
  /** The clip being blended out of, and how far along: 1 is fully the new clip. */
  from?: { name: string; time: number }
  blend: number
}
export interface ActorState {
  position: Vec3
  /** Radians. */
  rotate: number
  scale: number
  visible: boolean
  open: number
  /** How far it has moved in total, which turns a car's wheels. */
  travelled: number
  clip?: ClipState
}
export interface CameraState {
  position: Vec3
  target: Vec3
  size: number
  fov: number
}
export interface StageState {
  actors: Map<string, ActorState>
  camera: CameraState
}

const CLIP_BLEND = 0.25
const TURN_SECONDS = 0.3
/** World units a person of scale 1 covers per second at normal walk speed. */
export const WALK_STRIDE = 1.72
const TAU = Math.PI * 2

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const EASES: Record<Action['ease'], (x: number) => number> = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - (1 - x) ** 3,
  inout: (x) => x * x * (3 - 2 * x),
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
]
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** The short way round from one angle to another. */
const turn = (a: number, b: number, k: number) => {
  const d = ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI
  return a + d * k
}
const ordered = (timeline: Action[]) =>
  timeline
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.at - y.a.at || x.i - y.i)
    .map((x) => x.a)

/** Seconds until the last thing in the timeline has finished. */
export function stage3dLength(b: Pick<Stage3d, 'timeline'>): number {
  return Math.max(0, ...b.timeline.map((a) => a.at + a.seconds))
}

/** A wrong name in a timeline does nothing silently otherwise, so say which one. */
export function stageProblems(b: Pick<Stage3d, 'actors' | 'timeline'>): string[] {
  const ids = new Set<string>()
  const problems: string[] = []
  for (const actor of b.actors) {
    if (ids.has(actor.id)) problems.push(`two actors are called "${actor.id}"`)
    ids.add(actor.id)
  }
  for (const a of b.timeline) {
    if (a.actor !== 'camera' && !ids.has(a.actor)) problems.push(`no actor called "${a.actor}"`)
  }
  return problems
}

export function stageAt(b: Pick<Stage3d, 'actors' | 'timeline' | 'camera'>, t: number): StageState {
  const actions = ordered(b.timeline)
  const actors = new Map<string, ActorState>()
  for (const actor of b.actors) {
    const person = actor.kind === 'person'
    const mine = actions.filter((a) => a.actor === actor.id)
    const s: ActorState = {
      position: [...actor.position],
      rotate: (actor.rotate * Math.PI) / 180,
      scale: actor.scale,
      visible: !actor.hidden,
      open: 0,
      travelled: 0,
    }
    let idle = person ? 'stand' : undefined
    let clip: { name: string; start: number; speed: number; until: number } | undefined = idle
      ? { name: idle, start: 0, speed: 1, until: Infinity }
      : undefined
    let last: { name: string; time: number } | undefined
    let since = -Infinity
    const change = (next: typeof clip, when: number) => {
      last = clip ? { name: clip.name, time: (when - clip.start) * clip.speed } : undefined
      clip = next
      since = when
    }
    for (const a of mine) {
      if (t < a.at) break
      // A clip that has run its time goes back to standing before the next one starts.
      if (clip && clip.until <= a.at) {
        change(
          idle ? { name: idle, start: clip.until, speed: 1, until: Infinity } : undefined,
          clip.until,
        )
      }
      const k = a.seconds > 0 ? EASES[a.ease](clamp((t - a.at) / a.seconds)) : 1
      if (a.move) {
        const from = s.position
        const moved = distance(from, a.move)
        const faces = a.face ?? person
        if (faces && Math.hypot(a.move[0] - from[0], a.move[2] - from[2]) > 1e-6) {
          const heading = Math.atan2(a.move[0] - from[0], a.move[2] - from[2])
          s.rotate = turn(s.rotate, heading, clamp((t - a.at) / TURN_SECONDS))
        }
        s.travelled += moved * k
        s.position = lerp3(from, a.move, k)
      }
      if (a.rotate !== undefined) s.rotate = turn(s.rotate, (a.rotate * Math.PI) / 180, k)
      if (a.scale !== undefined) s.scale = lerp(s.scale, a.scale, k)
      if (a.open !== undefined) s.open = lerp(s.open, a.open, k)
      if (a.show !== undefined) s.visible = a.show
      const walks = person && a.move && !a.clip && a.seconds > 0
      if (a.clip || walks) {
        const name = a.clip ?? 'walk'
        const speed =
          a.speed ?? (name === 'walk' && a.move && a.seconds > 0 ? walkSpeed(mine, a, actor) : 1)
        change(
          { name, start: a.at, speed, until: a.seconds > 0 ? a.at + a.seconds : Infinity },
          a.at,
        )
        if (a.seconds === 0 && person) idle = name
      }
    }
    if (clip && clip.until <= t) {
      change(
        idle ? { name: idle, start: clip.until, speed: 1, until: Infinity } : undefined,
        clip.until,
      )
    }
    if (clip) {
      s.clip = {
        name: clip.name,
        time: (t - clip.start) * clip.speed,
        ...(last ? { from: { name: last.name, time: last.time + (t - since) } } : {}),
        blend: clamp((t - since) / CLIP_BLEND),
      }
    }
    actors.set(actor.id, s)
  }
  const camera: CameraState = {
    position: [...b.camera.position],
    target: [...b.camera.target],
    size: b.camera.size,
    fov: b.camera.fov,
  }
  for (const a of actions) {
    if (a.actor !== 'camera' || t < a.at) continue
    const k = a.seconds > 0 ? EASES[a.ease](clamp((t - a.at) / a.seconds)) : 1
    if (a.move) camera.position = lerp3(camera.position, a.move, k)
    if (a.target) camera.target = lerp3(camera.target, a.target, k)
    if (a.size !== undefined) camera.size = lerp(camera.size, a.size, k)
    if (a.fov !== undefined) camera.fov = lerp(camera.fov, a.fov, k)
  }
  return { actors, camera }
}

/** How fast a walk plays so the feet keep pace with the ground. */
function walkSpeed(mine: Action[], a: Action, actor: Stage3d['actors'][number]): number {
  let from: Vec3 = [...actor.position]
  let scale = actor.scale
  for (const earlier of mine) {
    if (earlier === a) break
    if (earlier.move) from = earlier.move
    if (earlier.scale !== undefined) scale = earlier.scale
  }
  return distance(from, a.move!) / a.seconds / (WALK_STRIDE * scale)
}
