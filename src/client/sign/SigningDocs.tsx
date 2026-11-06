// The signing documents kept on this machine, newest change first, and opening
// a new one. Each is kept until it's deleted here.
import { Link, router } from '@inertiajs/react'
import { FileSignature, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { FileDrop } from '@/client/components/ui/file-drop'
import { api } from '@/client/editor/useProject'
import type { SigningSummary } from '@/modules/tools/signing-store.service'
import { loadPdf } from './pdf'

const BASE = '/api/v1/tools/signing'

export function SigningDocs({ maxSize }: { maxSize: number }) {
  const [docs, setDocs] = useState<SigningSummary[] | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    api<SigningSummary[]>(BASE).then(setDocs, (e: Error) => setError(e.message))
  }, [])

  async function open(file: File) {
    setError('')
    setOpening(true)
    try {
      // Read here first: a PDF with a password, or not a PDF, is turned away before it's kept.
      const pdf = await loadPdf(file)
      const pages = pdf.pageCount
      void pdf.destroy()
      const made = await api<{ id: string }>(
        `${BASE}?name=${encodeURIComponent(file.name)}&pages=${pages}`,
        { method: 'POST', body: file },
      )
      router.visit(`/utilities/sign/${made.id}`)
    } catch (err) {
      setError((err as Error).message)
      setOpening(false)
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      await api(`${BASE}/${id}`, { method: 'DELETE' })
      setDocs((list) => list?.filter((d) => d.id !== id) ?? null)
    } catch (err) {
      setError(`It wasn't deleted: ${(err as Error).message}. Try again.`)
    }
    setDeleting(null)
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <Link href="/utilities" className="text-sm text-muted-foreground hover:text-foreground">
        ← All utilities
      </Link>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Sign a PDF</h1>
        <p className="text-muted-foreground">
          Open a document, then place your signature, initials, the date and your name wherever they
          go. Documents are kept on this machine, with every signed copy, until you delete them.
        </p>
      </div>
      <FileDrop
        files={[]}
        onChange={(f) => f[0] && void open(f[0])}
        accept={['pdf']}
        max={1}
        maxSize={maxSize}
        disabled={opening}
        label={opening ? 'Opening…' : 'Open a new PDF'}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {docs && docs.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Your documents</h2>
          <ul className="grid gap-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileSignature className="size-5 shrink-0 text-primary" aria-hidden />
                <Link href={`/utilities/sign/${d.id}`} className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.pages} {d.pages === 1 ? 'page' : 'pages'} ·{' '}
                    {d.versions
                      ? `${d.versions} signed ${d.versions === 1 ? 'copy' : 'copies'}`
                      : 'not signed yet'}{' '}
                    · changed {new Date(d.updatedAt).toLocaleString()}
                  </span>
                </Link>
                {deleting === d.id ? (
                  <span className="flex items-center gap-1 text-sm">
                    Delete it and its signed copies?
                    <Button size="sm" variant="destructive" onClick={() => void remove(d.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => setDeleting(d.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {docs && docs.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      )}
    </main>
  )
}
