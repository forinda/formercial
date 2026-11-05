// Sudoku: boards are 81 numbers, row by row, 0 for an empty cell. Puzzles are
// made by filling a grid at random, then taking numbers out one at a time while
// the puzzle still has exactly one solution.

export const DIFFICULTIES = { easy: 40, medium: 32, hard: 27 } as const
export type Difficulty = keyof typeof DIFFICULTIES
export type Board = number[]

const shuffle = <T>(list: T[], random: () => number) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

const boxOf = (cell: number) =>
  Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3)

/**
 * Count solutions, stopping at `limit`. Fills the most constrained cell first,
 * so a well-posed puzzle is answered quickly. The first solution found is written
 * into `board`; with `random`, digits are tried in a random order.
 */
export function solve(board: Board, limit = 2, random?: () => number): number {
  const work = [...board]
  const rows = Array.from({ length: 9 }, () => 0)
  const cols = Array.from({ length: 9 }, () => 0)
  const boxes = Array.from({ length: 9 }, () => 0)
  for (let c = 0; c < 81; c++) {
    if (!work[c]) continue
    const bit = 1 << work[c]
    // A board that already breaks the rules has no solution.
    if ((rows[Math.floor(c / 9)] | cols[c % 9] | boxes[boxOf(c)]) & bit) return 0
    rows[Math.floor(c / 9)] |= bit
    cols[c % 9] |= bit
    boxes[boxOf(c)] |= bit
  }
  let found = 0
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const step = (): boolean => {
    let best = -1
    let bestFree = 0
    let bestCount = 10
    for (let c = 0; c < 81; c++) {
      if (work[c]) continue
      const free = ~(rows[Math.floor(c / 9)] | cols[c % 9] | boxes[boxOf(c)]) & 0x3fe
      let count = 0
      for (let v = free; v; v &= v - 1) count++
      if (count < bestCount) {
        best = c
        bestFree = free
        bestCount = count
        if (count <= 1) break
      }
    }
    if (best < 0) {
      found++
      if (found === 1) board.splice(0, 81, ...work)
      return found >= limit
    }
    const r = Math.floor(best / 9)
    const col = best % 9
    const b = boxOf(best)
    for (const v of random ? shuffle([...digits], random) : digits) {
      const bit = 1 << v
      if (!(bestFree & bit)) continue
      work[best] = v
      rows[r] |= bit
      cols[col] |= bit
      boxes[b] |= bit
      if (step()) return true
      work[best] = 0
      rows[r] &= ~bit
      cols[col] &= ~bit
      boxes[b] &= ~bit
    }
    return false
  }
  step()
  return found
}

/** A puzzle with exactly one solution, and that solution. */
export function makePuzzle(
  difficulty: Difficulty,
  random: () => number = Math.random,
): { puzzle: Board; solution: Board } {
  const solution: Board = Array.from({ length: 81 }, () => 0)
  solve(solution, 1, random)
  const puzzle = [...solution]
  const want = DIFFICULTIES[difficulty]
  let clues = 81
  for (const cell of shuffle([...Array(81).keys()], random)) {
    if (clues <= want) break
    const keep = puzzle[cell]
    puzzle[cell] = 0
    if (solve([...puzzle], 2) === 1) clues--
    else puzzle[cell] = keep
  }
  return { puzzle, solution }
}

/** How many of the puzzle's empty cells hold the right number. */
export function progress(puzzle: Board, board: Board, solution: Board) {
  let done = 0
  let of = 0
  for (let c = 0; c < 81; c++) {
    if (puzzle[c]) continue
    of++
    if (board[c] === solution[c]) done++
  }
  return { done, of }
}

/** Cells whose digit appears again in their row, column or box: rule breaks, not answers. */
export function conflicts(board: Board): Set<number> {
  const out = new Set<number>()
  for (let a = 0; a < 81; a++) {
    if (!board[a]) continue
    for (let b = a + 1; b < 81; b++) {
      if (board[b] !== board[a]) continue
      const sameRow = Math.floor(a / 9) === Math.floor(b / 9)
      const sameCol = a % 9 === b % 9
      if (sameRow || sameCol || boxOf(a) === boxOf(b)) out.add(a).add(b)
    }
  }
  return out
}
