import { Link } from '@inertiajs/react'
import { Sections } from '@/client/components/sections'
import { ToolIcon } from '@/client/components/tool-icon'
import type { ToolSummary } from '@/modules/tools/tool-jobs.service'

const GROUPS = [
  { id: 'media', title: 'Video and sound' },
  { id: 'documents', title: 'Documents' },
  { id: 'pdf', title: 'PDF' },
] as const

export default function Utilities({
  tools,
  sandboxed,
}: {
  tools: ToolSummary[]
  sandboxed: boolean
}) {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Sections current="utilities" />
      <h1 className="sr-only">Utilities</h1>
      <p className="text-muted-foreground">
        Files are worked on here, on this machine, and deleted an hour later.
      </p>
      {!sandboxed && (
        <p role="note" className="rounded-md border border-destructive/40 p-3 text-sm">
          Install bubblewrap (<code>bwrap</code>) so documents are converted with no network and no
          view of your other files. Until then only the converters' own safeguards apply.
        </p>
      )}
      {GROUPS.map((g) => {
        const list = tools.filter((t) => t.group === g.id)
        if (!list.length) return null
        return (
          <section key={g.id} className="grid gap-3">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/utilities/${t.id}`}
                    className="flex h-full gap-3 rounded-lg border p-4 hover:border-primary"
                  >
                    <ToolIcon id={t.id} group={t.group} />
                    <span className="grid content-start gap-1">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-sm text-muted-foreground">{t.description}</span>
                      {t.missing.length > 0 && (
                        <span className="text-xs text-destructive">
                          Needs {t.missing.join(', ')} installed
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}
