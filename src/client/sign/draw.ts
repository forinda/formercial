// Making a signature or initials picture: drawn on a pad, a photo with its
// paper cleared, or typed in a handwriting font. Every one ends as a
// see-through PNG cropped to the ink.

type Pixels = { data: Uint8ClampedArray; width: number; height: number }
type Point = { x: number; y: number }

/** The box around the ink (anything not see-through), with `pad` pixels of room; null if blank. */
export function inkBounds({ data, width, height }: Pixels, pad: number) {
  let [x0, y0, x1, y1] = [width, height, -1, -1]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
  if (x1 < 0) return null
  const [l, t] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)]
  const [r, b] = [Math.min(width, x1 + 1 + pad), Math.min(height, y1 + 1 + pad)]
  return { x: l, y: t, w: r - l, h: b - t }
}

/**
 * Makes the paper see-through: pixels within `threshold` of the paper's colour
 * (taken from the corners) go, those a little further fade, the ink stays.
 */
export function clearPaper({ data, width, height }: Pixels, threshold: number) {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1]
  const paper = [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i * 4 + c], 0) / 4)
  for (let i = 0; i < width * height; i++) {
    const far = Math.max(...[0, 1, 2].map((c) => Math.abs(data[i * 4 + c] - paper[c])))
    if (far <= threshold) data[i * 4 + 3] = 0
    else if (far < threshold * 2)
      data[i * 4 + 3] = Math.round((data[i * 4 + 3] * (far - threshold)) / threshold)
  }
}

/** Rounds a stroke's corners (Chaikin, twice), keeping where it starts and ends. */
export function smooth(points: Point[]): Point[] {
  let line = points
  for (let round = 0; round < 2 && line.length > 2; round++) {
    const next = [line[0]]
    for (let i = 0; i < line.length - 1; i++) {
      const [a, b] = [line[i], line[i + 1]]
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y })
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y })
    }
    next.push(line[line.length - 1])
    line = next
  }
  return line
}

// ─── In the browser ───────────────────────────────────────────────────────────

/** A canvas's ink, cropped, as a PNG; null if nothing's on it. */
export async function trimToInk(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const ctx = canvas.getContext('2d')!
  const box = inkBounds(ctx.getImageData(0, 0, canvas.width, canvas.height), 4)
  if (!box) return null
  const out = document.createElement('canvas')
  ;[out.width, out.height] = [box.w, box.h]
  out.getContext('2d')!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
  return new Promise((done) => out.toBlob((b) => done(b), 'image/png'))
}

/** A photo or scan of a signature, its paper cleared, as a PNG. */
export async function removeBackground(picture: Blob, threshold: number): Promise<Blob | null> {
  const img = await createImageBitmap(picture)
  // Big photos are scaled down: a signature needs no more than this.
  const k = Math.min(1, 1600 / img.width)
  const canvas = document.createElement('canvas')
  ;[canvas.width, canvas.height] = [Math.round(img.width * k), Math.round(img.height * k)]
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  clearPaper(pixels, threshold)
  ctx.putImageData(pixels, 0, 0)
  return trimToInk(canvas)
}

/** The handwriting fonts typed signatures can use; bundled in public/fonts with their licences. */
export const HANDS = [
  { family: 'Caveat', file: 'Caveat.ttf' },
  { family: 'Dancing Script', file: 'DancingScript.ttf' },
  { family: 'Great Vibes', file: 'GreatVibes-Regular.ttf' },
] as const
export type Hand = (typeof HANDS)[number]['family']

const loaded = new Map<string, Promise<FontFace>>()
export function loadHand(family: Hand) {
  const hand = HANDS.find((h) => h.family === family)!
  let face = loaded.get(family)
  if (!face) {
    face = new FontFace(family, `url(/fonts/${hand.file})`).load().then(
      (f) => {
        document.fonts.add(f)
        return f
      },
      () => {
        // Not kept, so the next try loads it again.
        loaded.delete(family)
        throw new Error(`the ${family} handwriting didn't load; pick another`)
      },
    )
    loaded.set(family, face)
  }
  return face
}

/** Typed words in a handwriting font, as a PNG of the ink. */
export async function typedSignature(words: string, family: Hand, color: string) {
  await loadHand(family)
  const size = 120
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${size}px "${family}"`
  canvas.width = Math.ceil(ctx.measureText(words).width + size)
  canvas.height = size * 2
  // Resizing a canvas resets its drawing state.
  ctx.font = `${size}px "${family}"`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(words, size / 2, size)
  return trimToInk(canvas)
}

/** Draws one smoothed stroke onto a pad. */
export function stroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
) {
  const line = smooth(points)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(line[0].x, line[0].y)
  for (const p of line.slice(1)) ctx.lineTo(p.x, p.y)
  // A single tap still leaves a dot.
  if (line.length === 1) ctx.lineTo(line[0].x + 0.1, line[0].y)
  ctx.stroke()
}
