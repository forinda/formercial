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
