import type { Word } from '@/core/project/timeline'

/** Fits one line on wide video and in subtitle files. */
const ONE_LINE = 70
/** About two lines on a tall video, which has room for fewer characters a line. */
export const TWO_TALL_LINES = 84

const plain = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * A time for each word of the caption, from the words the voice said. The two
 * can differ ("SQL" written, "S Q L" said), so words are matched in order where
 * they agree, and the rest are spread between their matched neighbours.
 */
export function alignWords(caption: string[], said: Word[], seconds: number): Word[] {
  const a = caption.map(plain)
  const b = said.map((w) => plain(w.text))
  // ponytail: O(n*m) longest common subsequence, fine for a scene's caption.
  const len = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      len[i][j] =
        a[i] && a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1])
    }
  }
  const match: (Word | undefined)[] = Array.from({ length: a.length })
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) match[i++] = said[j++]
    else if (len[i + 1][j] >= len[i][j + 1]) i++
    else j++
  }
  return caption.map((text, i) => {
    if (match[i]) return { text, start: match[i]!.start, end: match[i]!.end }
    // Between the matched words either side, or the clip's ends.
    let before = i - 1
    while (before >= 0 && !match[before]) before--
    let after = i + 1
    while (after < a.length && !match[after]) after++
    const from = before >= 0 ? match[before]!.end : 0
    const to = after < a.length ? match[after]!.start : seconds
    const gap = after - before
    const start = from + ((to - from) * (i - before - 1)) / Math.max(1, gap - 1)
    return { text, start, end: Math.min(to, start + (to - from) / Math.max(1, gap - 1)) }
  })
}

export type CaptionPiece = { text: string; start: number; end: number; words?: Word[] }

/**
 * A scene's caption as short pieces, each on screen for its share of the time.
 * A whole paragraph at once is too much to read, most of all on a phone.
 * Breaks after a sentence when the piece is long enough, otherwise at the limit.
 * With the voice's word times, each piece shows while its words are said, and
 * carries their times.
 */
export function captionChunks(
  text: string,
  seconds: number,
  maxChars = ONE_LINE,
  said?: Word[],
): CaptionPiece[] {
  const words = text.trim().split(/\s+/)
  const timed = said?.length ? alignWords(words, said, seconds) : undefined
  const whole = words.join(' ')
  if (whole.length <= maxChars) {
    return [
      timed
        ? { text: whole, start: 0, end: seconds, words: timed }
        : { text: whole, start: 0, end: seconds },
    ]
  }
  // A word too long for a piece, like a URL, breaks where it must.
  const fitted = words.flatMap((w, i) =>
    (w.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [w]).map((part) => ({ part, i })),
  )
  const pieces: { parts: typeof fitted; text: string }[] = []
  let piece: typeof fitted = []
  const textOf = (parts: typeof fitted) => parts.map((p) => p.part).join(' ')
  for (const f of fitted) {
    if (piece.length && textOf([...piece, f]).length > maxChars) {
      pieces.push({ parts: piece, text: textOf(piece) })
      piece = []
    }
    piece.push(f)
    const now = textOf(piece)
    if (now.length >= maxChars / 2 && /[.!?:]$/.test(now)) {
      pieces.push({ parts: piece, text: now })
      piece = []
    }
  }
  if (piece.length) pieces.push({ parts: piece, text: textOf(piece) })

  if (timed) {
    const startOf = (p: (typeof pieces)[number]) => timed[p.parts[0].i].start
    return pieces.map((p, n) => {
      const ids = [...new Set(p.parts.map((x) => x.i))]
      return {
        text: p.text,
        start: n ? startOf(p) : 0,
        end: n < pieces.length - 1 ? startOf(pieces[n + 1]) : seconds,
        words: ids.map((i) => timed[i]),
      }
    })
  }
  const total = pieces.reduce((sum, p) => sum + p.text.length, 0)
  let chars = 0
  return pieces.map((p) => {
    const start = (chars / total) * seconds
    chars += p.text.length
    return { text: p.text, start, end: (chars / total) * seconds }
  })
}
