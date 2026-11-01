/** Fits one line on wide video and in subtitle files. */
const ONE_LINE = 70
/** About two lines on a tall video, which has room for fewer characters a line. */
export const TWO_TALL_LINES = 84

/**
 * A scene's caption as short pieces, each on screen for its share of the time.
 * A whole paragraph at once is too much to read, most of all on a phone.
 * Breaks after a sentence when the piece is long enough, otherwise at the limit.
 */
export function captionChunks(text: string, seconds: number, maxChars = ONE_LINE) {
  const words = text.trim().split(/\s+/)
  const whole = words.join(' ')
  if (whole.length <= maxChars) return [{ text: whole, start: 0, end: seconds }]

  // A word too long for a piece, like a URL, breaks where it must.
  const fitted = words.flatMap((w) => w.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [w])
  const pieces: string[] = []
  let piece = ''
  for (const word of fitted) {
    const next = piece ? `${piece} ${word}` : word
    if (piece && next.length > maxChars) {
      pieces.push(piece)
      piece = word
    } else piece = next
    if (piece.length >= maxChars / 2 && /[.!?:]$/.test(piece)) {
      pieces.push(piece)
      piece = ''
    }
  }
  if (piece) pieces.push(piece)

  const total = pieces.reduce((sum, p) => sum + p.length, 0)
  let chars = 0
  return pieces.map((p) => {
    const start = (chars / total) * seconds
    chars += p.length
    return { text: p, start, end: (chars / total) * seconds }
  })
}
