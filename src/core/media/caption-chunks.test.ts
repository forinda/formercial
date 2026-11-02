import { describe, expect, test } from 'vitest'
import { alignWords, captionChunks } from './caption-chunks'

describe('captionChunks', () => {
  test('a short caption stays whole, for all its time', () => {
    expect(captionChunks('Hello there.', 3)).toEqual([{ text: 'Hello there.', start: 0, end: 3 }])
  })

  test('two sentences that fit together stay together', () => {
    const text = 'The first sentence is sufficiently long. OK.'
    expect(captionChunks(text, 4)).toEqual([{ text, start: 0, end: 4 }])
  })

  test('a word longer than the limit is broken to fit', () => {
    const pieces = captionChunks('x'.repeat(71), 4)
    expect(pieces.map((p) => p.text.length)).toEqual([70, 1])
  })

  test('splits a paragraph into short pieces, keeping every word in order', () => {
    const text =
      'It looks like hacking in a film, but it is nothing like that. See this? I typed one command, and a folder appeared, the same folder you would make by right-clicking.'
    const pieces = captionChunks(text, 10)
    expect(pieces[0].text).toBe('It looks like hacking in a film, but it is nothing like that.')
    expect(pieces.every((p) => p.text.length <= 70)).toBe(true)
    expect(pieces.map((p) => p.text).join(' ')).toBe(text)
  })

  test('a tall video can hold longer pieces', () => {
    const text = 'word '.repeat(30).trim()
    expect(captionChunks(text, 10, 84)[0].text.length).toBeGreaterThan(70)
    expect(captionChunks(text, 10, 84).every((p) => p.text.length <= 84)).toBe(true)
  })

  test('the pieces fill the time, end to end', () => {
    const text =
      'One sentence that is long enough to end a piece here. And then another one after it.'
    const pieces = captionChunks(text, 8)
    expect(pieces[0].start).toBe(0)
    expect(pieces.at(-1)!.end).toBe(8)
    for (let i = 1; i < pieces.length; i++) expect(pieces[i].start).toBe(pieces[i - 1].end)
  })

  test('with word times, pieces switch when their first word is said', () => {
    const text = 'One two three four. Five six seven eight.'
    const said = text
      .split(' ')
      .map((w, i) => ({ text: w.replace('.', ''), start: i, end: i + 0.8 }))
    const pieces = captionChunks(text, 9, 30, said)
    expect(pieces.map((p) => [p.text, p.start, p.end])).toEqual([
      ['One two three four.', 0, 4],
      ['Five six seven eight.', 4, 9],
    ])
    expect(pieces[1].words?.map((w) => w.start)).toEqual([4, 5, 6, 7])
  })
})

describe('alignWords', () => {
  test('matches words the voice said, spreads the rest between them', () => {
    const said = [
      { text: 'Run', start: 0, end: 0.4 },
      { text: 'S', start: 0.5, end: 0.6 },
      { text: 'Q', start: 0.7, end: 0.8 },
      { text: 'L', start: 0.9, end: 1 },
      { text: 'now', start: 1.2, end: 1.5 },
    ]
    const timed = alignWords(['Run', 'SQL', 'now.'], said, 2)
    expect(timed.map((w) => w.text)).toEqual(['Run', 'SQL', 'now.'])
    expect(timed[0].start).toBe(0)
    expect(timed[1].start).toBeCloseTo(0.4)
    expect(timed[1].end).toBeCloseTo(1.2)
    expect(timed[2].start).toBe(1.2)
  })

  test('words past the last match run to the end of the clip', () => {
    const timed = alignWords(['a', 'b', 'c'], [{ text: 'a', start: 0, end: 1 }], 3)
    expect(timed.map((w) => w.start)).toEqual([0, 1, 2])
  })
})
