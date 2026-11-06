// What the signing workspace sends: items to draw onto a PDF's pages. Each is
// placed by a box in fractions of the page as it is seen (rotation applied,
// within its crop box), top-left origin; the server works out PDF coordinates.
import { z } from 'zod'

const fraction = z.number().min(0).max(1)
const box = z.object({ x: fraction, y: fraction, w: fraction, h: fraction })
const pages = z.array(z.number().int().min(1).max(5000)).min(1).max(5000)
// Ink: a #rrggbb colour, and nothing else (it reaches the PDF and the page's styles).
const color = z.string().regex(/^#[0-9a-f]{6}$/i)

const item = z.discriminatedUnion('kind', [
  // A signature or initials, as one of the pictures sent with the job.
  z.object({ kind: z.literal('picture'), pages, box, picture: z.number().int().min(0).max(19) }),
  // Date, name or free text, drawn as real text.
  z.object({
    kind: z.literal('text'),
    pages,
    box,
    text: z.string().min(1).max(2000),
    size: z.number().min(6).max(72),
    color,
  }),
  z.object({ kind: z.literal('tick'), pages, box, color }),
])

export const signItems = z.array(item).max(500)
export type SignItem = z.infer<typeof item>
export type Box = SignItem['box']

/** Throws, with the words to show, when an item can't be drawn as placed. */
export function checkItems(items: SignItem[], pageCount: number | null, pictureCount: number) {
  // A hair's room for rounding in the browser.
  const over = (a: number, b: number) => a + b > 1 + 1e-6
  for (const item of items) {
    const { x, y, w, h } = item.box
    if (w <= 0 || h <= 0) throw new Error('an item has no size')
    if (over(x, w) || over(y, h)) throw new Error('an item runs off the page')
    if (pageCount !== null && item.pages.some((p) => p > pageCount))
      throw new Error(`it has only ${pageCount} pages`)
    if (item.kind === 'picture' && item.picture >= pictureCount)
      throw new Error('a signature picture is missing')
  }
}

/**
 * An item as the workspace keeps it (and a stored document saves it): what it
 * is, rather than how it's drawn. Turned into SignItem at Finish.
 */
export const placedItem = z.object({
  id: z.string().regex(/^[\w-]{1,32}$/),
  label: z.enum(['signature', 'initials', 'date', 'name', 'text', 'tick']),
  pages,
  box,
  color,
  text: z.string().max(2000).optional(),
  size: z.number().min(6).max(72).optional(),
})
export const placedItems = z.array(placedItem).max(500)
export type Placed = z.infer<typeof placedItem>

