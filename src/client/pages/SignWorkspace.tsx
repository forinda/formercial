// The signing workspace: open a PDF, place a signature, initials, the date, a
// name, text or ticks on any of its pages, then Finish to get the signed copy.
// Layout: top bar, tool rail, page strip, the pages, and the selected item's settings.
import { Link } from '@inertiajs/react'
import {
  CalendarDays,
  Check,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Signature,
  Type,
  Undo2,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { FileDrop, RemotePreview } from '@/client/components/ui/file-drop'
import { cn } from '@/client/lib/utils'
import { outputUrl, useToolJob } from '@/client/lib/tool-job'
import { Inspector } from '@/client/sign/Inspector'
import { ItemBox } from '@/client/sign/ItemBox'
import {
  formatDate,
  isPicture,
  toSignItems,
  useHistory,
  type Label,
  type Placed,
} from '@/client/sign/items'
import { PdfPage } from '@/client/sign/Page'
import { loadPdf, type LoadedPdf } from '@/client/sign/pdf'
import type { ToolSummary } from '@/modules/tools/tool-jobs.service'

type Tool = 'select' | Label

const TOOLS: { id: Tool; name: string; icon: LucideIcon }[] = [
  { id: 'select', name: 'Select and move', icon: MousePointer2 },
  { id: 'signature', name: 'Signature', icon: Signature },
  { id: 'initials', name: 'Initials', icon: PenLine },
  { id: 'date', name: 'Date', icon: CalendarDays },
  { id: 'name', name: 'Name', icon: UserRound },
  { id: 'text', name: 'Text', icon: Type },
  { id: 'tick', name: 'Tick', icon: Check },
]

/** How big a new item starts, in points: the width for pictures, the letter size for text. */
const START = { signature: 160, initials: 60, tick: 16, text: 12 }

const newId = () => Math.random().toString(36).slice(2, 10)

/** A text item's box, in fractions of a page of `page` points, for its words at its size. */
function textBox(text: string, size: number, page: { width: number; height: number }) {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = `${size}px Helvetica, Arial, sans-serif`
  const w = Math.min(1, (ctx.measureText(text || ' ').width + size * 0.3) / page.width)
  return { w, h: Math.min(1, (size * 1.4) / page.height) }
}

/** An image's width over its height. */
async function aspect(blob: Blob) {
  const img = await createImageBitmap(blob)
  const r = img.width / img.height
  img.close()
  return r
}

type Asking = { label: Label; then?: { page: number; at: { x: number; y: number } } }

export default function SignWorkspace({ tool }: { tool: ToolSummary }) {
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [openError, setOpenError] = useState('')
  const items = useHistory<Placed[]>([])
  const [selected, setSelected] = useState<{ id: string; page: number } | null>(null)
  const [active, setActive] = useState<Tool>('select')
  const [pictures, setPictures] = useState<Partial<Record<Label, File>>>({})
  const [asking, setAsking] = useState<Asking | null>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  const [fit, setFit] = useState(1)
  const [current, setCurrent] = useState(1)
  const work = useRef<HTMLDivElement>(null)
  const job = useToolJob(tool.id)

  // Open the chosen PDF.
  useEffect(() => {
    if (!file) return
    let live = true
    setOpenError('')
    loadPdf(file).then(
      (loaded) => live && setPdf(loaded),
      (err: Error) => {
        if (!live) return
        setOpenError(err.message)
        setFile(null)
      },
    )
    return () => {
      live = false
    }
  }, [file])

  // Fit the widest page to the work area, until someone zooms.
  useEffect(() => {
    const el = work.current
    if (!el || !pdf) return
    const widths = Array.from({ length: pdf.pageCount }, (_, i) => pdf.size(i + 1).width)
    const widest = Math.max(...widths)
    const measure = () => setFit(Math.max(0.2, (el.clientWidth - 48) / widest))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [pdf])
  const scale = zoom ?? fit

  const urls = useMemo(
    () => Object.fromEntries(Object.entries(pictures).map(([k, f]) => [k, URL.createObjectURL(f)])),
    [pictures],
  ) as Partial<Record<Label, string>>
  useEffect(() => () => Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u)), [urls])

  const list = items.value
  const chosen = list.find((i) => i.id === selected?.id)
  const update = (next: Placed) => items.set(list.map((i) => (i.id === next.id ? next : i)))
  const remove = (id: string) => {
    items.set(list.filter((i) => i.id !== id))
    setSelected(null)
  }

  /** Put a new item of this kind, centred where the page was clicked. */
  const place = useCallback(
    async (label: Label, page: number, at: { x: number; y: number }, picture?: File) => {
      if (!pdf) return
      const size = pdf.size(page)
      let box: { w: number; h: number }
      let extra: Partial<Placed> = {}
      if (isPicture(label)) {
        const pic = picture ?? pictures[label]
        if (!pic) return setAsking({ label, then: { page, at } })
        const w = Math.min(0.9, START[label as 'signature' | 'initials'] / size.width)
        box = { w, h: Math.min(0.9, (w * size.width) / (await aspect(pic)) / size.height) }
      } else if (label === 'tick') {
        box = { w: START.tick / size.width, h: START.tick / size.height }
      } else {
        const text =
          label === 'date'
            ? formatDate(new Date(), 'long')
            : label === 'name'
              ? 'Your name'
              : 'Text'
        extra = { text, size: START.text }
        box = textBox(text, START.text, size)
      }
      const x = Math.min(1 - box.w, Math.max(0, at.x - box.w / 2))
      const y = Math.min(1 - box.h, Math.max(0, at.y - box.h / 2))
      const item: Placed = {
        id: newId(),
        label,
        pages: [page],
        box: { x, y, ...box },
        color: 'blue',
        ...extra,
      }
      items.set(list.concat([item]))
      setSelected({ id: item.id, page })
      setActive('select')
    },
    [pdf, pictures, items, list],
  )

  /** Text changed: its box follows its words and size, and stays on the page. */
  function changed(next: Placed, page: number) {
    let box = next.box
    if (pdf && next.text !== undefined && next.size)
      box = { ...box, ...textBox(next.text, next.size, pdf.size(page)) }
    box = { ...box, x: Math.min(box.x, 1 - box.w), y: Math.min(box.y, 1 - box.h) }
    update({ ...next, box })
  }

  function detach(item: Placed, page: number) {
    const copy: Placed = { ...item, id: newId(), pages: [page] }
    const rest = list.map((i) =>
      i.id === item.id ? { ...i, pages: i.pages.filter((p) => p !== page) } : i,
    )
    items.set(rest.concat([copy]))
    setSelected({ id: copy.id, page })
  }

  // Undo and redo from the keyboard, unless someone's typing; Escape lets go.
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) items.redo()
        else items.undo()
      }
      if (e.key === 'Escape') {
        setSelected(null)
        setActive('select')
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [items])

  // Which page is most in view, for the strip.
  const seen = useRef<Record<number, number>>({})
  const onSeen = useMemo(
    () =>
      Array.from({ length: pdf?.pageCount ?? 0 }, (_, i) => (ratio: number) => {
        seen.current[i + 1] = ratio
        const best = Object.entries(seen.current).sort((a, b) => b[1] - a[1])[0]
        if (best) setCurrent(Number(best[0]))
      }),
    [pdf],
  )

  async function finish() {
    if (!file) return
    const { items: signItems, pictures: order } = toSignItems(list)
    const files: { name: string; body: Blob }[] = [{ name: file.name, body: file }]
    for (const label of order) {
      const pic = pictures[label]
      if (pic) files.push({ name: pic.name, body: pic })
    }
    await job.run({ items: signItems }, files)
  }

  if (!pdf)
    return (
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
        <Link href="/utilities" className="text-sm text-muted-foreground hover:text-foreground">
          ← All utilities
        </Link>
        <h1 className="text-2xl font-semibold">Sign a PDF</h1>
        <p className="text-muted-foreground">
          Open the document, then place your signature, initials, the date and your name wherever
          they go, on any page. Nothing changes in the file until you press Finish.
        </p>
        <FileDrop
          files={file ? [file] : []}
          onChange={(f) => setFile(f[0] ?? null)}
          accept={['pdf']}
          max={1}
          maxSize={tool.maxSize}
          label="Drop the PDF to sign here"
        />
        {openError && (
          <p role="alert" className="text-destructive">
            {openError}
          </p>
        )}
      </main>
    )

  const pages = Array.from({ length: pdf.pageCount }, (_, i) => i + 1)
  const done = job.job?.state === 'done' ? job.job : null
  const failed = job.error || (job.job?.state === 'failed' ? job.job.error : '')

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Link
          href="/utilities"
          aria-label="All utilities"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </Link>
        <span className="max-w-60 truncate text-sm font-medium">{file?.name}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!items.canUndo}
          onClick={items.undo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={!items.canRedo}
          onClick={items.redo}
        >
          <Redo2 />
        </Button>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => setZoom(Math.max(0.2, scale / 1.25))}
        >
          <Minus />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom(null)} title="Fit the width">
          {Math.round(scale * 100)}%
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => setZoom(Math.min(6, scale * 1.25))}
        >
          <Plus />
        </Button>
        <Button onClick={finish} disabled={job.busy || !list.length}>
          {job.step || (job.busy ? 'Working…' : 'Finish & download')}
        </Button>
      </header>

      {failed && (
        <p role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          It didn't work: {failed}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Tools" className="flex w-12 flex-col items-center gap-1 border-r py-2">
          {TOOLS.map((t) => (
            <Button
              key={t.id}
              variant={active === t.id ? 'default' : 'ghost'}
              size="icon"
              aria-label={t.name}
              title={t.name}
              aria-pressed={active === t.id}
              onClick={() => setActive(t.id)}
            >
              <t.icon />
            </Button>
          ))}
        </nav>

        <nav aria-label="Pages" className="hidden w-28 overflow-y-auto border-r p-2 md:block">
          <ol className="grid gap-2">
            {pages.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`page-${n}`)?.scrollIntoView({ block: 'start' })
                  }
                  aria-current={current === n ? 'page' : undefined}
                  className={cn(
                    'grid w-full justify-items-center gap-1 rounded p-1 text-xs',
                    current === n ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent',
                  )}
                >
                  <PdfPage
                    pdf={pdf}
                    page={n}
                    scale={80 / pdf.size(n).width}
                    thumb
                    className="shadow-sm"
                  />
                  {n}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div
          ref={work}
          className={cn(
            'flex-1 overflow-auto bg-muted/60 p-6',
            active !== 'select' && 'cursor-crosshair',
          )}
          onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="mx-auto grid w-max gap-6">
            {pages.map((n) => {
              const size = pdf.size(n)
              const px = { width: size.width * scale, height: size.height * scale }
              return (
                <PdfPage
                  key={n}
                  pdf={pdf}
                  page={n}
                  scale={scale}
                  onSeen={onSeen[n - 1]}
                  className="shadow-md"
                  onClick={(at) => {
                    if (active === 'select') setSelected(null)
                    else void place(active, n, at)
                  }}
                >
                  {list
                    .filter((i) => i.pages.includes(n))
                    .map((i) => (
                      <ItemBox
                        key={i.id}
                        item={i}
                        px={px}
                        scale={scale}
                        picture={urls[i.label]}
                        selected={selected?.id === i.id && selected.page === n}
                        onSelect={() => setSelected({ id: i.id, page: n })}
                        onChange={(next) => changed(next, n)}
                        onDelete={() => remove(i.id)}
                      />
                    ))}
                </PdfPage>
              )
            })}
          </div>
        </div>

        <aside aria-label="Settings" className="hidden w-64 overflow-y-auto border-l md:block">
          {chosen && selected ? (
            <Inspector
              key={chosen.id}
              item={chosen}
              page={selected.page}
              pageCount={pdf.pageCount}
              onChange={(next) => changed(next, selected.page)}
              onDetach={() => detach(chosen, selected.page)}
              onDelete={() => remove(chosen.id)}
              onReplacePicture={() => setAsking({ label: chosen.label })}
            />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              Pick a tool on the left, then click on a page to put it there. Click something you've
              placed to move it, resize it, or put it on more pages.
            </p>
          )}
        </aside>
      </div>

      {asking && (
        <PictureDialog
          label={asking.label}
          onCancel={() => setAsking(null)}
          onPick={(pic) => {
            setPictures({ ...pictures, [asking.label]: pic })
            if (asking.then) void place(asking.label, asking.then.page, asking.then.at, pic)
            setAsking(null)
          }}
        />
      )}

      {done && (
        <div
          role="dialog"
          aria-label="Signed"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="grid w-full max-w-2xl gap-3 rounded-lg bg-background p-4">
            <h2 className="font-semibold">Signed</h2>
            {done.outputs.map(({ file: out, name }) => (
              <div key={out} className="grid gap-2">
                <RemotePreview url={`${outputUrl(done, out)}?view=1`} name={name} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={job.reset}>
                    Keep editing
                  </Button>
                  <Button asChild>
                    <a href={outputUrl(done, out)} download>
                      Download {name}
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Choosing the picture of a signature or initials. Drawing and typing one come later. */
function PictureDialog({
  label,
  onPick,
  onCancel,
}: {
  label: Label
  onPick(f: File): void
  onCancel(): void
}) {
  const [files, setFiles] = useState<File[]>([])
  return (
    <div
      role="dialog"
      aria-label={`Your ${label}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div className="grid w-full max-w-md gap-3 rounded-lg bg-background p-4">
        <h2 className="font-semibold">Your {label}</h2>
        <p className="text-sm text-muted-foreground">
          A PNG or JPG of it. A PNG with a see-through background looks best on the page.
        </p>
        <FileDrop
          files={files}
          onChange={setFiles}
          accept={['png', 'jpg', 'jpeg']}
          max={1}
          maxSize={10 * 1024 * 1024}
          label="Drop the picture here"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!files.length} onClick={() => onPick(files[0])}>
            Use it
          </Button>
        </div>
      </div>
    </div>
  )
}
