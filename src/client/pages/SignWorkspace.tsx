// The signing workspace: open a PDF, place a signature, initials, the date, a
// name, text or ticks on any of its pages, then Finish to get the signed copy.
// Layout: top bar, tool rail, page strip, the pages, and the selected item's settings.
import { Link } from '@inertiajs/react'
import {
  CalendarDays,
  History,
  Check,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
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
import { api } from '@/client/editor/useProject'
import { FinishDialog, type Certificate } from '@/client/sign/FinishDialog'
import { Inspector } from '@/client/sign/Inspector'
import { ItemBox } from '@/client/sign/ItemBox'
import {
  DEFAULT_INK,
  formatDate,
  isPicture,
  toSignItems,
  useHistory,
  type Label,
  type Placed,
} from '@/client/sign/items'
import { PdfPage } from '@/client/sign/Page'
import { usePinch } from '@/client/sign/pinch'
import { SignatureDialog } from '@/client/sign/SignatureDialog'
import { SigningDocs } from '@/client/sign/SigningDocs'
import { useAutosave } from '@/client/sign/autosave'
import { loadPdf, type LoadedPdf } from '@/client/sign/pdf'
import type { SigningDoc, SigningVersion } from '@/modules/tools/signing-store.service'
import type { ToolSummary } from '@/modules/tools/tool-jobs.service'

type Tool = 'select' | Label

const RAIL_KEY = 'formercial:sign-rail'

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

const TEXT_LABELS: Label[] = ['date', 'name', 'text']

/** The documents kept on this machine, or one of them open. */
export default function SignWorkspace({ tool, id }: { tool: ToolSummary; id?: string }) {
  // Keyed by the document, so opening another starts clean.
  return id ? <Workspace key={id} tool={tool} id={id} /> : <SigningDocs maxSize={tool.maxSize} />
}

function Workspace({ tool, id }: { tool: ToolSummary; id: string }) {
  const DOC = `/api/v1/tools/signing/${id}`
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [openError, setOpenError] = useState('')
  const items = useHistory<Placed[]>([])
  const [selected, setSelected] = useState<{ id: string; page: number } | null>(null)
  const [active, setActive] = useState<Tool>('select')
  const [pictures, setPictures] = useState<Partial<Record<Label, Blob>>>({})
  // The name kept on this machine with the signatures, for the Name tool.
  const [name, setName] = useState('')
  const saveName = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    api<{ name: string }>('/api/v1/tools/signatures').then(
      (r) => setName(r.name),
      () => {},
    )
  }, [])
  const [asking, setAsking] = useState<Asking | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null)
  const [fit, setFit] = useState(1)
  const [current, setCurrent] = useState(1)
  const work = useRef<HTMLDivElement>(null)
  // The tool rail shows names beside the icons, or just icons; remembered on this device.
  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== 'closed'
    } catch {
      return true
    }
  })
  const toggleRail = (open: boolean) => {
    setRailOpen(open)
    try {
      localStorage.setItem(RAIL_KEY, open ? 'open' : 'closed')
    } catch {
      // A browser that won't store it just forgets it.
    }
  }
  const job = useToolJob(tool.id)
  const wide = useWide()

  // The stored document: its PDF, what was placed on it, and its pictures.
  const [doc, setDoc] = useState<SigningDoc | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const d = await api<SigningDoc>(DOC)
        const res = await fetch(`${DOC}/original`)
        if (!res.ok) throw new Error("this document's PDF is missing")
        const original = await res.blob()
        const pics: Partial<Record<Label, Blob>> = {}
        for (const label of d.pictures) {
          const pic = await fetch(`${DOC}/pictures/${label}`)
          // One that won't load is asked for again at Finish.
          if (pic.ok) pics[label] = await pic.blob()
        }
        if (!live) return
        setPictures(pics)
        items.reset(d.items)
        setDoc(d)
        setFile(new File([original], d.name, { type: 'application/pdf' }))
      } catch (err) {
        if (live) setOpenError((err as Error).message)
      }
    })()
    return () => {
      live = false
    }
    // Only when a different document is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DOC])

  // What's placed is saved as it changes (a moment after the last change).
  const itemsSaved = useAutosave(doc && items.value, (value, leaving) =>
    api(`${DOC}/items`, { method: 'PUT', json: { items: value }, keepalive: leaving }),
  )
  // A signature picture that didn't save shows too, until one does.
  const [pictureFailed, setPictureFailed] = useState(false)
  const saved = pictureFailed ? 'failed' : itemsSaved
  // Why Finish can't go ahead yet, if it can't.
  const [finishError, setFinishError] = useState('')

  // Each Finish is kept with the document as its next version.
  const digital = useRef(false)
  const kept = useRef<string | null>(null)
  const [version, setVersion] = useState<SigningVersion | null>(null)
  const [keepError, setKeepError] = useState('')
  useEffect(() => {
    const j = job.job
    if (j?.state !== 'done' || kept.current === j.id || !j.outputs[0]) return
    kept.current = j.id
    setVersion(null)
    setKeepError('')
    api<SigningVersion>(`${DOC}/versions`, {
      method: 'POST',
      json: { job: j.id, file: j.outputs[0].file, digital: digital.current },
    }).then(
      (v) => {
        setVersion(v)
        setDoc((d) => d && { ...d, versions: d.versions.concat([v]) })
      },
      (err: Error) => setKeepError(err.message),
    )
  }, [job.job, DOC])
  const [showVersions, setShowVersions] = useState(false)

  // Open the chosen PDF.
  useEffect(() => {
    if (!file) return
    let live = true
    let opened: LoadedPdf | null = null
    setOpenError('')
    loadPdf(file).then(
      (loaded) => {
        opened = loaded
        if (live) setPdf(loaded)
        else void loaded.destroy()
      },
      (err: Error) => {
        if (!live) return
        setOpenError(err.message)
        setFile(null)
      },
    )
    return () => {
      live = false
      void opened?.destroy()
    }
  }, [file])

  // Fit the widest page to the work area, until someone zooms.
  useEffect(() => {
    const el = work.current
    if (!el || !pdf) return
    const widths = Array.from({ length: pdf.pageCount }, (_, i) => pdf.size(i + 1).width)
    const widest = Math.max(...widths)
    const pad = () => 2 * parseFloat(getComputedStyle(el).paddingLeft || '0')
    const measure = () => setFit(Math.max(0.2, (el.clientWidth - pad()) / widest))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [pdf])
  const scale = zoom ?? fit
  const pinch = usePinch(scale, setZoom)

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
    async (label: Label, page: number, at: { x: number; y: number }, picture?: Blob) => {
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
              ? name || 'Your name'
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
        color: DEFAULT_INK,
        ...extra,
      }
      items.set(list.concat([item]))
      setSelected({ id: item.id, page })
      setActive('select')
    },
    [pdf, pictures, items, list, name],
  )

  /** Text changed: its box follows its words and size, and stays on the page. */
  function changed(next: Placed, page: number) {
    let box = next.box
    if (pdf && next.text !== undefined && next.size)
      box = { ...box, ...textBox(next.text, next.size, pdf.size(page)) }
    box = { ...box, x: Math.min(box.x, 1 - box.w), y: Math.min(box.y, 1 - box.h) }
    update({ ...next, box })
    // A name typed in is remembered for next time.
    if (next.label === 'name' && next.text && next.text !== 'Your name') {
      const words = next.text
      clearTimeout(saveName.current)
      saveName.current = setTimeout(() => {
        setName(words)
        void api('/api/v1/tools/signatures/name', { method: 'PUT', json: { name: words } }).catch(
          () => {},
        )
      }, 600)
    }
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

  async function finish(certificate: Certificate | null) {
    setFinishing(false)
    setFinishError('')
    if (!file) return
    const empty = list.find((i) => TEXT_LABELS.includes(i.label) && !i.text?.trim())
    if (empty) {
      setSelected({ id: empty.id, page: empty.pages[0] })
      return setFinishError('a text item is empty: type in it or delete it')
    }
    const { items: signItems, pictures: order } = toSignItems(list)
    const files: { name: string; body: Blob }[] = [{ name: file.name, body: file }]
    for (const label of order) {
      const pic = pictures[label]
      if (!pic) return setFinishError(`the ${label} picture is missing: pick it again`)
      files.push({ name: `${label}.png`, body: pic })
    }
    // The certificate goes last; the server signs the stamped copy with it.
    if (certificate) files.push({ name: certificate.file.name, body: certificate.file })
    digital.current = !!certificate
    await job.run({ items: signItems, password: certificate?.password ?? '' }, files)
  }

  if (!pdf)
    return (
      <main className="mx-auto grid max-w-2xl gap-4 px-4 py-12">
        <Link
          href="/utilities/sign"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Your documents
        </Link>
        {openError ? (
          <p role="alert" className="text-destructive">
            {openError}
          </p>
        ) : (
          <p className="text-muted-foreground">Opening…</p>
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
          href="/utilities/sign"
          aria-label="Your documents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </Link>
        <span className="grid min-w-0 flex-1 md:max-w-72 md:flex-none">
          <span className="truncate text-sm font-medium">{file?.name}</span>
          <span className="text-[11px] text-muted-foreground" aria-live="polite">
            {saved === 'saving' ? 'Saving…' : saved === 'failed' ? "Couldn't save" : 'Saved'}
          </span>
        </span>
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
        <span className="hidden flex-1 md:block" />
        {doc && doc.versions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowVersions(true)}>
            <History />
            <span className="hidden md:inline">Signed copies</span> ({doc.versions.length})
          </Button>
        )}
        {/* Phones have no page strip: pick the page here. */}
        <select
          aria-label="Go to page"
          value={current}
          onChange={(e) =>
            document.getElementById(`page-${e.target.value}`)?.scrollIntoView({ block: 'start' })
          }
          className="h-8 rounded-md border bg-background px-2 text-sm md:hidden"
        >
          {pages.map((n) => (
            <option key={n} value={n}>
              {n} / {pages.length}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          className="max-md:hidden"
          onClick={() => setZoom(Math.max(0.2, scale / 1.25))}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="max-md:hidden"
          onClick={() => setZoom(null)}
          title="Fit the width"
        >
          {Math.round(scale * 100)}%
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          className="max-md:hidden"
          onClick={() => setZoom(Math.min(6, scale * 1.25))}
        >
          <Plus />
        </Button>
        <Button onClick={() => setFinishing(true)} disabled={job.busy || !list.length}>
          {job.step ||
            (job.busy ? (
              'Working…'
            ) : (
              <>
                Finish<span className="hidden md:inline"> &amp; download</span>
              </>
            ))}
        </Button>
      </header>

      {failed && (
        <p role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          It didn't work: {failed}
        </p>
      )}
      {finishError && (
        <p role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Can't finish yet: {finishError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Phones: the tools along the bottom, each named under its icon. */}
        <nav aria-label="Tools" className="flex justify-around border-t px-1 py-1 md:hidden">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={active === t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                'grid min-h-12 min-w-11 justify-items-center gap-0.5 rounded-md px-1 py-1 text-[10px]',
                active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              <t.icon className="size-5" aria-hidden />
              {t.name === 'Select and move' ? 'Select' : t.name}
            </button>
          ))}
        </nav>
        <nav
          aria-label="Tools"
          className={cn(
            'hidden flex-col gap-1 border-r p-2 transition-[width] md:flex',
            railOpen ? 'w-44' : 'w-14 items-center',
          )}
        >
          {TOOLS.map((t) => (
            <Button
              key={t.id}
              variant={active === t.id ? 'default' : 'ghost'}
              size={railOpen ? 'default' : 'icon'}
              // Named on screen when open; when closed, the name is its label and its tooltip.
              aria-label={railOpen ? undefined : t.name}
              title={railOpen ? undefined : t.name}
              aria-pressed={active === t.id}
              onClick={() => setActive(t.id)}
              className={cn(railOpen && 'justify-start')}
            >
              <t.icon />
              {railOpen && t.name}
            </Button>
          ))}
          <span className="flex-1" />
          <Button
            variant="ghost"
            size={railOpen ? 'default' : 'icon'}
            aria-expanded={railOpen}
            aria-label={railOpen ? undefined : 'Show tool names'}
            title={railOpen ? undefined : 'Show tool names'}
            onClick={() => toggleRail(!railOpen)}
            className={cn('text-muted-foreground', railOpen && 'justify-start')}
          >
            {railOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            {railOpen && 'Hide names'}
          </Button>
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
            'flex-1 overflow-auto bg-muted/60 p-3 md:p-6',
            active !== 'select' && 'cursor-crosshair',
          )}
          // One finger scrolls; two pinch (handled here, not by the browser).
          style={{ touchAction: 'pan-x pan-y' }}
          onPointerDown={(e) => {
            pinch.down(e)
            if (e.target === e.currentTarget) setSelected(null)
          }}
          onPointerMove={pinch.move}
          onPointerUp={pinch.up}
          onPointerCancel={pinch.up}
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
                        pinching={pinch.active}
                      />
                    ))}
                </PdfPage>
              )
            })}
          </div>
        </div>

        <aside aria-label="Settings" className="hidden w-64 overflow-y-auto border-l md:block">
          {wide && chosen && selected ? (
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

      {!wide && chosen && selected && (
        <section
          aria-label="Settings"
          className="fixed inset-x-0 bottom-0 z-40 max-h-[60dvh] overflow-y-auto rounded-t-xl border-t bg-background shadow-2xl"
        >
          <div className="sticky top-0 flex justify-end bg-background p-1">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Done
            </Button>
          </div>
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
        </section>
      )}

      {finishing && (
        <FinishDialog
          maxSize={tool.maxSize}
          onCancel={() => setFinishing(false)}
          onFinish={(certificate) => void finish(certificate)}
        />
      )}

      {asking && (
        <SignatureDialog
          kind={asking.label === 'initials' ? 'initials' : 'signature'}
          name={name}
          onCancel={() => setAsking(null)}
          onPick={(pic) => {
            setPictures({ ...pictures, [asking.label]: pic })
            void api(`${DOC}/pictures/${asking.label}`, { method: 'PUT', body: pic }).then(
              () => setPictureFailed(false),
              () => setPictureFailed(true),
            )
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
            <h2 className="font-semibold">
              {version ? `Signed: kept as version ${version.n}` : 'Signed'}
            </h2>
            {keepError && (
              <p role="alert" className="text-sm text-destructive">
                It wasn't kept with the document ({keepError}); download it now.
              </p>
            )}
            {done.outputs.slice(0, 1).map(({ file: out, name }) => {
              const url = version ? `${DOC}/versions/${version.n}` : outputUrl(done, out)
              return (
                <div key={out} className="grid gap-2">
                  <RemotePreview url={`${url}?view=1`} name={name} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={job.reset}>
                      Keep editing
                    </Button>
                    <Button asChild>
                      <a href={url} download>
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showVersions && doc && (
        <div
          role="dialog"
          aria-label="Signed copies"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setShowVersions(false)}
        >
          <div className="grid w-full max-w-md gap-3 rounded-lg bg-background p-4">
            <h2 className="font-semibold">Signed copies</h2>
            <ul className="grid gap-1">
              {doc.versions
                .slice()
                .reverse()
                .map((v) => (
                  <li key={v.n} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="flex-1 text-sm">
                      Version {v.n}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                        {v.digital ? ' · digitally signed' : ''}
                      </span>
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <a href={`${DOC}/versions/${v.n}`} download>
                        Download
                      </a>
                    </Button>
                  </li>
                ))}
            </ul>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowVersions(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Whether the screen is wide enough for the side panels (Tailwind's md, 768px). */
function useWide() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(q.matches)
    on()
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return wide
}
