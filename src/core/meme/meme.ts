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
export const MEME_LAYOUTS = ['bar', 'classic', 'free'] as const

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'a colour like #ffffff' })

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
})
export type MemeText = z.output<typeof MemeTextSchema>

export const MemeSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(120),
  size: z.enum(Object.keys(MEME_SIZES) as [MemeSize, ...MemeSize[]]).default('1:1'),
  /** The picture, under media/: a still or a GIF. */
  media: z
    .string()
    .regex(/^media\/[\w.-]+\.(png|jpe?g|webp|gif)$/, { error: 'an image or GIF under media/' })
    .refine((p) => !p.includes('..'), { error: 'an image or GIF under media/' })
    .optional(),
  /** bar: text in a band above the picture. classic: outlined, top and bottom. free: placed by x and y. */
  layout: z.enum(MEME_LAYOUTS).default('bar'),
  bar: color.default('#ffffff'),
  barText: color.default('#111111'),
  background: color.default('#000000'),
  /** contain shows the whole picture; cover fills its space and crops. */
  fit: z.enum(['contain', 'cover']).default('contain'),
  texts: z.array(MemeTextSchema).max(20).default([]),
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

/** What drawMeme uses from a canvas context; the browser's CanvasRenderingContext2D has it all. */
export type Paint = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
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
  | 'clip'
>

/**
 * Draw a meme at its full size. `picture` is the image, or the GIF frame to show,
 * with its natural size; null leaves the background in its place.
 */
export function drawMeme(
  g: Paint,
  meme: Meme,
  picture: { image: CanvasImageSource; w: number; h: number } | null,
) {
  const [W, H] = MEME_SIZES[meme.size]
  const px = (size: number) => (size / 100) * W
  const font = (size: number) => `${px(size)}px ${MEME_FONT}`
  const measure = (s: string) => g.measureText(s).width

  // The caption bar is as tall as its wrapped text.
  let barH = 0
  const barLines =
    meme.layout === 'bar'
      ? meme.texts.map((t) => {
          g.font = font(t.size)
          const lines = wrapLines(t.text, W * 0.9, measure)
          barH += lines.length * px(t.size) * 1.2
          return lines
        })
      : []
  if (barH) barH += px(6)

  g.fillStyle = meme.background
  g.fillRect(0, 0, W, H)
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
  g.textBaseline = 'top'
  g.lineJoin = 'round'
  if (meme.layout === 'bar') {
    if (!barH) return
    g.fillStyle = meme.bar
    g.fillRect(0, 0, W, barH)
    let y = px(3)
    meme.texts.forEach((t, i) => {
      g.font = font(t.size)
      g.fillStyle = meme.barText
      for (const line of barLines[i]) {
        g.fillText(line, W / 2, y)
        y += px(t.size) * 1.2
      }
    })
    return
  }

  meme.texts.forEach((t, i) => {
    g.font = font(t.size)
    const text = meme.layout === 'classic' ? t.text.toUpperCase() : t.text
    const lines = wrapLines(text, W * 0.92, measure)
    const lineH = px(t.size) * 1.1
    const blockH = lines.length * lineH
    let x = W / 2
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
      x = (t.x / 100) * W
      top = space.y + (t.y / 100) * space.h - blockH / 2
    }
    lines.forEach((line, n) => {
      const y = top + n * lineH
      if (t.outline) {
        g.strokeStyle = '#000000'
        g.lineWidth = px(t.size) * 0.16
        g.strokeText(line, x, y)
      }
      g.fillStyle = t.color
      g.fillText(line, x, y)
    })
  })
}

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
