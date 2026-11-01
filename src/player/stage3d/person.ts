// A person made in code: real bones, with clips written as joint angles.
import * as THREE from 'three'

const TAU = Math.PI * 2

export function makePerson(c: { shirt: string; trousers: string; skin: string; hair: string }) {
  const root = new THREE.Group()
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const b = new THREE.Bone()
    b.name = name
    b.position.set(x, y, z)
    parent.add(b)
    return b
  }
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  const add = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new THREE.Mesh(geo, m)
    o.position.set(x, y, z)
    o.castShadow = o.receiveShadow = true
    parent.add(o)
    return o
  }
  const hips = bone('hips', root, 0, 0.95, 0)
  const spine = bone('spine', hips, 0, 0.1, 0)
  const head = bone('head', spine, 0, 0.62, 0)
  const armL = bone('armL', spine, 0.3, 0.5, 0)
  const armR = bone('armR', spine, -0.3, 0.5, 0)
  const foreL = bone('foreL', armL, 0, -0.33, 0)
  const foreR = bone('foreR', armR, 0, -0.33, 0)
  const legL = bone('legL', hips, 0.13, -0.03, 0)
  const legR = bone('legR', hips, -0.13, -0.03, 0)
  const shinL = bone('shinL', legL, 0, -0.45, 0)
  const shinR = bone('shinR', legR, 0, -0.45, 0)
  const shirt = mat(c.shirt)
  const trousers = mat(c.trousers)
  const skin = mat(c.skin)
  const limb = (b: THREE.Object3D, length: number, r: number, m: THREE.Material) =>
    add(b, new THREE.CapsuleGeometry(r, length - r * 1.4, 5, 12), m, 0, -length / 2, 0)
  add(spine, new THREE.CapsuleGeometry(0.22, 0.34, 6, 16), shirt, 0, 0.26, 0)
  add(hips, new THREE.SphereGeometry(0.22, 16, 12), trousers, 0, 0.02, 0)
  add(head, new THREE.SphereGeometry(0.19, 20, 16), skin, 0, 0.1, 0)
  add(
    head,
    new THREE.SphereGeometry(0.2, 20, 12, 0, TAU, 0, 1.5),
    mat(c.hair),
    0,
    0.13,
    -0.01,
  ).scale.y = 0.9
  const eye = mat('#0a0a0a')
  for (const x of [-0.07, 0.07])
    add(head, new THREE.SphereGeometry(0.022, 8, 8), eye, x, 0.12, 0.175)
  limb(armL, 0.33, 0.07, shirt)
  limb(armR, 0.33, 0.07, shirt)
  limb(foreL, 0.31, 0.058, skin)
  limb(foreR, 0.31, 0.058, skin)
  limb(legL, 0.45, 0.092, trousers)
  limb(legR, 0.45, 0.092, trousers)
  limb(shinL, 0.44, 0.075, trousers)
  limb(shinR, 0.44, 0.075, trousers)
  const shoe = mat('#24242a')
  for (const s of [shinL, shinR])
    add(s, new THREE.BoxGeometry(0.15, 0.09, 0.32), shoe, 0, -0.47, 0.07)
  return root
}

const BONES = [
  'hips',
  'spine',
  'head',
  'armL',
  'armR',
  'foreL',
  'foreR',
  'legL',
  'legR',
  'shinL',
  'shinR',
]
type Angles = [number, number, number]
type Pose = Partial<Record<(typeof BONES)[number], Angles>> & { hipPos?: Angles }

/** A clip sampled from a pose function of the angle through its cycle. */
function clipFrom(name: string, seconds: number, pose: (a: number) => Pose, steps = 48) {
  const times = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * seconds)
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const at = (time: number) => pose((time / seconds) * TAU)
  const tracks: THREE.KeyframeTrack[] = BONES.map((bone) => {
    const values: number[] = []
    for (const time of times) {
      const r = at(time)[bone] ?? [0, 0, 0]
      q.setFromEuler(e.set(r[0], r[1], r[2]))
      values.push(q.x, q.y, q.z, q.w)
    }
    return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values)
  })
  tracks.push(
    new THREE.VectorKeyframeTrack(
      'hips.position',
      times,
      times.flatMap((time) => at(time).hipPos ?? [0, 0.95, 0]),
    ),
  )
  return new THREE.AnimationClip(name, seconds, tracks)
}

const up = (x: number) => Math.max(0, x)

export const CLIPS = [
  // One cycle a second. WALK_STRIDE in timeline.ts is how far this gait covers in it.
  clipFrom('walk', 1, (a) => {
    const s = Math.sin(a)
    return {
      hipPos: [0, 0.95 - 0.02 * Math.cos(2 * a), 0],
      spine: [0.04, 0.09 * s, 0],
      armL: [0.55 * s, 0, 0.08],
      armR: [-0.55 * s, 0, -0.08],
      foreL: [-0.35 - 0.25 * up(s), 0, 0],
      foreR: [-0.35 - 0.25 * up(-s), 0, 0],
      legL: [-0.5 * s, 0, 0],
      legR: [0.5 * s, 0, 0],
      shinL: [0.75 * up(Math.sin(a + 1.2)), 0, 0],
      shinR: [0.75 * up(Math.sin(a + 1.2 + Math.PI)), 0, 0],
    }
  }),
  clipFrom('stand', 2, (a) => ({
    hipPos: [0, 0.95 + 0.006 * Math.sin(a), 0],
    armL: [0.03, 0, 0.1],
    armR: [0.03, 0, -0.1],
    foreL: [-0.15, 0, 0],
    foreR: [-0.15, 0, 0],
  })),
  // A two-second step-touch with arm swings.
  clipFrom('dance', 2, (a) => {
    const s = Math.sin(a)
    const c = Math.cos(a)
    return {
      hipPos: [0.2 * s, 0.9 - 0.07 * (1 - Math.abs(s)), 0],
      hips: [0, 0.32 * s, -0.08 * s],
      spine: [0.03, 0.2 * c, 0.1 * s],
      head: [0, -0.2 * c, -0.08 * s],
      armL: [0.5 * s - 0.25, 0, 1.0 + 0.55 * c],
      armR: [-0.5 * s - 0.25, 0, -1.0 + 0.55 * c],
      foreL: [-0.95 - 0.35 * c, 0, 0],
      foreR: [-0.95 + 0.35 * c, 0, 0],
      legL: [-0.5 * up(-s), 0, 0.1 + 0.2 * up(s)],
      legR: [-0.5 * up(s), 0, -0.1 - 0.2 * up(-s)],
      shinL: [0.85 * up(-s), 0, 0],
      shinR: [0.85 * up(s), 0, 0],
    }
  }),
]
