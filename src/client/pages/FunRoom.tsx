// A Fun Club room: connects to /ws/fun with this tab's seat and draws the game's
// board from what the server sends. Without a seat, it asks for a name and joins.
import { Link } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { Sections } from '@/client/components/sections'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { api } from '@/client/editor/useProject'
import { BOARDS } from '@/client/fun/games'
import { loadSeat, saveSeat, type RoomView, type Seat } from '@/client/fun/session'

export default function FunRoom({ code }: { code: string }) {
  const [seat, setSeat] = useState<Seat | null>(null)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => setSeat(loadSeat(code)), [code])

  useEffect(() => {
    if (!seat) return
    setStatus('Connecting…')
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    const q = new URLSearchParams({ code, token: seat.token })
    const ws = new WebSocket(`${scheme}://${location.host}/ws/fun?${q}`)
    socket.current = ws
    ws.onopen = () => setStatus('')
    ws.onmessage = (e) => {
      const { event, data } = JSON.parse(String(e.data))
      if (event === 'room') setRoom(data)
      else if (event === 'gone') setStatus('This room has closed.')
      else if (String(event).endsWith(':result')) setNote(data.ok ? '' : data.error)
    }
    ws.onclose = (e) => setStatus(e.reason || 'Disconnected.')
    return () => ws.close()
  }, [seat, code])

  // A game's own events go out as `<game>:<event>`, like sudoku:place.
  const send = (event: string, data: unknown) =>
    room && socket.current?.send(JSON.stringify({ event: `${room.game}:${event}`, data }))

  async function join(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { player } = await api<{ player: Seat }>(
        `/api/v1/fun/rooms/${encodeURIComponent(code)}/join`,
        {
          method: 'POST',
          json: { name },
        },
      )
      saveSeat(code, player)
      setSeat(player)
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  const Board = room ? BOARDS[room.game] : undefined
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Sections current="fun" />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/fun" className="text-sm text-muted-foreground hover:text-foreground">
          ← Fun Club
        </Link>
        <h1 className="text-xl font-semibold">
          Room <span className="font-mono tracking-widest">{code}</span>
        </h1>
        {room && (
          <span className="text-sm text-muted-foreground">{room.players.length} in the room</span>
        )}
      </div>
      {!seat && (
        <form onSubmit={join} className="flex max-w-sm items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">Your name, to join</span>
            <Input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="submit" disabled={!name.trim()}>
            Join
          </Button>
        </form>
      )}
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {room && Board ? <Board room={room as never} send={send} note={note} /> : null}
    </main>
  )
}
