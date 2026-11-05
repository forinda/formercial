import { describe, expect, test } from 'vitest'
import { solve } from './games/sudoku/engine'
import { sudoku } from './games/sudoku/game'
import { CODE, RoomError, cleanName, createRooms } from './rooms'

type SudokuView = {
  puzzle: number[]
  board: number[]
  notes: Record<number, number[]>
  full: boolean
  canUndo: boolean
  players: { id: string; filled: number; of: number; finished: number | null }[]
  winner: string | null
}

function setup(mode: 'together' | 'race', opts = {}) {
  let clock = 1000
  const rooms = createRooms([sudoku], { now: () => clock, ...opts })
  const { code, player: host } = rooms.create('sudoku', { mode, difficulty: 'easy' }, 'Host')
  const view = (token: string) => rooms.view(code, token).state as SudokuView
  // The answer, worked out from what a player sees: the room never hands it out.
  const answer = [...view(host.token).puzzle]
  solve(answer, 1)
  const empty = view(host.token).puzzle.flatMap((v, c) => (v ? [] : [c]))
  return { rooms, code, host, view, answer, empty, tick: (ms: number) => (clock += ms) }
}

const errorOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (err) {
    return err instanceof RoomError ? `${err.status} ${err.message}` : String(err)
  }
  return 'no error'
}

describe('rooms', () => {
  test('a room has a six-letter code to share, and players join with a name', () => {
    const { rooms, code, host } = setup('together')
    expect(code).toMatch(CODE)
    const { player } = rooms.join(code, '  Guest\u0007 ')
    const v = rooms.view(code, player.token)
    expect(v.players.map((p) => p.name)).toEqual(['Host', 'Guest'])
    expect(v.you).toBe(player.id)
    expect(player.token).not.toBe(host.token)
  })

  test('codes, tokens and names are checked', () => {
    const { rooms, code } = setup('together')
    expect(errorOf(() => rooms.view('NOPE00', 'x'))).toBe('404 no room with that code')
    expect(errorOf(() => rooms.view(code, 'not-a-token'))).toBe('403 not a player in this room')
    expect(errorOf(() => rooms.join(code, '   '))).toBe('400 a name is required')
    expect(cleanName('x'.repeat(50))).toHaveLength(20)
    expect(errorOf(() => rooms.create('chess', {}, 'A'))).toBe('404 no such game')
    expect(errorOf(() => rooms.create('sudoku', { difficulty: 'impossible' }, 'A'))).toBe(
      '400 those options are not valid for this game',
    )
  })

  test('a room holds at most its game’s players, and the server at most its rooms', () => {
    const { rooms, code } = setup('race', { maxRooms: 2 })
    for (let i = 0; i < 7; i++) rooms.join(code, `P${i}`)
    expect(errorOf(() => rooms.join(code, 'One too many'))).toBe('409 this room is full')
    rooms.create('sudoku', {}, 'B')
    expect(errorOf(() => rooms.create('sudoku', {}, 'C'))).toBe(
      '503 the server is full, try again later',
    )
  })

  test('a room nobody plays in closes, and anyone watching it hears', () => {
    const { rooms, code, host, tick } = setup('together')
    let heard = 0
    rooms.watch(code, host.token, () => heard++)
    tick(2 * 60 * 60 * 1000 + 1)
    rooms.sweep()
    expect(heard).toBe(1)
    expect(errorOf(() => rooms.view(code, host.token))).toBe('404 no room with that code')
  })
})

describe('sudoku', () => {
  test('any digit goes in, like on paper, and can be cleared or undone', () => {
    const { rooms, code, host, view, answer, empty } = setup('together')
    const at = empty[0]
    const wrong = (answer[at] % 9) + 1
    expect(rooms.act(code, host.token, 'place', { cell: at, value: wrong })).toEqual({ ok: true })
    expect(view(host.token).board[at]).toBe(wrong)
    rooms.act(code, host.token, 'place', { cell: at, value: answer[at] })
    expect(rooms.act(code, host.token, 'undo', {})).toEqual({ ok: true })
    expect(view(host.token).board[at]).toBe(wrong)
    rooms.act(code, host.token, 'clear', { cell: at })
    expect(view(host.token).board[at]).toBe(0)
    rooms.act(code, host.token, 'undo', {})
    rooms.act(code, host.token, 'undo', {})
    expect(view(host.token).board[at]).toBe(0)
    expect(rooms.act(code, host.token, 'undo', {})).toEqual({
      ok: false,
      error: 'nothing of yours to undo',
    })
    const given = view(host.token).puzzle.findIndex(Boolean)
    expect(rooms.act(code, host.token, 'place', { cell: given, value: 1 })).toEqual({
      ok: false,
      error: 'that number is part of the puzzle',
    })
  })

  test('progress counts filled cells, so it never gives away which ones are right', () => {
    const { rooms, code, host, view, answer, empty } = setup('race')
    rooms.act(code, host.token, 'place', { cell: empty[0], value: (answer[empty[0]] % 9) + 1 })
    rooms.act(code, host.token, 'place', { cell: empty[1], value: answer[empty[1]] })
    expect(view(host.token).players[0]).toMatchObject({ filled: 2, of: 41 })
  })

  test('together, undo takes back only your own move, skipping cells others changed since', () => {
    const { rooms, code, host, view, empty } = setup('together')
    const { player: guest } = rooms.join(code, 'Guest')
    rooms.act(code, host.token, 'place', { cell: empty[0], value: 1 })
    rooms.act(code, host.token, 'place', { cell: empty[1], value: 2 })
    rooms.act(code, guest.token, 'place', { cell: empty[1], value: 3 })
    rooms.act(code, host.token, 'undo', {})
    // The guest's 3 stays; the host's earlier 1 is what comes back out.
    expect(view(host.token).board[empty[1]]).toBe(3)
    expect(view(host.token).board[empty[0]]).toBe(0)
  })

  test('a full board that is wrong says so, but not where; a right one finishes', () => {
    const { rooms, code, host, view, answer, empty } = setup('together')
    const [first, ...rest] = empty
    rooms.act(code, host.token, 'place', { cell: first, value: (answer[first] % 9) + 1 })
    for (const at of rest) rooms.act(code, host.token, 'place', { cell: at, value: answer[at] })
    expect(view(host.token).full).toBe(true)
    expect(rooms.view(code, host.token).done).toBe(false)
    rooms.act(code, host.token, 'place', { cell: first, value: answer[first] })
    expect(view(host.token).full).toBe(false)
    expect(rooms.view(code, host.token).done).toBe(true)
    expect(errorOf(() => rooms.act(code, host.token, 'clear', { cell: first }))).toBe(
      '409 this game is over',
    )
  })

  test('racing, you see your own board and only how far the others are', () => {
    const { rooms, code, host, view, answer, empty, tick } = setup('race')
    const { player: guest } = rooms.join(code, 'Guest')
    rooms.act(code, host.token, 'place', { cell: empty[0], value: answer[empty[0]] })
    expect(view(guest.token).board[empty[0]]).toBe(0)
    expect(view(guest.token).players.map((p) => p.filled)).toEqual([1, 0])
    for (const at of empty.slice(1)) {
      tick(10)
      rooms.act(code, host.token, 'place', { cell: at, value: answer[at] })
    }
    expect(view(guest.token).winner).toBe(rooms.view(code, host.token).you)
    expect(rooms.view(code, host.token).done).toBe(false)
    expect(rooms.act(code, host.token, 'place', { cell: empty[0], value: 1 })).toEqual({
      ok: false,
      error: 'you have already finished',
    })
  })

  test('pencil marks are each player’s own, and a placed number clears them', () => {
    const { rooms, code, host, view, empty } = setup('together')
    const { player: guest } = rooms.join(code, 'Guest')
    const at = empty[0]
    expect(rooms.act(code, host.token, 'note', { cell: at, digits: [7, 3, 3] })).toEqual({
      ok: true,
    })
    expect(view(host.token).notes).toEqual({ [at]: [3, 7] })
    expect(view(guest.token).notes).toEqual({})
    rooms.act(code, host.token, 'place', { cell: at, value: 5 })
    expect(view(host.token).notes).toEqual({})
    expect(rooms.act(code, host.token, 'note', { cell: at, digits: [1] })).toEqual({
      ok: false,
      error: 'pencil marks go in empty cells',
    })
  })

  test('only the game’s own events are taken', () => {
    const { rooms, code, host } = setup('together')
    expect(errorOf(() => rooms.act(code, host.token, 'cheat', {}))).toBe(
      '404 Sudoku has no such event',
    )
    expect(errorOf(() => rooms.act(code, host.token, '__proto__', {}))).toBe(
      '404 Sudoku has no such event',
    )
    expect(errorOf(() => rooms.act(code, host.token, 'place', { cell: 1, value: 0 }))).toBe(
      '400 that is not valid for this game',
    )
  })

  test('no view ever holds the answer', () => {
    const { rooms, code, host, answer } = setup('race')
    expect(JSON.stringify(rooms.view(code, host.token))).not.toContain(JSON.stringify(answer))
    expect(Object.keys(rooms.view(code, host.token).state as object)).not.toContain('solution')
  })
})
