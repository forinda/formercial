// Rooms for any game: a code to share, players with secret tokens, and the
// game's state. Everything a player sends is checked here or by the game.
import { randomBytes, randomInt } from 'node:crypto'
import type { AnyGame, PlayerId } from './game'

export class RoomError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

type Player = { id: PlayerId; token: string; name: string }
type Room = {
  code: string
  game: AnyGame
  state: unknown
  players: Player[]
  touched: number
  listeners: Set<() => void>
}

// No 0/O or 1/I/L, so a code read out loud isn't misheard.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE = /^[A-HJ-KM-NP-Z2-9]{6}$/

/** A display name: printable, trimmed, 1 to 20 characters. */
export function cleanName(name: unknown): string {
  const clean = String(name ?? '')
    .replace(/[\p{C}]/gu, '')
    .trim()
    .slice(0, 20)
  if (!clean) throw new RoomError(400, 'a name is required')
  return clean
}

export type RoomsOptions = {
  maxRooms?: number
  idleMs?: number
  now?: () => number
  random?: () => number
}

export function createRooms(games: AnyGame[], opts: RoomsOptions = {}) {
  const byId = new Map(games.map((g) => [g.id, g]))
  const rooms = new Map<string, Room>()
  const maxRooms = opts.maxRooms ?? 100
  const idleMs = opts.idleMs ?? 2 * 60 * 60 * 1000
  const now = opts.now ?? Date.now
  const random = opts.random ?? Math.random

  const room = (code: string) => {
    const r = CODE.test(code) ? rooms.get(code) : undefined
    if (!r) throw new RoomError(404, 'no room with that code')
    return r
  }
  const player = (r: Room, token: unknown) => {
    const p = typeof token === 'string' ? r.players.find((x) => x.token === token) : undefined
    if (!p) throw new RoomError(403, 'not a player in this room')
    return p
  }
  const changed = (r: Room) => {
    r.touched = now()
    for (const fn of r.listeners) fn()
  }
  const addPlayer = (r: Room, name: unknown) => {
    if (r.players.length >= r.game.maxPlayers) throw new RoomError(409, 'this room is full')
    const p: Player = {
      id: randomBytes(6).toString('hex'),
      token: randomBytes(24).toString('hex'),
      name: cleanName(name),
    }
    r.players.push(p)
    r.game.join(r.state, p.id)
    return p
  }

  return {
    games: () =>
      games.map(({ id, title, description, maxPlayers, lobby, events }) => ({
        id,
        title,
        description,
        maxPlayers,
        lobby,
        events: Object.keys(events),
      })),
    size: () => rooms.size,

    create(gameId: unknown, options: unknown, name: unknown) {
      const game = typeof gameId === 'string' ? byId.get(gameId) : undefined
      if (!game) throw new RoomError(404, 'no such game')
      const parsed = game.options.safeParse(options ?? {})
      if (!parsed.success) throw new RoomError(400, 'those options are not valid for this game')
      cleanName(name)
      this.sweep()
      if (rooms.size >= maxRooms) throw new RoomError(503, 'the server is full, try again later')
      let code = ''
      do code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
      while (rooms.has(code))
      const r: Room = {
        code,
        game,
        state: game.create(parsed.data, random),
        players: [],
        touched: now(),
        listeners: new Set(),
      }
      rooms.set(code, r)
      const p = addPlayer(r, name)
      return { code, player: { id: p.id, token: p.token } }
    },

    join(code: string, name: unknown) {
      const r = room(code)
      const p = addPlayer(r, name)
      changed(r)
      return { player: { id: p.id, token: p.token } }
    },

    /** A player sends one of the game's own events; the game handles it. */
    act(code: string, token: unknown, event: unknown, data: unknown) {
      const r = room(code)
      const p = player(r, token)
      const handler =
        typeof event === 'string' && Object.hasOwn(r.game.events, event)
          ? r.game.events[event]
          : undefined
      if (!handler) throw new RoomError(404, `${r.game.title} has no such event`)
      if (r.game.done(r.state)) throw new RoomError(409, 'this game is over')
      const parsed = handler.data.safeParse(data)
      if (!parsed.success) throw new RoomError(400, 'that is not valid for this game')
      const result = handler.handle(r.state, p.id, parsed.data, now())
      changed(r)
      return result
    },

    /** Which game a room plays, for a player of it. */
    gameOf(code: string, token: unknown) {
      const r = room(code)
      player(r, token)
      return r.game.id
    },

    /** What one player sees: the room, its players by name, and the game's view for them. */
    view(code: string, token: unknown) {
      const r = room(code)
      const p = player(r, token)
      return {
        code: r.code,
        game: r.game.id,
        you: p.id,
        players: r.players.map(({ id, name }) => ({ id, name })),
        done: r.game.done(r.state),
        state: r.game.view(r.state, p.id),
      }
    },

    /** Call `fn` whenever the room changes; returns the way to stop. */
    watch(code: string, token: unknown, fn: () => void, maxWatchers = 16) {
      const r = room(code)
      player(r, token)
      if (r.listeners.size >= maxWatchers) throw new RoomError(429, 'too many open connections')
      r.listeners.add(fn)
      return () => r.listeners.delete(fn)
    },

    /** Close rooms nobody has played in for a while; open connections hear it and close. */
    sweep() {
      const cutoff = now() - idleMs
      for (const [code, r] of rooms) {
        if (r.touched >= cutoff) continue
        rooms.delete(code)
        for (const fn of r.listeners) fn()
        r.listeners.clear()
      }
    },
  }
}

export type Rooms = ReturnType<typeof createRooms>

/** At most `limit` hits per key in each `windowMs`. */
export function rateLimit(limit: number, windowMs: number, now = Date.now) {
  const hits = new Map<string, { n: number; since: number }>()
  return (key: string) => {
    const t = now()
    const h = hits.get(key)
    if (!h || t - h.since >= windowMs) {
      hits.set(key, { n: 1, since: t })
      if (hits.size > 10_000) for (const [k, v] of hits) if (t - v.since >= windowMs) hits.delete(k)
      return true
    }
    h.n++
    return h.n <= limit
  }
}
