import { describe, expect, test } from 'vitest'
import { DIFFICULTIES, makePuzzle, progress, solve } from './engine'

// A seeded random source, so each test gets the same puzzle every run.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Every row, column and box holds 1 to 9 once. */
const valid = (b: number[]) => {
  const groups: number[][] = Array.from({ length: 27 }, () => [])
  b.forEach((v, c) => {
    const r = Math.floor(c / 9)
    const k = c % 9
    groups[r].push(v)
    groups[9 + k].push(v)
    groups[18 + Math.floor(r / 3) * 3 + Math.floor(k / 3)].push(v)
  })
  return groups.every((g) => [...g].sort().join('') === '123456789')
}

describe('makePuzzle', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    test(`${difficulty}: one solution, the right number of clues, and a valid answer`, () => {
      const { puzzle, solution } = makePuzzle(difficulty, seeded(7))
      expect(valid(solution)).toBe(true)
      expect(solve([...puzzle], 2)).toBe(1)
      expect(puzzle.filter(Boolean).length).toBe(DIFFICULTIES[difficulty])
      expect(puzzle.every((v, c) => v === 0 || v === solution[c])).toBe(true)
    })
  }

  test('the same seed makes the same puzzle; another seed, another', () => {
    expect(makePuzzle('easy', seeded(1)).puzzle).toEqual(makePuzzle('easy', seeded(1)).puzzle)
    expect(makePuzzle('easy', seeded(1)).puzzle).not.toEqual(makePuzzle('easy', seeded(2)).puzzle)
  })
})

describe('solve', () => {
  test('an empty board has many solutions, a broken one none', () => {
    expect(
      solve(
        Array.from({ length: 81 }, () => 0),
        2,
      ),
    ).toBe(2)
    const broken = Array.from({ length: 81 }, () => 0)
    broken[0] = 5
    broken[1] = 5
    expect(solve(broken, 2)).toBe(0)
  })

  test('the solution is written into the board', () => {
    const { puzzle, solution } = makePuzzle('medium', seeded(3))
    const board = [...puzzle]
    solve(board, 1)
    expect(board).toEqual(solution)
  })
})

test('progress counts the right numbers in the empty cells', () => {
  const { puzzle, solution } = makePuzzle('easy', seeded(4))
  const board = [...puzzle]
  const empty = puzzle.flatMap((v, c) => (v ? [] : [c]))
  board[empty[0]] = solution[empty[0]]
  board[empty[1]] = (solution[empty[1]] % 9) + 1
  expect(progress(puzzle, board, solution)).toEqual({ done: 1, of: 41 })
})

test('conflicts are digits repeated in a row, column or box', async () => {
  const { conflicts } = await import('./engine')
  const b = Array.from({ length: 81 }, () => 0)
  b[0] = 5
  b[8] = 5 // same row
  b[40] = 7
  b[41] = 3
  expect([...conflicts(b)].sort((x, y) => x - y)).toEqual([0, 8])
  b[10] = 5 // same box as cell 0
  expect([...conflicts(b)].sort((x, y) => x - y)).toEqual([0, 8, 10])
})
