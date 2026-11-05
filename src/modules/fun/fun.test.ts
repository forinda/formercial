import type { AddressInfo } from 'node:net'
import { Application, errorHandler, expressRuntime } from '@forinda/kickjs'
import { WsAdapter } from '@forinda/kickjs-ws'
import express from 'express'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { WebSocket } from 'ws'
import { localOnly } from '@/middleware/local-only'
import { FunModule } from './fun.module'

let app: Application
let base: string

beforeAll(async () => {
  app = new Application({
    modules: [FunModule()],
    runtime: expressRuntime(),
    middlewares: [localOnly(), express.json({ limit: '2kb' })],
    adapters: [WsAdapter({ path: '/ws', heartbeatInterval: 0 })],
    onError: errorHandler(),
    port: 0,
  })
  await app.start()
  base = `127.0.0.1:${(app.getHttpServer()!.address() as AddressInfo).port}`
})
afterAll(() => app.shutdown())

const post = (path: string, body: unknown) =>
  fetch(`http://${base}/api/v1/fun${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

/** A socket to a room, collecting what the server sends. */
function connect(code: string, token: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(`ws://${base}/ws/fun?code=${code}&token=${token}`, { headers })
  const inbox: { event: string; data: any }[] = []
  const waiters: (() => void)[] = []
  ws.on('message', (m) => {
    inbox.push(JSON.parse(String(m)))
    waiters.splice(0).forEach((w) => w())
  })
  const closed = new Promise<{ code: number; reason: string }>((done) =>
    ws.on('close', (c, r) => done({ code: c, reason: String(r) })),
  )
  /** The next message of this kind, waiting for it if it hasn't come yet. */
  const next = async (event: string) => {
    for (;;) {
      const i = inbox.findIndex((m) => m.event === event)
      if (i >= 0) return inbox.splice(i, 1)[0].data
      await new Promise<void>((w) => waiters.push(w))
    }
  }
  const send = (event: string, data: unknown) =>
    ws.readyState === ws.OPEN
      ? ws.send(JSON.stringify({ event, data }))
      : ws.once('open', () => ws.send(JSON.stringify({ event, data })))
  return { ws, next, send, closed }
}

async function room() {
  const made = await post('/rooms', { game: 'sudoku', options: { mode: 'together' }, name: 'Host' })
  expect(made.status).toBe(201)
  return (await made.json()) as { code: string; player: { id: string; token: string } }
}

describe('Fun Club over HTTP', () => {
  test('lists its games, and makes and joins rooms', async () => {
    const games = await (await fetch(`http://${base}/api/v1/fun/games`)).json()
    expect(games.map((g: { id: string }) => g.id)).toEqual(['sudoku'])
    const { code } = await room()
    expect((await post(`/rooms/${code}/join`, { name: 'Guest' })).status).toBe(200)
    expect((await post('/rooms/ZZZZZZ/join', { name: 'G' })).status).toBe(404)
    expect((await post('/rooms', { game: 'chess', name: 'A' })).status).toBe(404)
    expect((await post('/rooms', { game: 'sudoku', name: '' })).status).toBe(400)
  })
})

describe('Fun Club over the WebSocket', () => {
  test('a player gets the room on connect, and every move is answered and shared', async () => {
    const { code, player } = await room()
    const guest = (await (await post(`/rooms/${code}/join`, { name: 'Guest' })).json()).player
    const host = connect(code, player.token)
    const other = connect(code, guest.token)
    const first = await host.next('room')
    expect(first.players.map((p: { name: string }) => p.name)).toEqual(['Host', 'Guest'])
    await other.next('room')

    const given = first.state.puzzle.findIndex((v: number) => v !== 0)
    host.send('sudoku:place', { cell: given, value: 1 })
    expect(await host.next('sudoku:place:result')).toEqual({
      ok: false,
      error: 'that number is part of the puzzle',
    })
    host.send('sudoku:place', { cell: 999, value: 1 })
    expect(await host.next('sudoku:place:result')).toEqual({
      ok: false,
      error: 'that is not valid for this game',
    })
    host.send('chess:castle', {})
    expect(await host.next('chess:castle:result')).toEqual({
      ok: false,
      error: 'that is not an event of this game',
    })

    const empty = first.state.puzzle.findIndex((v: number) => v === 0)
    host.send('sudoku:note', { cell: empty, digits: [4] })
    expect(await host.next('sudoku:note:result')).toEqual({ ok: true })
    const wrong = first.state.puzzle.findIndex((v: number) => v === 0)
    host.send('sudoku:place', { cell: wrong, value: 10 })
    expect((await host.next('sudoku:place:result')).ok).toBe(false)
    // The other player hears every change, but never the host's pencil marks.
    const seen = await other.next('room')
    expect(seen.state.notes).toEqual({})
    host.ws.close()
    other.ws.close()
  })

  test('a wrong token, or a page from another site, is hung up on', async () => {
    const { code, player } = await room()
    expect((await connect(code, 'nope').closed).code).toBe(4404)
    const foreign = connect(code, player.token, { origin: 'http://evil.example' })
    expect(await foreign.closed).toEqual({ code: 4403, reason: 'only from this machine' })
  })
})
