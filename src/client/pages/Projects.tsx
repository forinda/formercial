import { Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { TooltipProvider } from '@/client/components/ui/tooltip'
import { ThemeToggle } from '@/client/editor/theme'
import { api } from '@/client/editor/useProject'
import { cn } from '@/client/lib/utils'

type PresetInfo = { id: string; title: string; description: string }

export default function Projects({
  projects,
  presets,
}: {
  projects: { slug: string; name: string }[]
  presets: PresetInfo[]
}) {
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const { slug } = await api<{ slug: string }>('/api/v1/projects', {
        method: 'POST',
        json: { name, preset: preset || undefined },
      })
      router.visit(`/p/${slug}`)
    } catch (err) {
      setError((err as Error).message)
      setCreating(false)
    }
  }
  const starts = [
    { id: '', title: 'One blank scene', description: 'Start from nothing' },
    ...presets,
  ]
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Commercials</h1>
        <TooltipProvider>
          <ThemeToggle />
        </TooltipProvider>
      </header>
      <form onSubmit={create} className="grid gap-4">
        <div className="flex gap-2">
          <label htmlFor="new-name" className="sr-only">
            Name
          </label>
          <Input
            id="new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name, e.g. @forinda/kickjs-db"
          />
          <Button type="submit" disabled={!name.trim() || creating}>
            {creating ? (preset ? 'Getting its fonts…' : 'Creating…') : 'New commercial'}
          </Button>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-muted-foreground">Start from</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {starts.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex cursor-pointer gap-2.5 rounded-md border p-3 hover:bg-card has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  preset === p.id && 'border-primary',
                )}
              >
                <input
                  type="radio"
                  name="preset"
                  className="accent-primary"
                  checked={preset === p.id}
                  onChange={() => setPreset(p.id)}
                />
                <span>
                  <span className="block font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
      {error && <p className="text-destructive">{error}</p>}
      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          No commercials yet. Name one above, or run kick formercial new &lt;name&gt;.
        </p>
      ) : (
        <ul className="grid divide-y border-y">
          {projects.map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/p/${p.slug}`} className="font-medium">
                {p.name}
              </Link>
              <span className="text-xs text-muted-foreground">projects/{p.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
