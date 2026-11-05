// A meme: one picture (or GIF) and its text, drawn straight onto a canvas. Memes
// are their own thing, not projects: no scenes, no voice, no render queue.
import { z } from 'zod'

/** Output sizes, in pixels. */
export const MEME_SIZES = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
} as const
export type MemeSize = keyof typeof MEME_SIZES
export const MEME_LAYOUTS = ['bar', 'classic', 'free', 'post'] as const

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'a colour like #ffffff' })
const mediaPath = z
  .string()
  .regex(/^media\/[\w.-]+\.(png|jpe?g|webp|gif)$/, { error: 'an image or GIF under media/' })
  .refine((p) => !p.includes('..'), { error: 'an image or GIF under media/' })

/**
 * The post layout's author line. It's for your own or made-up accounts: there's no
 * platform logo, and the badge is a plain checkmark in a colour you pick.
 */
export const MemePostSchema = z.object({
  name: z.string().max(60).default('Your Name'),
  handle: z.string().max(40).default('yourname'),
  time: z.string().max(20).default('2h'),
  badge: z.boolean().default(false),
  badgeColor: color.default('#2f80ed'),
  avatar: mediaPath.optional(),
  dark: z.boolean().default(false),
})

export const MemeTextSchema = z.object({
  text: z.string().max(500),
  /** Free layout only: the text's centre, as % of the picture's width and height. */
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  /** Letter height, as % of the meme's width. */
  size: z.number().min(1).max(30).default(8),
  color: color.default('#ffffff'),
  /** A black outline, so light text reads on any picture. */
  outline: z.boolean().default(true),
  /** Seconds into the meme it appears, and goes. */
  at: z.number().min(0).max(60).optional(),
  until: z.number().positive().max(60).optional(),
})
export type MemeText = z.output<typeof MemeTextSchema>

export const MemeSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(120),
  size: z.enum(Object.keys(MEME_SIZES) as [MemeSize, ...MemeSize[]]).default('1:1'),
  /** The picture, under media/: a still or a GIF. */
  media: mediaPath.optional(),
  /** bar: a band above the picture. classic: outlined, top and bottom. free: placed by x and y. post: a social post card. */
  layout: z.enum(MEME_LAYOUTS).default('bar'),
  bar: color.default('#ffffff'),
  barText: color.default('#111111'),
  background: color.default('#000000'),
  /** contain shows the whole picture; cover fills its space and crops. */
  fit: z.enum(['contain', 'cover']).default('contain'),
  texts: z.array(MemeTextSchema).max(20).default([]),
  post: MemePostSchema.prefault({}),
  /** How long a still meme with timed text runs before it loops. A GIF's own length wins. */
  seconds: z.number().min(1).max(30).default(3),
})
export type Meme = z.output<typeof MemeSchema>

export const parseMeme = (value: unknown): Meme => MemeSchema.parse(value)

export const blankMeme = (name: string): Meme =>
  parseMeme({ version: 1, name, texts: [{ text: 'When the code works first time', size: 6 }] })

/** The poster face first, then what most machines already have. */
export const MEME_FONT = "Anton, Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"

/** Split text into lines no wider than `max`, breaking at spaces and keeping given line breaks. */
export function wrapLines(text: string, max: number, width: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && width(next) > max) {
        out.push(line)
        line = word
      } else line = next
    }
    out.push(line)
  }
  return out
}

type Box = { x: number; y: number; w: number; h: number }

/** Where the picture goes in its space: whole (contain) or filling and cropped (cover). */
export function fitBox(pic: { w: number; h: number }, into: Box, fit: Meme['fit']): Box {
  const scale = (fit === 'cover' ? Math.max : Math.min)(into.w / pic.w, into.h / pic.h)
  const w = pic.w * scale
  const h = pic.h * scale
  return { x: into.x + (into.w - w) / 2, y: into.y + (into.h - h) / 2, w, h }
}

/** Whether a text with these times shows at `t` seconds. */
export const textOn = (t: { at?: number; until?: number }, time: number) =>
  time >= (t.at ?? 0) && (t.until === undefined || time < t.until)

/** Whether anything in the meme moves: a GIF, or text that comes or goes. */
export const memeMoves = (meme: Meme) =>
  Boolean(meme.media?.endsWith('.gif')) ||
  meme.texts.some((t) => (t.at ?? 0) > 0 || t.until !== undefined)

/** A face most machines have, for the post card's plain text. */
export const POST_FONT =
  "'Helvetica Neue', 'Segoe UI', Roboto, Arial, 'Liberation Sans', sans-serif"

/** What drawMeme uses from a canvas context; the browser's CanvasRenderingContext2D has it all. */
export type Paint = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'lineCap'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillRect'
  | 'fillText'
  | 'strokeText'
  | 'measureText'
  | 'drawImage'
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'rect'
  | 'roundRect'
  | 'arc'
  | 'moveTo'
  | 'lineTo'
  | 'fill'
  | 'stroke'
  | 'clip'
>

export type Picture = { image: CanvasImageSource; w: number; h: number }

/**
 * Draw a meme at its full size, `t` seconds in. `picture` is the image, or the GIF
 * frame to show, with its natural size; `avatar` is the post card's face.
 */
export function drawMeme(
  g: Paint,
  meme: Meme,
  art: { picture?: Picture | null; avatar?: Picture | null } = {},
  t = 0,
) {
  const [W, H] = MEME_SIZES[meme.size]
  const px = (size: number) => (size / 100) * W
  const measure = (s: string) => g.measureText(s).width
  const picture = art.picture ?? null
  g.fillStyle = meme.background
  g.fillRect(0, 0, W, H)
  g.textBaseline = 'top'
  g.lineJoin = 'round'
  if (meme.layout === 'post') return drawPost(g, meme, picture, art.avatar ?? null, t)
  const font = (size: number) => `${px(size)}px ${MEME_FONT}`

  // The caption bar is as tall as all its text, shown or not, so it doesn't jump.
  let barH = 0
  const barLines =
    meme.layout === 'bar'
      ? meme.texts.map((x) => {
          g.font = font(x.size)
          const lines = wrapLines(x.text, W * 0.9, measure)
          barH += lines.length * px(x.size) * 1.2
          return lines
        })
      : []
  if (barH) barH += px(6)

  const space: Box = { x: 0, y: barH, w: W, h: H - barH }
  if (picture) {
    const at = fitBox(picture, space, meme.fit)
    g.save()
    g.beginPath()
    g.rect(space.x, space.y, space.w, space.h)
    g.clip()
    g.drawImage(picture.image, at.x, at.y, at.w, at.h)
    g.restore()
  }

  g.textAlign = 'center'
  if (meme.layout === 'bar') {
    if (!barH) return
    g.fillStyle = meme.bar
    g.fillRect(0, 0, W, barH)
    let y = px(3)
    meme.texts.forEach((x, i) => {
      g.font = font(x.size)
      g.fillStyle = meme.barText
      for (const line of barLines[i]) {
        if (textOn(x, t)) g.fillText(line, W / 2, y)
        y += px(x.size) * 1.2
      }
    })
    return
  }

  meme.texts.forEach((x, i) => {
    if (!textOn(x, t)) return
    g.font = font(x.size)
    const text = meme.layout === 'classic' ? x.text.toUpperCase() : x.text
    const lines = wrapLines(text, W * 0.92, measure)
    const lineH = px(x.size) * 1.1
    const blockH = lines.length * lineH
    let cx = W / 2
    let top: number
    if (meme.layout === 'classic') {
      const last = i === meme.texts.length - 1 && i > 0
      top =
        i === 0
          ? space.y + H * 0.03
          : last
            ? space.y + space.h - H * 0.03 - blockH
            : space.y + (space.h - blockH) / 2
    } else {
      cx = (x.x / 100) * W
      top = space.y + (x.y / 100) * space.h - blockH / 2
    }
    lines.forEach((line, n) => {
      const y = top + n * lineH
      if (x.outline) {
        g.strokeStyle = '#000000'
        g.lineWidth = px(x.size) * 0.16
        g.strokeText(line, cx, y)
      }
      g.fillStyle = x.color
      g.fillText(line, cx, y)
    })
  })
}

/** The post card's colours: plain light and dark, not any one site's. */
export const postColors = (dark: boolean) =>
  dark
    ? { card: '#16181c', text: '#eeeeee', muted: '#9a9a9a', line: '#2e3238' }
    : { card: '#ffffff', text: '#111111', muted: '#666666', line: '#e3e3e3' }

/** Where each part of a post card goes, so drawing and tests agree. */
export function postLayout(
  meme: Meme,
  picture: Picture | null,
  measure: (s: string, size: number) => number,
) {
  const [W, H] = MEME_SIZES[meme.size]
  const px = (size: number) => (size / 100) * W
  const margin = px(5)
  const pad = px(4)
  const cardW = W - 2 * margin
  const innerW = cardW - 2 * pad
  const face = px(11)
  const headH = face
  const gap = px(3)
  const body = meme.texts.map((x) => {
    const size = px(x.size)
    const lines = wrapLines(x.text, innerW, (s) => measure(s, size))
    return { text: x, size, lines, h: lines.length * size * 1.3 }
  })
  const bodyH = body.reduce((sum, b) => sum + b.h, 0)
  const room = H - 2 * margin - 2 * pad - headH - gap - (bodyH ? bodyH + gap : 0)
  const picH = picture ? Math.max(0, Math.min(room, (innerW * picture.h) / picture.w)) : 0
  const cardH = 2 * pad + headH + (bodyH ? gap + bodyH : 0) + (picH ? gap + picH : 0)
  const top = Math.max(margin, (H - cardH) / 2)
  const x = margin + pad
  const bodyTop = top + pad + headH + gap
  return {
    card: { x: margin, y: top, w: cardW, h: cardH, r: px(2.5) },
    face: { x: x + face / 2, y: top + pad + face / 2, r: face / 2 },
    name: { x: x + face + px(3), y: top + pad + px(1.2), size: px(4.2) },
    handle: { x: x + face + px(3), y: top + pad + px(6.4), size: px(3.6) },
    body: body.map((b, i) => ({
      ...b,
      y: bodyTop + body.slice(0, i).reduce((s, c) => s + c.h, 0),
    })),
    bodyX: x,
    picture: picH
      ? { x, y: bodyTop + (bodyH ? bodyH + gap : 0), w: innerW, h: picH, r: px(2) }
      : null,
  }
}

function drawPost(
  g: Paint,
  meme: Meme,
  picture: Picture | null,
  avatar: Picture | null,
  t: number,
) {
  const c = postColors(meme.post.dark)
  const L = postLayout(meme, picture, (s, size) => {
    g.font = `${size}px ${POST_FONT}`
    return g.measureText(s).width
  })
  g.textAlign = 'left'
  g.fillStyle = c.card
  g.beginPath()
  g.roundRect(L.card.x, L.card.y, L.card.w, L.card.h, L.card.r)
  g.fill()

  // The face: their picture in a circle, or their first letter.
  g.save()
  g.beginPath()
  g.arc(L.face.x, L.face.y, L.face.r, 0, Math.PI * 2)
  g.clip()
  if (avatar) {
    const at = fitBox(
      avatar,
      { x: L.face.x - L.face.r, y: L.face.y - L.face.r, w: L.face.r * 2, h: L.face.r * 2 },
      'cover',
    )
    g.drawImage(avatar.image, at.x, at.y, at.w, at.h)
  } else {
    g.fillStyle = meme.post.badgeColor
    g.fillRect(L.face.x - L.face.r, L.face.y - L.face.r, L.face.r * 2, L.face.r * 2)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.font = `700 ${L.face.r}px ${POST_FONT}`
    g.fillText(
      (meme.post.name.trim()[0] ?? '?').toUpperCase(),
      L.face.x,
      L.face.y - L.face.r * 0.55,
    )
    g.textAlign = 'left'
  }
  g.restore()

  g.fillStyle = c.text
  g.font = `700 ${L.name.size}px ${POST_FONT}`
  g.fillText(meme.post.name, L.name.x, L.name.y)
  if (meme.post.badge) {
    const r = L.name.size * 0.45
    const bx = L.name.x + g.measureText(meme.post.name).width + r * 1.6
    const by = L.name.y + L.name.size * 0.55
    g.fillStyle = meme.post.badgeColor
    g.beginPath()
    g.arc(bx, by, r, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = r * 0.28
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(bx - r * 0.45, by + r * 0.02)
    g.lineTo(bx - r * 0.1, by + r * 0.38)
    g.lineTo(bx + r * 0.48, by - r * 0.32)
    g.stroke()
  }
  g.fillStyle = c.muted
  g.font = `${L.handle.size}px ${POST_FONT}`
  const handle = meme.post.handle.replace(/^@/, '')
  g.fillText(
    [handle && `@${handle}`, meme.post.time].filter(Boolean).join(' · '),
    L.handle.x,
    L.handle.y,
  )

  g.fillStyle = c.text
  for (const b of L.body) {
    if (!textOn(b.text, t)) continue
    g.font = `${b.size}px ${POST_FONT}`
    b.lines.forEach((line, n) => g.fillText(line, L.bodyX, b.y + n * b.size * 1.3))
  }
  if (picture && L.picture) {
    const p = L.picture
    g.save()
    g.beginPath()
    g.roundRect(p.x, p.y, p.w, p.h, p.r)
    g.clip()
    const at = fitBox(picture, p, meme.fit)
    g.drawImage(picture.image, at.x, at.y, at.w, at.h)
    g.restore()
  }
}

/** How long one loop of the meme lasts: the GIF's, or `seconds` for a still with timed text. */
export const memeLength = (meme: Meme, gifTotal = 0) =>
  gifTotal > 0 ? gifTotal : memeMoves(meme) ? meme.seconds : 0

/** Frame start times for exporting a still meme with timed text: 10 a second. */
export const stillFrames = (seconds: number) =>
  Array.from({ length: Math.round(seconds * 10) }, (_, i) => i / 10)

/** Each GIF frame's delay in milliseconds, rounded to the 10 ms steps a GIF stores. */
export function gifDelays(starts: number[], total: number): number[] {
  return starts.map((s, i) =>
    Math.max(20, Math.round((((starts[i + 1] ?? total) - s) * 1000) / 10) * 10),
  )
}

/** The exported GIF's size: at most 720 wide, so it stays small enough to share. */
export function gifSize(meme: Meme): [number, number] {
  const [W, H] = MEME_SIZES[meme.size]
  const scale = Math.min(1, 720 / W)
  return [Math.round(W * scale), Math.round(H * scale)]
}
