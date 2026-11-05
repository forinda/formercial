// The Fun Club's rooms, one set for the whole app, swept every few minutes.
import { Service } from '@forinda/kickjs'
import { GAMES } from '@/fun/games'
import { createRooms, rateLimit } from '@/fun/rooms'

@Service()
export class FunRooms {
  readonly rooms = createRooms(GAMES)
  /** Per address: new rooms a minute, joins a minute. Per player: moves a second. */
  readonly creating = rateLimit(10, 60_000)
  readonly joining = rateLimit(30, 60_000)
  readonly moving = rateLimit(15, 1_000)

  constructor() {
    setInterval(() => this.rooms.sweep(), 5 * 60_000).unref()
  }
}
