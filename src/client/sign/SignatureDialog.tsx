// Choosing a signature or initials: one saved before, or a new one drawn,
// uploaded (with its paper cleared) or typed in a handwriting font. New ones
// are kept on this machine for next time.
import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/client/components/ui/button'
import { FileDrop } from '@/client/components/ui/file-drop'
import { Input } from '@/client/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import { api } from '@/client/editor/useProject'
import type { SavedSignature } from '@/modules/tools/signature-store.service'
import {
  HANDS,
  loadHand,
  removeBackground,
  stroke,
  trimToInk,
  typedSignature,
  type Hand,
} from './draw'

const INK = { black: '#111111', blue: '#1a3d8f' }
type Kind = 'signature' | 'initials'
type Made = SavedSignature['made']

const BASE = '/api/v1/tools/signatures'

/** "Jo Mwangi" → "JM". */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')

type Props = { kind: Kind; name: string; onPick(picture: Blob): void; onCancel(): void }

export function SignatureDialog({ kind, name, onPick, onCancel }: Props) {
  const [saved, setSaved] = useState<SavedSignature[] | null>(null)
  const [tab, setTab] = useState<Made>('drawn')
  const [ink, setInk] = useState<keyof typeof INK>('blue')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const make = useRef<() => Promise<Blob | null>>(async () => null)

  useEffect(() => {
    api<{ signatures: SavedSignature[] }>(BASE).then(
      (r) => setSaved(r.signatures.filter((s) => s.kind === kind)),
      () => setSaved([]),
    )
  }, [kind])

  async function pickSaved(id: string) {
    const res = await fetch(`${BASE}/${id}`)
    if (res.ok) onPick(await res.blob())
  }

  async function forget(id: string) {
    await api(`${BASE}/${id}`, { method: 'DELETE' })
    setSaved((list) => list?.filter((s) => s.id !== id) ?? null)
  }

  async function useNew() {
    setError('')
    setBusy(true)
    try {
      const picture = await make.current()
      if (!picture)
        return setError(tab === 'drawn' ? 'Draw it first.' : 'There is nothing to use yet.')
      // Kept for next time; if that fails, it can still be used now.
      await api(`${BASE}?kind=${kind}&made=${tab}`, { method: 'PUT', body: picture }).catch(
        () => {},
      )
      onPick(picture)
    } catch (err) {
      setError((err as Error).message || "That didn't work; try another way.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Your ${kind}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="grid max-h-full w-full max-w-xl gap-4 overflow-y-auto rounded-lg bg-background p-4">
        <h2 className="font-semibold">Your {kind}</h2>

        {saved && saved.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-sm text-muted-foreground">Saved on this machine</h3>
            <ul className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-md border p-1">
                  <button
                    type="button"
                    onClick={() => void pickSaved(s.id)}
                    className="grid h-14 w-36 place-items-center rounded bg-white hover:ring-2 hover:ring-primary"
                    aria-label={`Use the ${s.made} ${kind} saved ${new Date(s.createdAt).toLocaleDateString()}`}
                  >
                    <img
                      src={`${BASE}/${s.id}`}
                      alt=""
                      className="max-h-12 max-w-32 object-contain"
                    />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Forget this one"
                    onClick={() => void forget(s.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Tabs value={tab} onValueChange={(t) => setTab(t as Made)} className="gap-3">
          <TabsList>
            <TabsTrigger value="drawn">Draw</TabsTrigger>
            <TabsTrigger value="uploaded">Upload</TabsTrigger>
            <TabsTrigger value="typed">Type</TabsTrigger>
          </TabsList>
          <fieldset className="flex items-center gap-2 text-sm">
            <legend className="sr-only">Ink</legend>
            Ink
            {(['blue', 'black'] as const).map((c) => (
              <Button
                key={c}
                size="xs"
                variant={ink === c ? 'default' : 'outline'}
                aria-pressed={ink === c}
                onClick={() => setInk(c)}
              >
                {c === 'blue' ? 'Blue' : 'Black'}
              </Button>
            ))}
            {tab === 'uploaded' && (
              <span className="text-muted-foreground">(uploads keep their own)</span>
            )}
          </fieldset>
          <TabsContent value="drawn">
            <DrawPad color={INK[ink]} bind={(f) => (make.current = f)} />
          </TabsContent>
          <TabsContent value="uploaded">
            <UploadPicture bind={(f) => (make.current = f)} />
          </TabsContent>
          <TabsContent value="typed">
            <TypeIt
              start={kind === 'initials' ? initialsOf(name) : name}
              color={INK[ink]}
              bind={(f) => (make.current = f)}
            />
          </TabsContent>
        </Tabs>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => void useNew()} disabled={busy}>
            {busy ? 'Saving…' : 'Use it'}
          </Button>
        </div>
      </div>
    </div>
  )
}

type Bind = { bind(make: () => Promise<Blob | null>): void }

/** A pad to sign on with a mouse, pen or finger. */
function DrawPad({ color, bind }: Bind & { color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<{ x: number; y: number }[][]>([])
  const [, redraw] = useState(0)

  // The pad is drawn at the screen's pixel ratio, so lines stay smooth.
  function paint() {
    const c = canvas.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = c.getBoundingClientRect()
    if (c.width !== Math.round(width * ratio))
      [c.width, c.height] = [Math.round(width * ratio), Math.round(height * ratio)]
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    for (const s of strokes.current)
      stroke(
        ctx,
        s.map((p) => ({ x: p.x * ratio, y: p.y * ratio })),
        color,
        3 * ratio,
      )
  }
  useEffect(paint)
  useEffect(() => bind(async () => (canvas.current ? trimToInk(canvas.current) : null)))

  const at = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div className="grid gap-2">
      <canvas
        ref={canvas}
        aria-label="Signing pad: draw with a mouse, pen or finger"
        className="h-48 w-full touch-none rounded-md border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          strokes.current.push([at(e)])
          paint()
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          strokes.current[strokes.current.length - 1].push(at(e))
          paint()
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            strokes.current.pop()
            redraw((n) => n + 1)
          }}
        >
          Undo a line
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            strokes.current = []
            redraw((n) => n + 1)
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

/** A photo or scan of a signature, with its paper made see-through. */
function UploadPicture({ bind }: Bind) {
  const [files, setFiles] = useState<File[]>([])
  const [threshold, setThreshold] = useState(40)
  const [preview, setPreview] = useState('')

  useEffect(() =>
    bind(async () =>
      files[0] ? (threshold ? removeBackground(files[0], threshold) : files[0]) : null,
    ),
  )
  useEffect(() => {
    const file = files[0]
    if (!file) return setPreview('')
    let url = ''
    let live = true
    void (threshold ? removeBackground(file, threshold) : Promise.resolve(file)).then((b) => {
      if (!live || !b) return
      url = URL.createObjectURL(b)
      setPreview(url)
    })
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [files, threshold])

  return (
    <div className="grid gap-3">
      <FileDrop
        files={files}
        onChange={setFiles}
        accept={['png', 'jpg', 'jpeg']}
        max={1}
        maxSize={10 * 1024 * 1024}
        label="Drop a photo or scan of it here"
      />
      {files[0] && (
        <>
          <label className="grid gap-1 text-sm">
            Clear the paper: {threshold ? threshold : 'off'}
            <input
              type="range"
              min={0}
              max={120}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          {preview && (
            // A checkerboard behind it shows what's see-through.
            <div className="grid place-items-center rounded-md border bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-size-[16px_16px] p-2">
              <img src={preview} alt="How it will look" className="max-h-40 object-contain" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Typed in one of the bundled handwriting fonts. */
function TypeIt({ start, color, bind }: Bind & { start: string; color: string }) {
  const [words, setWords] = useState(start)
  const [hand, setHand] = useState<Hand>(HANDS[0].family)
  // Each font shows once it has loaded; one that won't load doesn't hold up the rest.
  const [ready, setReady] = useState<Hand[]>([])

  useEffect(() => {
    for (const h of HANDS)
      loadHand(h.family).then(
        () => setReady((r) => r.concat([h.family])),
        () => {},
      )
  }, [])
  useEffect(() =>
    bind(async () => (words.trim() ? typedSignature(words.trim(), hand, color) : null)),
  )

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Words
        <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Your name" />
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm">Handwriting</legend>
        {HANDS.map((h) => (
          <label
            key={h.family}
            className="flex cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2 has-checked:ring-2 has-checked:ring-primary"
          >
            <input
              type="radio"
              name="hand"
              checked={hand === h.family}
              onChange={() => setHand(h.family)}
            />
            <span
              className="truncate text-3xl"
              style={{ fontFamily: ready.includes(h.family) ? `"${h.family}"` : undefined, color }}
            >
              {words || 'Your name'}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
