import { Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Sections } from '@/client/components/sections'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { api } from '@/client/editor/useProject'

type MemeSummary = { id: string; name: string; size: string; media?: string }

export default function Memes({ memes }: { memes: MemeSummary[] }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { id } = await api<{ id: string }>('/api/v1/memes', { method: 'POST', json: { name } })
      router.visit(`/memes/${id}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Sections current="memes" />
      <h1 className="sr-only">Memes</h1>
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-sm">
          New meme
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Its name" />
        </label>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </Button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </form>
      {memes.length === 0 ? (
        <p className="text-muted-foreground">No memes yet. Name one above to start.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {memes.map((m) => (
            <li key={m.id}>
              <Link
                href={`/memes/${m.id}`}
                className="grid gap-2 rounded-lg border p-2 hover:border-primary"
              >
                {m.media ? (
                  <img
                    src={`/api/v1/memes/${m.id}/file?path=${encodeURIComponent(m.media)}`}
                    alt=""
                    className="aspect-square w-full rounded object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded bg-secondary" />
                )}
                <span className="truncate text-sm font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.size}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
