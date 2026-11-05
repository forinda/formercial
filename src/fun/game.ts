// What every Fun Club game provides on the server. Rooms know nothing about any one
// game: a player sends one of the game's own events, `<game>:<event>` on the socket
// (sudoku:place, sudoku:clear), the room checks its data against that event's
// schema and lets the game handle it, then sends each player the view the game says
// they may see. Each game's board is a React component in src/client/fun/games/.
import type { z } from 'zod'

export type PlayerId = string

/** A choice the lobby offers when a room is made, like a difficulty. */
export type LobbyField = { key: string; label: string; choices: { value: string; label: string }[] }

export type EventResult = { ok: true; note?: string } | { ok: false; error: string }

/** One thing a player can do in a game, with the shape of what they send. */
export type GameEvent<State, Data> = {
  data: z.ZodType<Data>
  handle(state: State, player: PlayerId, data: Data, now: number): EventResult
}

/** A name a game event may have: short, lower case, so `<game>:<event>` stays tidy. */
export const EVENT_NAME = /^[a-z][a-z0-9-]{0,30}$/

export interface GameDef<Options, State, View> {
  id: string
  title: string
  description: string
  maxPlayers: number
  lobby: LobbyField[]
  options: z.ZodType<Options>
  create(options: Options, random: () => number): State
  join(state: State, player: PlayerId): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: Record<string, GameEvent<State, any>>
  /** Only what this player may see: never the answers, never another's hidden board. */
  view(state: State, player: PlayerId): View
  done(state: State): boolean
}

// Each game types its own; the server holds them all as one kind.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDef<any, any, any>

/** Types one event's data from its schema, so its handler gets the parsed shape. */
export const gameEvent = <State, Data>(e: GameEvent<State, Data>) => e

export const defineGame = <O, S, V>(game: GameDef<O, S, V>) => {
  for (const name of Object.keys(game.events))
    if (!EVENT_NAME.test(name)) throw new Error(`${game.id}: event name "${name}" is not allowed`)
  return game
}
