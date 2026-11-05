// The Fun Club lobby: start a room for a game, or join one by its code.
import { router } from '@inertiajs/react'
import { useState } from 'react'
import { Sections } from '@/client/components/sections'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Select } from '@/client/components/ui/select'
import { api } from '@/client/editor/useProject'
import { saveSeat, type Seat } from '@/client/fun/session'
import { GAME_REGISTRY } from '@/arcade/registry'
import { Link } from '@inertiajs/react'

type Game = {
  id: string
  title: string
  description: string
  maxPlayers: number
  lobby: { key: string; label: string; choices: { value: string; label: string }[] }[]
}

export default function Fun({ games }: { games: Game[] }) {
  const [name, setName] = useState('')
  const [gameId, setGameId] = useState(games[0]?.id ?? '')
  const game = games.find((g) => g.id === gameId)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const enter = (room: string, seat: Seat) => {
    saveSeat(room, seat)
    router.visit(`/fun/${room}`)
  }
  async function start(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const made = await api<{ code: string; player: Seat }>('/api/v1/fun/rooms', {
        method: 'POST',
        json: { game: gameId, options, name },
      })
      enter(made.code, made.player)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  async function join(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const room = code.trim().toUpperCase()
    try {
      const { player } = await api<{ player: Seat }>(
        `/api/v1/fun/rooms/${encodeURIComponent(room)}/join`,
        {
          method: 'POST',
          json: { name },
        },
      )
      enter(room, player)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Sections current="fun" />
      <h1 className="sr-only">Fun Club</h1>
      <label className="grid max-w-sm gap-1 text-sm">
        <span className="text-muted-foreground">Your name</span>
        <Input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={start} className="grid content-start gap-3 rounded-lg border p-4">
          <h2 className="font-semibold">Start a room</h2>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Game</span>
            <Select value={gameId} onChange={(e) => (setGameId(e.target.value), setOptions({}))}>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </label>
          {game && (
            <p className="text-sm text-muted-foreground">
              {game.description} Up to {game.maxPlayers} players.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {game?.lobby.map((f) => (
              <label key={f.key} className="grid gap-1 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <Select
                  value={options[f.key] ?? f.choices[0].value}
                  onChange={(e) => setOptions({ ...options, [f.key]: e.target.value })}
                >
                  {f.choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
          <Button type="submit" disabled={!name.trim() || !game}>
            Start
          </Button>
        </form>
        <form onSubmit={join} className="grid content-start gap-3 rounded-lg border p-4">
          <h2 className="font-semibold">Join a room</h2>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Room code</span>
            <Input
              value={code}
              maxLength={6}
              placeholder="ABC234"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={!name.trim() || code.trim().length !== 6}
          >
            Join
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Rooms run in this app, on this machine, for now: open a second window to play with someone
        beside you. Playing across machines comes with sign-in. Rooms close after two hours without
        a move.
      </p>
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Play solo</h2>
        {Object.entries(GAME_REGISTRY).map(([category, list]) =>
          list.length ? (
            <div key={category} className="grid gap-2">
              <h3 className="text-sm text-muted-foreground capitalize">{category}</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/fun/play/${g.id}`}
                      className="flex h-full items-start gap-3 rounded-lg border p-3 hover:border-primary"
                    >
                      <span aria-hidden className="text-2xl">
                        {g.icon}
                      </span>
                      <span className="grid gap-0.5">
                        <span className="font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{g.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>
    </main>
  )
}
