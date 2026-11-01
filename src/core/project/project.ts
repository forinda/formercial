// project.json: what a commercial is. The app, the CLI and hand edits all go
// through parseProject, so a file that loads anywhere loads everywhere.
import { z } from 'zod'

export const FORMATS = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
} as const
export type Format = keyof typeof FORMATS

export const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/

/** A project folder name from a display name: "@forinda/kickjs-db" → "forinda-kickjs-db". */
export const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'project'

const format = z.enum(['16:9', '9:16', '1:1'])
// Seconds into the scene when a block appears.
const at = z.number().min(0).optional()

const tone = z.enum(['fg', 'muted', 'accent', 'good', 'bad'])
// One thing a doodle draws: a line along an SVG path, or a handwritten label.
// Each starts when the last one ends, unless it says when with `at`.
const DoodleItemSchema = z.union([
  z.strictObject({
    d: z.string().min(1),
    tone: tone.default('fg'),
    width: z.number().min(0).default(6),
    at,
    seconds: z.number().min(0).default(0.8),
    /** A color that fades in inside the shape while it's drawn. */
    fill: tone.optional(),
    fillOpacity: z.number().min(0).max(1).default(1),
    /** Dots moving along the path, in viewBox units a second; negative runs backwards. */
    flow: z
      .strictObject({
        count: z.number().int().min(1).max(100),
        speed: z.number(),
        tone: tone.default('accent'),
        size: z.number().positive().default(11),
        at,
      })
      .optional(),
  }),
  z.strictObject({
    text: z.string().min(1),
    x: z.number(),
    y: z.number(),
    size: z.number().positive().default(56),
    tone: tone.default('fg'),
    at,
    seconds: z.number().min(0).default(0.8),
  }),
])

const viewBox = z.string().regex(/^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/, {
  error: 'four numbers, like "0 0 1600 720"',
})

/** Also what the editor checks typed strokes against, so they get the same defaults. */
export const DoodleStrokesSchema = z.array(DoodleItemSchema)
export const DoodleTallSchema = z.strictObject({
  viewBox: viewBox.default('0 0 900 1400'),
  strokes: DoodleStrokesSchema,
})

// A 3D scene as plain data: things to place, and a timeline of what they do.
const vec3 = z.tuple([z.number(), z.number(), z.number()])
const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/)
const actorBase = {
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/),
  position: vec3.default([0, 0, 0]),
  /** Degrees around the vertical axis. */
  rotate: z.number().default(0),
  scale: z.number().positive().default(1),
  hidden: z.boolean().default(false),
}
const surface = {
  color: hex.default('#c8c8c8'),
  rough: z.number().min(0).max(1).default(0.75),
  metal: z.number().min(0).max(1).default(0),
  /** A glossy top coat, for paint and glass. */
  coat: z.number().min(0).max(1).default(0),
  /** How strongly it lights itself. */
  glow: z.number().min(0).default(0),
}
const positive = z.number().positive()
const ActorSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...actorBase,
    ...surface,
    kind: z.literal('box'),
    size: z.tuple([positive, positive, positive]),
  }),
  z.strictObject({
    ...actorBase,
    ...surface,
    kind: z.literal('cylinder'),
    radius: positive,
    height: positive,
  }),
  z.strictObject({
    ...actorBase,
    ...surface,
    kind: z.literal('cone'),
    radius: positive,
    height: positive,
  }),
  z.strictObject({ ...actorBase, ...surface, kind: z.literal('sphere'), radius: positive }),
  z.strictObject({ ...actorBase, ...surface, kind: z.literal('disc'), radius: positive }),
  z.strictObject({
    ...actorBase,
    ...surface,
    kind: z.literal('lathe'),
    /** [radius, height] points, spun around the vertical axis: bottles, cans, vases. */
    profile: z
      .array(z.tuple([z.number().min(0), z.number()]))
      .min(2)
      .max(200),
    /** A printed label that wraps around it. */
    label: z
      .strictObject({
        text: z.string().min(1),
        sub: z.string().optional(),
        y: z.number(),
        height: positive,
        paper: hex.default('#f5ecd9'),
        ink: hex.default('#4b2412'),
      })
      .optional(),
  }),
  z.strictObject({
    ...actorBase,
    kind: z.literal('road'),
    length: positive.max(1000).default(90),
    width: positive.max(1000).default(6),
  }),
  z.strictObject({
    ...actorBase,
    kind: z.literal('building'),
    label: z.string().default(''),
    color: hex.default('#e8e0cc'),
    roof: hex.default('#8c5a2e'),
  }),
  z.strictObject({ ...actorBase, kind: z.literal('car'), color: hex.default('#c8211f') }),
  z.strictObject({
    ...actorBase,
    kind: z.literal('person'),
    shirt: hex.default('#2c6fb0'),
    trousers: hex.default('#20242e'),
    skin: hex.default('#8d5a3b'),
    hair: hex.default('#1c1412'),
  }),
  z.strictObject({ ...actorBase, kind: z.literal('tree') }),
  z.strictObject({ ...actorBase, kind: z.literal('lamp') }),
  z.strictObject({
    ...actorBase,
    kind: z.literal('model'),
    /** A self-contained .glb file in the project, with any animation clips it holds. */
    path: z
      .string()
      .regex(/^media\/[\w./-]+\.glb$/)
      .refine((p) => !p.includes('..'), 'a model path stays inside media/'),
  }),
])
const Stage3dActionSchema = z.strictObject({
  /** Seconds into the block. */
  at: z.number().min(0),
  /** An actor's id, or "camera". */
  actor: z.string().min(1),
  seconds: z.number().min(0).default(0),
  ease: z.enum(['linear', 'in', 'out', 'inout']).default('inout'),
  /** Go here over `seconds`. A person walks there, facing the way they go. */
  move: vec3.optional(),
  /** Turn to this many degrees. */
  rotate: z.number().optional(),
  scale: positive.optional(),
  /** Open a building's or car's door: 0 shut, 1 open. */
  open: z.number().min(0).max(1).optional(),
  show: z.boolean().optional(),
  /** Play an animation: walk, stand or dance for a person, or a clip's name in a model. */
  clip: z.string().min(1).optional(),
  /** Clip speed: 0.5 is half speed. A walk matches its move by default. */
  speed: positive.optional(),
  /** On a move: false keeps the actor facing the way it already was. */
  face: z.boolean().optional(),
  /** For the camera: what it looks at. */
  target: vec3.optional(),
  /** For the camera: how much of the world fits, or its lens angle. */
  size: positive.optional(),
  fov: positive.optional(),
})
// Limits, so a project from someone else can't hang the browser that opens it.
export const Stage3dActorsSchema = z.array(ActorSchema).max(500)
export const Stage3dTimelineSchema = z.array(Stage3dActionSchema).max(5000)
export const Stage3dCameraSchema = z.strictObject({
  /** Isometric keeps things flat and parallel; perspective is like a real lens. */
  view: z.enum(['isometric', 'perspective']).default('isometric'),
  position: vec3.default([21, 21, 25]),
  target: vec3.default([0, 1, 0]),
  /** Isometric: how many world units tall the 16:9 picture is. */
  size: positive.default(15),
  /** Perspective: the lens angle at 16:9, in degrees. */
  fov: positive.default(30),
  /** How much closer to get in 9:16, where keeping the full width leaves subjects small. */
  tallZoom: positive.default(1),
})
export const Stage3dWorldSchema = z.strictObject({
  light: z.enum(['day', 'night', 'studio']).default('day'),
  background: hex.default('#9cc488'),
  /** A vertical fade, top to bottom, instead of the background color. */
  gradient: z.tuple([hex, hex]).optional(),
  /** Color of a floor at height 0; leave it out for no floor. */
  floor: hex.optional(),
  exposure: positive.default(1),
  /** How far from the target shadows reach, in world units. */
  shadowReach: positive.default(24),
})

const BlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('eyebrow'), at, text: z.string() }),
  z.object({ type: z.literal('headline'), at, text: z.string(), accent: z.string().optional() }),
  z.object({ type: z.literal('text'), at, text: z.string() }),
  z.object({
    type: z.literal('code'),
    at,
    label: z.string().optional(),
    lang: z.enum(['ts', 'js', 'py', 'sql', 'json', 'plain']).default('ts'),
    source: z.string(),
    cps: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal('terminal'),
    at,
    label: z.string().optional(),
    source: z.string(),
    cps: z.number().positive().optional(),
  }),
  z.object({ type: z.literal('tree'), at, lines: z.array(z.string()) }),
  z.object({
    type: z.literal('stamp'),
    at,
    text: z.string(),
    tone: z.enum(['good', 'bad']),
    until: z.number().min(0).optional(),
  }),
  z.object({
    type: z.literal('cards'),
    at,
    items: z.array(z.object({ title: z.string(), sub: z.string().optional() })),
  }),
  z.object({
    type: z.literal('chips'),
    at,
    label: z.string().optional(),
    items: z.array(z.string()),
  }),
  z.object({
    type: z.literal('end'),
    at,
    wordmark: z.string(),
    tagline: z.string().optional(),
    command: z.string().optional(),
    url: z.string().optional(),
  }),
  z.object({
    type: z.literal('icon'),
    at,
    /** Height of each icon, in the same units as the scene's text. */
    size: z.number().positive().max(40).default(8),
    items: z.array(
      z.object({
        path: z
          .string()
          .regex(/^media\/[\w./-]+\.(svg|png|webp|jpe?g)$/, {
            error: 'an image under media/',
          })
          .refine((p) => !p.includes('..'), { error: 'an image under media/' }),
        label: z.string().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal('doodle'),
    at,
    /** The drawing's own coordinates. Paths and labels are placed in them. */
    viewBox: viewBox.default('0 0 1600 720'),
    /** Show a pen drawing each line. */
    pen: z.boolean().default(true),
    /** Hand-drawn wobble on the lines; off is sharper and cheaper to render. */
    wobble: z.boolean().default(true),
    strokes: DoodleStrokesSchema,
    /** A separate drawing for 9:16: wide art is tiny in a tall frame. */
    tall: DoodleTallSchema.optional(),
  }),
  z.object({
    type: z.literal('stage3d'),
    at,
    camera: Stage3dCameraSchema.prefault({}),
    world: Stage3dWorldSchema.prefault({}),
    actors: Stage3dActorsSchema,
    timeline: Stage3dTimelineSchema.default([]),
  }),
])

export const TRANSITIONS = [
  'fade',
  'cut',
  'slide',
  'wipe',
  'zoom',
  'iris',
  'flip',
  'blinds',
  'break',
  'shatter',
  'crumble',
] as const
export type Transition = (typeof TRANSITIONS)[number]

const sceneBase = {
  // Used in file names (voice/<id>.tts.mp3), so no slashes or dots.
  id: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/, { error: 'letters, digits, - and _ only' }),
  minSeconds: z.number().min(0).default(4),
  transition: z.enum(TRANSITIONS).default('fade'),
  /** How long the transition takes. Default: a length that suits its kind. */
  transitionSeconds: z.number().positive().max(5).optional(),
  caption: z.string(),
  spoken: z.string().optional(),
  voice: z.enum(['tts', 'recording']).default('tts'),
}

const SceneSchema = z.discriminatedUnion('kind', [
  z.object({ ...sceneBase, kind: z.literal('blocks'), blocks: z.array(BlockSchema) }),
  z.object({
    ...sceneBase,
    kind: z.literal('custom'),
    html: z.string().default(''),
    css: z.string().default(''),
    script: z.string(),
  }),
])

// Theme values are written into CSS, so they're kept to plain forms: a hex
// color, a family name of letters, digits and spaces.
export const FONT_FAMILY = /^[A-Za-z0-9 ]{1,60}$/
const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, { error: 'a hex color like #f2c14e' })
const family = z.string().regex(FONT_FAMILY, { error: 'letters, digits and spaces only' })
const ThemeSchema = z.object({
  colors: z.object({
    bg: color,
    panel: color,
    line: color,
    fg: color,
    muted: color,
    accent: color,
    good: color,
    bad: color,
  }),
  fonts: z.object({
    display: family,
    body: family,
    mono: family,
    /** Font files stored in the project, from Google Fonts or added by hand. */
    files: z
      .array(
        z.object({
          family,
          weight: z.number().int().min(1).max(1000),
          path: z.string().startsWith('media/fonts/'),
        }),
      )
      .optional(),
  }),
  logo: z.string().optional(),
})

// A rough vertex count for what a project's 3D scenes would build. Each limit above
// is fine alone, but together they could still crash the tab that opens a shared
// project, so the total has a budget. Real scenes come nowhere near it.
const STAGE3D_BUDGET = 5_000_000
export const LATHE_MAX_SAMPLES = 512
function actorCost(a: z.output<typeof ActorSchema>) {
  if (a.kind === 'lathe') return Math.min(a.profile.length * 12, LATHE_MAX_SAMPLES) * 129
  if (a.kind === 'road') return Math.ceil(a.length / 4) * 24
  if (a.kind === 'person') return 10_000
  if (a.kind === 'car' || a.kind === 'building') return 5_000
  return 2_000
}

export const ProjectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    formats: z.array(format).min(1),
    theme: ThemeSchema,
    voice: z.object({ tts: z.string(), rate: z.string() }),
    music: z
      .object({
        file: z.string(),
        volume: z.number().min(0).max(1).default(0.25),
        duck: z.number().min(0).max(1).default(0.35),
      })
      .optional(),
    captions: z.boolean().default(true),
    /** Seconds of picture kept after a scene's voice ends, before the next scene. */
    pauseSeconds: z.number().min(0).max(5).default(1.3),
    scenes: z.array(SceneSchema).min(1),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>()
    p.scenes.forEach((s, i) => {
      if (seen.has(s.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scenes', i, 'id'],
          message: `duplicate scene id "${s.id}"`,
        })
      }
      seen.add(s.id)
    })
    const cost = p.scenes
      .flatMap((s) => (s.kind === 'blocks' ? s.blocks : []))
      .flatMap((b) => (b.type === 'stage3d' ? b.actors : []))
      .reduce((total, actor) => total + actorCost(actor), 0)
    if (cost > STAGE3D_BUDGET) {
      ctx.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: `the 3D scenes are too large to draw: about ${cost} vertices, over the limit of ${STAGE3D_BUDGET}`,
      })
    }
  })
  .transform((p) => ({
    ...p,
    scenes: p.scenes.map((s) => ({ ...s, spoken: s.spoken ?? s.caption })),
  }))

export type Project = z.output<typeof ProjectSchema>
export type Scene = Project['scenes'][number]
export type Block = z.output<typeof BlockSchema>
export type Theme = Project['theme']

export class ProjectError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super(issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    this.name = 'ProjectError'
  }
}

export function parseProject(json: unknown): Project {
  const result = ProjectSchema.safeParse(json)
  if (!result.success) throw new ProjectError(result.error.issues)
  return result.data
}

export const DEFAULT_THEME: Theme = {
  colors: {
    bg: '#0d2226',
    panel: '#13313a',
    line: '#24505a',
    fg: '#efe9da',
    muted: '#9db4b3',
    accent: '#f2c14e',
    good: '#7fd1b9',
    bad: '#e3735e',
  },
  fonts: { display: 'Unbounded', body: 'IBM Plex Sans', mono: 'JetBrains Mono' },
}

export function starterProject(name: string, voice = 'en-US-AvaNeural'): Project {
  return parseProject({
    version: 1,
    name,
    formats: ['16:9'],
    theme: DEFAULT_THEME,
    voice: { tts: voice, rate: '-4%' },
    captions: true,
    scenes: [
      {
        id: 's1',
        kind: 'blocks',
        caption: `Meet ${name}.`,
        blocks: [{ type: 'headline', text: `Meet ${name}.`, accent: name }],
      },
    ],
  })
}
