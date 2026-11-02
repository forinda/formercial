import { Link, router, usePage } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import { TooltipProvider } from '@/client/components/ui/tooltip'
import { ThemeToggle } from '@/client/editor/theme'
import { api } from '@/client/editor/useProject'
import { cn } from '@/client/lib/utils'
import type { ProjectSummary } from '@/core/storage/workspace'
import { pageOf, searchProjects } from './project-list'

type PresetInfo = ProjectSummary & { id: string; title: string; description: string }
type Tab = 'projects' | 'templates'
type View = 'cards' | 'table'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * A still from the project's latest render, or, before anything is rendered,
 * its name on its own colors. `render: false` skips asking, for templates.
 */
function Thumb({
  slug,
  name,
  colors,
  render = true,
  className,
}: ProjectSummary & { render?: boolean; className?: string }) {
  const [failed, setFailed] = useState(!render)
  return (
    <div
      className={cn('relative aspect-video overflow-hidden rounded-md border', className)}
      style={{ background: colors?.bg ?? 'var(--muted)' }}
    >
      {failed ? (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center p-2 text-center text-sm leading-tight font-semibold"
          style={{ color: colors?.accent ?? 'var(--foreground)' }}
        >
          {name}
        </span>
      ) : (
        <img
          src={`/api/v1/projects/${slug}/thumbnail`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  )
}

const details = (p: ProjectSummary) =>
  [p.scenes !== undefined && plural(p.scenes, 'scene'), p.formats?.join(', ')]
    .filter(Boolean)
    .join(' · ')

export default function Projects({
  projects,
  presets,
}: {
  projects: ProjectSummary[]
  presets: PresetInfo[]
}) {
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  // Tab, view, search and page live in the address, so reload and Back keep your place.
  // On the client that's the browser's address: after replaceState, Inertia's stored
  // page still has the old one. The server has only Inertia's.
  const inertia = usePage()
  const start = new URLSearchParams(
    typeof window === 'undefined' ? (inertia.url.split('?')[1] ?? '') : window.location.search,
  )
  const [tab, setTab] = useState<Tab>(
    start.get('tab') === 'templates' || !projects.length ? 'templates' : 'projects',
  )
  const [view, setView] = useState<View>(start.get('view') === 'table' ? 'table' : 'cards')
  const [query, setQuery] = useState(start.get('q') ?? '')
  const [pageWanted, setPageWanted] = useState(Number(start.get('page') ?? 1))
  const found = searchProjects(projects, query)
  const { items, page, pages } = pageOf(found, pageWanted)

  function show(next: { tab?: Tab; view?: View; q?: string; page?: number }) {
    const s = { tab, view, q: query, page, ...next }
    setTab(s.tab)
    setView(s.view)
    setQuery(s.q)
    setPageWanted(s.page)
    const params = new URLSearchParams()
    if (s.tab === 'templates') params.set('tab', 'templates')
    if (s.view === 'table') params.set('view', 'table')
    if (s.q.trim()) params.set('q', s.q)
    if (s.page > 1) params.set('page', String(s.page))
    const search = params.toString()
    window.history.replaceState(window.history.state, '', search ? `?${search}` : location.pathname)
  }

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
  const starts: PresetInfo[] = [
    { id: '', slug: '', name: '', title: 'One blank scene', description: 'Start from nothing' },
    ...presets,
  ]

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Commercials</h1>
        <TooltipProvider>
          <ThemeToggle />
        </TooltipProvider>
      </header>
      <Tabs value={tab} onValueChange={(t) => show({ tab: t as Tab })} className="gap-6">
        <TabsList>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="templates">New from a template</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="grid gap-4">
          {projects.length === 0 ? (
            <p className="text-muted-foreground">
              No commercials yet. Start one from a template, or run kick formercial new
              &lt;name&gt;.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="search" className="sr-only">
                  Search commercials
                </label>
                <Input
                  id="search"
                  type="search"
                  value={query}
                  onChange={(e) => show({ q: e.target.value, page: 1 })}
                  placeholder="Search by name or folder"
                  className="min-w-48 flex-1"
                />
                <span role="status" className="text-xs text-muted-foreground">
                  {query.trim()
                    ? `${found.length} of ${projects.length}`
                    : plural(projects.length, 'commercial')}
                </span>
                <div role="group" aria-label="Show as" className="flex gap-1">
                  {(['cards', 'table'] as const).map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={view === v ? 'secondary' : 'ghost'}
                      aria-pressed={view === v}
                      onClick={() => show({ view: v })}
                    >
                      {v === 'cards' ? 'Cards' : 'Table'}
                    </Button>
                  ))}
                </div>
              </div>

              {found.length === 0 ? (
                <p className="text-muted-foreground">Nothing matches “{query.trim()}”.</p>
              ) : view === 'cards' ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/p/${p.slug}`}
                        className="group grid gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <Thumb {...p} className="transition group-hover:brightness-110" />
                        <span className="font-medium group-hover:underline">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          projects/{p.slug}
                          {details(p) && ` · ${details(p)}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="w-24 py-2 font-normal">
                        <span className="sr-only">Thumbnail</span>
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Name
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Folder
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Scenes
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        Formats
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((p) => (
                      <tr key={p.slug}>
                        <td className="py-2 pr-3">
                          <Thumb {...p} className="w-20" />
                        </td>
                        <td className="py-2 pr-3">
                          <Link href={`/p/${p.slug}`} className="font-medium">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          projects/{p.slug}
                        </td>
                        <td className="py-2 pr-3">{p.scenes ?? ''}</td>
                        <td className="py-2 text-xs">{p.formats?.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {pages > 1 && (
                <nav aria-label="Pages" className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => show({ page: page - 1 })}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => show({ page: page + 1 })}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="templates">
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {starts.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      'grid cursor-pointer gap-2 rounded-md border p-3 hover:bg-card has-focus-visible:ring-2 has-focus-visible:ring-ring',
                      preset === p.id && 'border-primary',
                    )}
                  >
                    <Thumb {...p} name={p.title} render={false} />
                    <span className="flex gap-2.5">
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
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
          {error && <p className="mt-4 text-destructive">{error}</p>}
        </TabsContent>
      </Tabs>
    </main>
  )
}
