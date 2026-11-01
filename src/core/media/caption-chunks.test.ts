import { describe, expect, test } from 'vitest'
import { captionChunks } from './caption-chunks'

describe('captionChunks', () => {
  test('a short caption stays whole, for all its time', () => {
    expect(captionChunks('Hello there.', 3)).toEqual([{ text: 'Hello there.', start: 0, end: 3 }])
  })

  test('splits a paragraph into short pieces, keeping every word in order', () => {
    const text =
      'It looks like hacking in a film, but it is nothing like that. See this? I typed one command, and a folder appeared, the same folder you would make by right-clicking.'
    const pieces = captionChunks(text, 10)
    expect(pieces.length).toBeGreaterThan(1)
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
})
