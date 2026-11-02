import { describe, expect, test } from 'vitest'
import { parseWords } from './edge-tts'

describe('parseWords', () => {
  test('reads the last line as the word list, keeping only well-formed words', () => {
    const out =
      'some warning\n[{"text":"Hi","start":0.1,"end":0.3},{"text":5},{"text":"x","start":"0"}]\n'
    expect(parseWords(out)).toEqual([{ text: 'Hi', start: 0.1, end: 0.3 }])
  })

  test('nothing usable gives none', () => {
    expect(parseWords('')).toBeUndefined()
    expect(parseWords('not json')).toBeUndefined()
    expect(parseWords('[]')).toBeUndefined()
    expect(parseWords('{"text":"a"}')).toBeUndefined()
  })
})
