// A player's token for a room, kept in this tab only: closing the tab leaves the seat.
export type Seat = { id: string; token: string }

export const loadSeat = (code: string): Seat | null => {
  try {
    return JSON.parse(sessionStorage.getItem(`fun:${code}`) ?? 'null')
  } catch {
    return null
  }
}

export const saveSeat = (code: string, seat: Seat) => {
  try {
    sessionStorage.setItem(`fun:${code}`, JSON.stringify(seat))
  } catch {
    // Private windows may refuse: the seat lasts until the page reloads.
  }
}

/** What the server sends a player about their room. */
export type RoomView<S = unknown> = {
  code: string
  game: string
  you: string
  players: { id: string; name: string }[]
  done: boolean
  state: S
}
