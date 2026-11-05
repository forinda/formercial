// Playing a Fun Club room, live, at /ws/fun?code=ABC234&token=...
// Players send their game's own events; the server sends `room` whenever it changes.
// One controller serves every socket, so what belongs to a connection lives on its ctx.
// Upgrades skip the middleware chain: this checks local-only itself, then the room.
import {
  OnConnect,
  OnDisconnect,
  OnMessage,
  WsController,
  type WsContext,
} from '@forinda/kickjs-ws'
import { RoomError } from '@/fun/rooms'
import { isLocalRequest } from '@/middleware/local-only'
import { FunRooms } from './fun-rooms.service'

type Seat = { code: string; token: string; stop: () => void }

@WsController('/fun')
export class FunSocket {
  constructor(private readonly fun: FunRooms) {}

  @OnConnect()
  connect(ctx: WsContext) {
    if (!isLocalRequest(ctx.request)) return ctx.socket.close(4403, 'only from this machine')
    const q = new URL(ctx.request.url ?? '/', 'http://local').searchParams
    const code = String(q.get('code') ?? '').toUpperCase()
    const token = String(q.get('token') ?? '')
    const push = () => {
      try {
        ctx.send('room', this.fun.rooms.view(code, token))
      } catch {
        // The room closed: say so, and hang up.
        ctx.send('gone', {})
        ctx.socket.close(1000, 'room closed')
      }
    }
    try {
      const stop = this.fun.rooms.watch(code, token, push)
      ctx.set('seat', { code, token, stop } satisfies Seat)
    } catch (err) {
      return ctx.socket.close(4404, err instanceof RoomError ? err.message : 'no room')
    }
    push()
  }

  /**
   * Every game's own events: `<game>:<event>`, like sudoku:place. Each one is
   * answered on `<game>:<event>:result`; the room's change reaches everyone as `room`.
   */
  @OnMessage('*')
  act(ctx: WsContext) {
    const seat = ctx.get('seat') as Seat | undefined
    if (!seat) return
    const reply = (result: unknown) => ctx.send(`${ctx.event}:result`, result)
    const [game, event, ...rest] = String(ctx.event).split(':')
    try {
      if (rest.length || game !== this.fun.rooms.gameOf(seat.code, seat.token))
        return reply({ ok: false, error: 'that is not an event of this game' })
      if (!this.fun.moving(seat.token)) return reply({ ok: false, error: 'slow down' })
      reply(this.fun.rooms.act(seat.code, seat.token, event, ctx.data))
    } catch (err) {
      reply({ ok: false, error: err instanceof RoomError ? err.message : 'that did not work' })
    }
  }

  @OnDisconnect()
  disconnect(ctx: WsContext) {
    ;(ctx.get('seat') as Seat | undefined)?.stop()
  }
}
