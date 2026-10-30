// Every step the project has been through. Restoring one keeps the rest.
import { IconCheck, IconRestore, IconTag } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { IconButton } from './icon-button'
import { api } from './useProject'

type Revision = {
  id: number
  source: string
  summary: string
  label: string | null
  createdAt: number
}

const WHO: Record<string, string> = {
  editor: 'you',
  app: 'the app',
  cli: 'command line',
  agent: 'an agent',
  outside: 'outside the app',
}

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function HistoryPanel(props: {
  slug: string
  /** Any new version means there's a new step to show. */
  version: string
  onRestore(id: number): void
}) {
  const { slug } = props
  const [data, setData] = useState<{ current: number | null; revisions: Revision[] } | null>(null)
  const [naming, setNaming] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api<{ current: number | null; revisions: Revision[] }>(`/api/v1/projects/${slug}/history`).then(
      setData,
      (err: Error) => setError(err.message),
    )
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, props.version])

  async function saveName(id: number) {
    setNaming(null)
    await api(`/api/v1/projects/${slug}/history/${id}/label`, {
      method: 'PUT',
      json: { label: name },
    }).catch((err: Error) => setError(err.message))
    await load()
  }

  if (error) return <p className="text-destructive">{error}</p>
  if (!data) return <p className="text-muted-foreground">Loading history…</p>
  return (
    <section aria-label="History" className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Every change is kept on this machine. Restoring a step keeps the ones after it, and doesn't
        touch voice clips, media or renders.
      </p>
      <ol className="grid divide-y border-y">
        {data.revisions.map((r) => {
          const current = r.id === data.current
          return (
            <li key={r.id} className="grid gap-1.5 py-2">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p className={current ? 'font-medium' : undefined}>
                    {r.summary}
                    {r.label && (
                      <span className="ml-1.5 rounded-sm bg-secondary px-1 text-xs font-medium">
                        {r.label}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {when(r.createdAt)}, {WHO[r.source] ?? r.source}
                    {current ? ', current' : ''}
                  </p>
                </div>
                <IconButton
                  label={r.label ? 'Rename this step' : 'Name this step'}
                  onClick={() => {
                    setName(r.label ?? '')
                    setNaming(r.id)
                  }}
                >
                  <IconTag />
                </IconButton>
                <IconButton
                  label="Restore this step"
                  disabled={current}
                  onClick={() => props.onRestore(r.id)}
                >
                  <IconRestore />
                </IconButton>
              </div>
              {naming === r.id && (
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveName(r.id)
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Name for this step"
                    placeholder="v1, or leave empty to clear"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    <IconCheck />
                    Save name
                  </Button>
                </form>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
