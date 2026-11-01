// Draws a stage3d block with Three.js. This file loads on demand, because the
// library is large and most projects never use 3D. Each frame comes from stageAt,
// so any moment can be drawn in any order.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { LATHE_MAX_SAMPLES } from '@/core/project/project'
import type { BlockCtx } from '../blocks'
import { modelMayLoad } from './model-url'
import { CLIPS, makePerson } from './person'
import { stageAt, stageProblems, type ActorState, type Stage3d } from './timeline'

type Actor = Stage3d['actors'][number]
type Built = { root: THREE.Object3D; update?(s: ActorState): void; mixer?: Animator }
type Surface = { color: string; rough: number; metal: number; coat: number; glow: number }

// Browsers allow few WebGL contexts, and a project can have many 3D scenes, so
// they all share one and copy each finished frame into their own canvas.
let shared: THREE.WebGLRenderer | undefined
function renderer() {
  if (!shared) {
    shared = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    shared.shadowMap.enabled = true
    shared.shadowMap.type = THREE.PCFSoftShadowMap
    shared.toneMapping = THREE.ACESFilmicToneMapping
  }
  return shared
}

const standard = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })
const surface = (s: Surface) =>
  new THREE.MeshPhysicalMaterial({
    color: s.color,
    roughness: s.rough,
    metalness: s.metal,
    clearcoat: s.coat,
    clearcoatRoughness: 0.08,
    emissive: s.glow > 0 ? s.color : '#000000',
    emissiveIntensity: s.glow,
  })
function mesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = o.receiveShadow = true
  parent.add(o)
  return o
}
const box = (
  p: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) => mesh(p, new THREE.BoxGeometry(w, h, d), m, x, y, z)

function texture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** A box with rounded corners: car bodies and doors. */
function rounded(w: number, h: number, d: number, r: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d - 0.1,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 3,
    curveSegments: 8,
  })
  g.translate(0, 0, -(d - 0.1) / 2)
  return g
}

function buildCar(color: string): Built {
  const root = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#20323f', roughness: 0.1, clearcoat: 1 })
  mesh(root, rounded(4.4, 0.72, 2, 0.26), paint, 0, 0.72, 0)
  mesh(root, rounded(2.55, 0.68, 1.75, 0.24), glass, -0.25, 1.32, 0)
  mesh(root, rounded(2.62, 0.1, 1.8, 0.04), paint, -0.25, 1.68, 0)
  const lamp = standard('#fff5c8', { emissive: '#ffeaa0', emissiveIntensity: 1 })
  for (const z of [-0.65, 0.65]) box(root, 0.05, 0.16, 0.42, lamp, 2.24, 0.74, z)
  const wheels: THREE.Group[] = []
  for (const x of [-1.35, 1.35]) {
    for (const z of [-1, 1]) {
      const w = new THREE.Group()
      w.position.set(x, 0.38, z)
      root.add(w)
      mesh(w, new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24), standard('#101012')).rotation.x =
        Math.PI / 2
      mesh(
        w,
        new THREE.CylinderGeometry(0.18, 0.18, 0.3, 6),
        standard('#c9ccd2', { metalness: 0.7, roughness: 0.3 }),
      ).rotation.x = Math.PI / 2
      wheels.push(w)
    }
  }
  const door = new THREE.Group()
  door.position.set(0.45, 0.38, 1.02)
  root.add(door)
  mesh(door, rounded(1.45, 0.88, 0.07, 0.08), paint, -0.72, 0.42, 0)
  return {
    root,
    update(s) {
      door.rotation.y = -1.15 * s.open
      for (const w of wheels) w.rotation.z = -s.travelled / 0.38
    },
  }
}

function buildBuilding(a: Extract<Actor, { kind: 'building' }>, font: string): Built {
  // The origin is on the ground at the front door, so it's easy to walk someone there.
  const root = new THREE.Group()
  const walls = standard(a.color)
  const roof = standard(a.roof)
  const white = standard('#f4f1e8')
  box(root, 13, 5, 7, walls, 0, 2.6, -3.5)
  box(root, 14, 0.42, 8, roof, 0, 5.3, -3.5)
  const shape = new THREE.Shape([
    new THREE.Vector2(-7.2, 0),
    new THREE.Vector2(7.2, 0),
    new THREE.Vector2(0, 1.7),
  ])
  mesh(
    root,
    new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false }),
    walls,
    0,
    5.5,
    -0.9,
  )
  for (const x of [-5.4, -3.2, 3.2, 5.4])
    mesh(root, new THREE.CylinderGeometry(0.3, 0.34, 4.7, 24), white, x, 2.65, 0.5)
  for (const [i, z] of [1.75, 1.28, 0.8].entries())
    box(root, 9.2 - i * 0.2, 0.15 * (i + 1), 0.5, white, 0, 0.12 + 0.075 * (i + 1), z)
  if (a.label) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: texture(880, 200, (c) => {
          c.fillStyle = '#5a3a1a'
          c.font = `bold 150px "${font}", serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText(a.label, 440, 108, 840)
        }),
      }),
    )
    sign.position.set(0, 6, 0.32)
    root.add(sign)
  }
  box(root, 2, 3, 0.04, standard('#101116'), 0, 1.75, 0.03)
  box(root, 2.3, 0.14, 0.12, standard('#b68a3c'), 0, 3.3, 0.03)
  const hinge = new THREE.Group()
  hinge.position.set(-1, 0.25, 0.06)
  root.add(hinge)
  box(hinge, 2, 3, 0.09, standard(a.roof), 1, 1.5, 0)
  return { root, update: (s) => void (hinge.rotation.y = -1.8 * s.open) }
}

function buildTree(): Built {
  const root = new THREE.Group()
  mesh(root, new THREE.CylinderGeometry(0.17, 0.22, 1.3, 8), standard('#65432a'), 0, 0.65, 0)
  mesh(
    root,
    new THREE.ConeGeometry(1.25, 2.3, 8),
    standard('#2c7d55', { flatShading: true }),
    0,
    2.3,
    0,
  )
  mesh(
    root,
    new THREE.ConeGeometry(0.95, 1.9, 8),
    standard('#3a9465', { flatShading: true }),
    0,
    3.3,
    0,
  )
  return { root }
}

function buildLamp(): Built {
  const root = new THREE.Group()
  mesh(root, new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), standard('#33363b'), 0, 1.65, 0)
  mesh(
    root,
    new THREE.SphereGeometry(0.18, 12, 10),
    standard('#fff0b0', { emissive: '#ffe08a', emissiveIntensity: 0.6 }),
    0,
    3.3,
    0,
  )
  return { root }
}

function buildRoad(a: Extract<Actor, { kind: 'road' }>): Built {
  const root = new THREE.Group()
  box(root, a.length, 0.04, a.width, standard('#46494f'), 0, 0.01, 0).castShadow = false
  const paint = standard('#f1eccf')
  for (let x = -a.length / 2; x < a.length / 2; x += 4)
    box(root, 1.9, 0.02, 0.16, paint, x, 0.04, 0).castShadow = false
  return { root }
}

function buildLathe(a: Extract<Actor, { kind: 'lathe' }>, font: string, body: string): Built {
  const root = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3(
    a.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'catmullrom',
    0.12,
  )
  const points = curve
    .getPoints(Math.min(a.profile.length * 12, LATHE_MAX_SAMPLES))
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y))
  mesh(root, new THREE.LatheGeometry(points, 128), surface(a))
  const l = a.label
  if (l) {
    // As wide as the shape at the label's height, just proud of the surface.
    const widest = Math.max(
      ...points.filter((p) => Math.abs(p.y - l.y) <= l.height / 2).map((p) => p.x),
      0.1,
    )
    const art = texture(2048, 640, (c) => {
      c.fillStyle = l.paper
      c.fillRect(0, 0, 2048, 640)
      c.strokeStyle = l.ink
      c.fillStyle = l.ink
      c.lineWidth = 8
      c.textAlign = 'center'
      // Printed twice, front and back, so it never turns to a blank side.
      for (const x of [0, 1024]) {
        c.strokeRect(x + 60, 48, 904, 544)
        c.font = `bold 140px "${font}", serif`
        c.fillText(l.text, x + 512, 320, 840)
        if (l.sub) {
          c.font = `46px "${body}", sans-serif`
          c.fillText(l.sub, x + 512, 416, 840)
        }
      }
    })
    const r = widest + 0.012
    const band = mesh(
      root,
      new THREE.CylinderGeometry(r, r, l.height, 128, 1, true),
      standard('#ffffff', { map: art, roughness: 0.6 }),
      0,
      l.y,
      0,
    )
    // So that the printed front faces forward at rotate 0.
    band.rotation.y = -Math.PI / 2
    band.castShadow = false
  }
  return { root }
}

/** Plays clips from time alone, blending between two of them. */
class Animator {
  private mixer: THREE.AnimationMixer
  private actions = new Map<string, THREE.AnimationAction>()
  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root)
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip)
      action.play()
      this.actions.set(clip.name, action)
    }
  }
  has = (name: string) => this.actions.has(name)
  names = () => [...this.actions.keys()]
  pose(clip: ActorState['clip']) {
    for (const [name, action] of this.actions) {
      const now = clip?.name === name
      const before = clip?.from?.name === name && clip.blend < 1
      action.enabled = now || before
      const duration = action.getClip().duration
      const time = now ? clip!.time : before ? clip!.from!.time : 0
      action.time = ((time % duration) + duration) % duration
      action.setEffectiveWeight(
        now ? (clip!.from?.name === name ? 1 : clip!.blend) : before ? 1 - clip!.blend : 0,
      )
    }
    this.mixer.update(0)
  }
}

function buildPerson(a: Extract<Actor, { kind: 'person' }>): Built {
  const root = makePerson(a)
  return { root, mixer: new Animator(root, CLIPS) }
}

async function buildModel(a: Extract<Actor, { kind: 'model' }>, ctx: BlockCtx): Promise<Built> {
  const manager = new THREE.LoadingManager()
  const own = ctx.fileUrl(a.path)
  manager.setURLModifier((url) => {
    if (!modelMayLoad(url, own, location.href)) throw new Error('points outside the file')
    return url
  })
  const gltf = await new GLTFLoader(manager).loadAsync(own).catch(() => {
    throw new Error(`can't load ${a.path}: it's missing, damaged, or uses files outside itself`)
  })
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  return {
    root: gltf.scene,
    ...(gltf.animations.length ? { mixer: new Animator(gltf.scene, gltf.animations) } : {}),
  }
}

function buildActor(a: Actor, ctx: BlockCtx): Built | Promise<Built> {
  const { display, body } = ctx.theme.fonts
  const root = new THREE.Group()
  switch (a.kind) {
    case 'box':
      mesh(root, new THREE.BoxGeometry(...a.size), surface(a))
      return { root }
    case 'cylinder':
      mesh(root, new THREE.CylinderGeometry(a.radius, a.radius, a.height, 48), surface(a))
      return { root }
    case 'cone':
      mesh(root, new THREE.ConeGeometry(a.radius, a.height, 32), surface(a))
      return { root }
    case 'sphere':
      mesh(root, new THREE.SphereGeometry(a.radius, 32, 24), surface(a))
      return { root }
    case 'disc': {
      const d = mesh(root, new THREE.CircleGeometry(a.radius, 64), surface(a))
      d.rotation.x = -Math.PI / 2
      d.castShadow = false
      return { root }
    }
    case 'lathe':
      return buildLathe(a, display, body)
    case 'road':
      return buildRoad(a)
    case 'building':
      return buildBuilding(a, display)
    case 'car':
      return buildCar(a.color)
    case 'person':
      return buildPerson(a)
    case 'tree':
      return buildTree()
    case 'lamp':
      return buildLamp()
    case 'model':
      return buildModel(a, ctx)
  }
}

function lightWorld(
  scene: THREE.Scene,
  world: Stage3d['world'],
  target: THREE.Vector3,
  gl: THREE.WebGLRenderer,
) {
  const sun = new THREE.DirectionalLight('#fff1dd', 3.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 5
  sun.shadow.bias = -0.0005
  const reach = world.shadowReach
  Object.assign(sun.shadow.camera, {
    left: -reach,
    right: reach,
    top: reach,
    bottom: -reach,
    far: reach * 5,
  })
  sun.position.copy(target).add(new THREE.Vector3(-0.55, 1, 0.55).multiplyScalar(reach))
  sun.target.position.copy(target)
  scene.add(sun, sun.target)
  if (world.light === 'day') scene.add(new THREE.HemisphereLight('#dcecff', '#7f9c65', 1.5))
  if (world.light === 'night') {
    scene.add(new THREE.HemisphereLight('#c6c0ff', '#4a3a68', 2.4))
    sun.intensity = 3.4
  }
  if (world.light === 'studio') {
    const pmrem = new THREE.PMREMGenerator(gl)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    pmrem.dispose()
    sun.intensity = 1.5
  }
  const [top, bottom] = world.gradient ?? []
  scene.background =
    top && bottom
      ? texture(16, 512, (c) => {
          const g = c.createLinearGradient(0, 0, 0, 512)
          g.addColorStop(0, top)
          g.addColorStop(1, bottom)
          c.fillStyle = g
          c.fillRect(0, 0, 16, 512)
        })
      : new THREE.Color(world.background)
  if (world.floor) {
    const f = mesh(scene, new THREE.CircleGeometry(200, 64), standard(world.floor), 0, -0.02, 0)
    f.rotation.x = -Math.PI / 2
    f.castShadow = false
  }
}

/** Builds the scene, and returns what draws it at a time in seconds. */
export async function mountStage(canvas: HTMLCanvasElement, b: Stage3d, ctx: BlockCtx) {
  const problems = stageProblems(b)
  if (problems.length) throw new Error(`3D scene: ${problems.join('; ')}`)
  const { display, body } = ctx.theme.fonts
  await Promise.all([
    document.fonts?.load(`bold 150px "${display}"`),
    document.fonts?.load(`46px "${body}"`),
  ])

  const gl = renderer()
  const scene = new THREE.Scene()
  lightWorld(scene, b.world, new THREE.Vector3(...b.camera.target), gl)
  const built = await Promise.all(
    b.actors.map(async (a) => {
      const piece = await buildActor(a, ctx)
      scene.add(piece.root)
      return { actor: a, ...piece }
    }),
  )
  for (const { actor, mixer } of built) {
    if (!mixer) continue
    for (const action of b.timeline) {
      if (action.actor === actor.id && action.clip && !mixer.has(action.clip)) {
        throw new Error(
          `3D scene: "${actor.id}" has no clip "${action.clip}"; it has ${mixer.names().join(', ')}`,
        )
      }
    }
  }
  const aspect = ctx.width / ctx.height
  const camera: THREE.OrthographicCamera | THREE.PerspectiveCamera =
    b.camera.view === 'isometric' ? new THREE.OrthographicCamera() : new THREE.PerspectiveCamera()
  camera.near = 0.1
  camera.far = 400
  const copy = canvas.getContext('2d')!

  ctx.onDestroy(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      for (const material of [m.material].flat()) {
        ;(material as THREE.MeshStandardMaterial | undefined)?.map?.dispose()
        ;(material as THREE.Material | undefined)?.dispose()
      }
      ;(o as THREE.DirectionalLight).shadow?.dispose()
    })
    scene.environment?.dispose()
    if (scene.background instanceof THREE.Texture) scene.background.dispose()
  })

  return (seconds: number) => {
    const state = stageAt(b, seconds)
    for (const { actor, root, update, mixer } of built) {
      const s = state.actors.get(actor.id)!
      root.position.set(...s.position)
      root.rotation.y = s.rotate
      root.scale.setScalar(s.scale)
      root.visible = s.visible
      update?.(s)
      mixer?.pose(s.clip)
    }
    // `size` and `fov` describe the 16:9 picture. Other shapes keep the same width,
    // so nothing is cut off the sides of a tall frame.
    const wide = 16 / 9
    const zoom = ctx.format === '9:16' ? b.camera.tallZoom : 1
    if (camera instanceof THREE.OrthographicCamera) {
      const halfWidth = (state.camera.size * wide) / 2 / zoom
      camera.left = -halfWidth
      camera.right = halfWidth
      camera.top = halfWidth / aspect
      camera.bottom = -halfWidth / aspect
    } else {
      const across = (Math.tan(THREE.MathUtils.degToRad(state.camera.fov) / 2) * wide) / zoom
      camera.aspect = aspect
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(across / aspect))
    }
    camera.position.set(...state.camera.position)
    camera.lookAt(...state.camera.target)
    camera.updateProjectionMatrix()
    gl.setSize(ctx.width, ctx.height, false)
    gl.toneMappingExposure = b.world.exposure
    gl.render(scene, camera)
    copy.drawImage(gl.domElement, 0, 0)
  }
}
