// Making and joining Fun Club rooms. Playing happens over the WebSocket (fun.ws.ts).
import { Controller, Get, HttpException, Post, reply, type RequestContext } from '@forinda/kickjs'
import { RoomError } from '@/fun/rooms'
import { FunRooms } from './fun-rooms.service'

/** Room errors carry the HTTP status they mean. */
const http = <T>(fn: () => T): T => {
  try {
    return fn()
  } catch (err) {
    if (err instanceof RoomError) throw new HttpException(err.status, err.message)
    throw err
  }
}

@Controller()
export class FunController {
  constructor(private readonly fun: FunRooms) {}

  @Get('/games')
  games() {
    return this.fun.rooms.games()
  }

  @Post('/rooms')
  create(ctx: RequestContext) {
    if (!this.fun.creating(ctx.ip ?? '?'))
      throw new HttpException(429, 'too many new rooms, wait a minute')
    const body = ctx.body ?? {}
    return reply.created(http(() => this.fun.rooms.create(body.game, body.options, body.name)))
  }

  @Post('/rooms/:code/join')
  join(ctx: RequestContext) {
    if (!this.fun.joining(ctx.ip ?? '?'))
      throw new HttpException(429, 'too many tries, wait a minute')
    return http(() => this.fun.rooms.join(String(ctx.params.code).toUpperCase(), ctx.body?.name))
  }
}
