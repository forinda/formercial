// Sudoku for up to eight. Together: one shared board. Race: everyone gets the same
// puzzle on their own board, sees how far the others are, and the first to finish wins.
// Like on paper, any digit can go anywhere it isn't a clue, and can be cleared or
// undone. The server keeps the answer to itself and only judges a full board: it
// never says whether one number is right, so trying digits until one sticks gets
// you nowhere. Progress counts filled cells, for the same reason.
import { z } from 'zod'
import { defineGame, gameEvent, type PlayerId } from '../../game'
import { DIFFICULTIES, makePuzzle, type Board } from './engine'

type Options = { mode: 'together' | 'race'; difficulty: keyof typeof DIFFICULTIES }
/** One change a player made, so undo can put the cell back. */
type Step = { cell: number; before: number; after: number }
type State = {
  mode: Options['mode']
  difficulty: Options['difficulty']
  puzzle: Board
  solution: Board
  shared: Board
  boards: Record<PlayerId, Board>
  history: Record<PlayerId, Step[]>
  finished: Record<PlayerId, number>
  /** Each player's pencil marks: the digits they're thinking of, by cell. Private to them. */
  notes: Record<PlayerId, Record<number, number[]>>
  order: PlayerId[]
  started: number | null
}

const MAX_HISTORY = 500
const cell = z.number().int().min(0).max(80)
const boardOf = (s: State, p: PlayerId) => (s.mode === 'together' ? s.shared : s.boards[p])
const isFull = (b: Board) => b.every(Boolean)
const isSolved = (s: State, b: Board) => b.every((v, c) => v === s.solution[c])
const filled = (s: State, b: Board) => ({
  filled: b.filter((v, c) => v && !s.puzzle[c]).length,
  of: s.puzzle.filter((v) => !v).length,
})

/** Set a cell and remember how it was; a full, right board finishes the game. */
function change(s: State, p: PlayerId, at: number, value: number, now: number) {
  const board = boardOf(s, p)
  if (board[at] === value) return
  s.started ??= now
  const history = s.history[p]
  history.push({ cell: at, before: board[at], after: value })
  if (history.length > MAX_HISTORY) history.shift()
  board[at] = value
  if (value) delete s.notes[p][at]
  if (isSolved(s, board)) {
    if (s.mode === 'together') for (const id of s.order) s.finished[id] ??= now
    else s.finished[p] = now
  }
}

/** Why a player can't change this cell now, if they can't. */
function blocked(s: State, p: PlayerId, at: number) {
  if (s.finished[p] !== undefined) return 'you have already finished'
  if (s.puzzle[at]) return 'that number is part of the puzzle'
  return null
}

export const sudoku = defineGame({
  id: 'sudoku',
  title: 'Sudoku',
  description: 'Solve one board together, or race on the same puzzle.',
  maxPlayers: 8,
  lobby: [
    {
      key: 'mode',
      label: 'Play',
      choices: [
        { value: 'together', label: 'Together, one board' },
        { value: 'race', label: 'Race, a board each' },
      ],
    },
    {
      key: 'difficulty',
      label: 'Difficulty',
      choices: [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
      ],
    },
  ],
  options: z.object({
    mode: z.enum(['together', 'race']).default('together'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  }),

  create(o: Options, random): State {
    const { puzzle, solution } = makePuzzle(o.difficulty, random)
    return {
      mode: o.mode,
      difficulty: o.difficulty,
      puzzle,
      solution,
      shared: [...puzzle],
      boards: {},
      history: {},
      finished: {},
      notes: {},
      order: [],
      started: null,
    }
  },

  join(s, p) {
    s.boards[p] = [...s.puzzle]
    s.history[p] = []
    s.notes[p] = {}
    s.order.push(p)
  },

  events: {
    /** Put any digit in a cell that isn't a clue, over whatever is there. */
    place: gameEvent<State, { cell: number; value: number }>({
      data: z.object({ cell, value: z.number().int().min(1).max(9) }),
      handle(s, p, d, now) {
        const why = blocked(s, p, d.cell)
        if (why) return { ok: false, error: why }
        change(s, p, d.cell, d.value, now)
        return { ok: true }
      },
    }),
    /** Empty a cell. */
    clear: gameEvent<State, { cell: number }>({
      data: z.object({ cell }),
      handle(s, p, d, now) {
        const why = blocked(s, p, d.cell)
        if (why) return { ok: false, error: why }
        change(s, p, d.cell, 0, now)
        return { ok: true }
      },
    }),
    /**
     * Take back your own last place or clear. Together, if someone has changed that
     * cell since, it's theirs now: that step is skipped and the one before is undone.
     */
    undo: gameEvent<State, Record<string, never>>({
      data: z.object({}).strict(),
      handle(s, p, _d, now) {
        if (s.finished[p] !== undefined) return { ok: false, error: 'you have already finished' }
        const history = s.history[p]
        const board = boardOf(s, p)
        for (let step = history.pop(); step; step = history.pop()) {
          if (board[step.cell] !== step.after) continue
          board[step.cell] = step.before
          s.started ??= now
          return { ok: true }
        }
        return { ok: false, error: 'nothing of yours to undo' }
      },
    }),
    /** Pencil marks: the digits a player is weighing for an empty cell, seen only by them. */
    note: gameEvent<State, { cell: number; digits: number[] }>({
      data: z.object({ cell, digits: z.array(z.number().int().min(1).max(9)).max(9) }),
      handle(s, p, { cell: at, digits }) {
        if (s.puzzle[at] || boardOf(s, p)[at])
          return { ok: false, error: 'pencil marks go in empty cells' }
        const marks = [...new Set(digits)].sort()
        if (marks.length) s.notes[p][at] = marks
        else delete s.notes[p][at]
        return { ok: true }
      },
    }),
  },

  view(s, p) {
    const board = boardOf(s, p)
    const players = s.order.map((id) => ({
      id,
      ...filled(s, boardOf(s, id)),
      finished: s.finished[id] ?? null,
    }))
    const winner =
      s.mode === 'race'
        ? (Object.entries(s.finished).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null)
        : null
    return {
      mode: s.mode,
      difficulty: s.difficulty,
      puzzle: s.puzzle,
      // Your board, or the shared one: never someone else's in a race, never the answer.
      board,
      notes: s.notes[p] ?? {},
      /** Every cell filled but not the solution: something is wrong, though not where. */
      full: isFull(board) && !isSolved(s, board),
      canUndo: s.history[p]?.length > 0,
      started: s.started,
      players,
      winner,
    }
  },

  // Over when everyone has finished: together that's the moment the board is solved.
  done(s) {
    return s.order.length > 0 && s.order.every((id) => s.finished[id] !== undefined)
  },
})
