// The meme editor: the meme drawn live on a canvas, its controls beside it.
// Every change saves on its own; Download PNG takes the canvas as it is.
import { Link, router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { Sections } from '@/client/components/sections'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Select } from '@/client/components/ui/select'
import { Textarea } from '@/client/components/ui/textarea'
import { api } from '@/client/editor/useProject'
import {
  MEME_LAYOUTS,
  MEME_SIZES,
  drawMeme,
  gifDelays,
  gifSize,
  memeLength,
  memeMoves,
  stillFrames,
  type Meme,
  type MemeSize,
  type MemeText,
} from '@/core/meme/meme'
import { gifFrame, loadGif } from '@/player/blocks'

// Anton ships with the app (public/fonts, SIL Open Font License), so memes look the same everywhere.
let anton: Promise<void> | null = null
const loadAnton = () =>
  (anton ??= new FontFace('Anton', 'url(/fonts/Anton-Regular.ttf)')
    .load()
    .then((face) => void document.fonts.add(face))
    .catch(() => {}))

type Frame = { image: CanvasImageSource; w: number; h: number }
type Picture = {
  frames: Frame[]
  starts: number[]
  total: number
}
const LAYOUT_NAMES = {
  bar: 'Caption bar',
  classic: 'Classic top and bottom',
  free: 'Place freely',
  post: 'Social post card',
}
const NEW_TEXT: MemeText = {
  text: 'More text',
  x: 50,
  y: 50,
  size: 8,
  color: '#ffffff',
  outline: true,
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export default function MemeEditor({ id, meme: first }: { id: string; meme: Meme }) {
  const [meme, setMeme] = useState(first)
  const [status, setStatus] = useState('Saved')
  const [sure, setSure] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const picture = useRef<Picture | null>(null)
  const avatar = useRef<Frame | null>(null)
  const latest = useRef(meme)
  latest.current = meme
  const fileUrl = (path: string) => `/api/v1/memes/${id}/file?path=${encodeURIComponent(path)}`
  const set = (patch: Partial<Meme>) => setMeme((m) => ({ ...m, ...patch }))
  const setPost = (patch: Partial<Meme['post']>) =>
    setMeme((m) => ({ ...m, post: { ...m.post, ...patch } }))
  const setText = (i: number, patch: Partial<MemeText>) =>
    setMeme((m) => ({ ...m, texts: m.texts.map((t, j) => (j === i ? { ...t, ...patch } : t)) }))

  useEffect(() => void loadAnton(), [])

  // The picture: every GIF frame decoded once, or one image.
  useEffect(() => {
    picture.current = null
    const media = meme.media
    if (!media) return
    let gone = false
    const still = () => {
      const img = new Image()
      img.onload = () => {
        if (!gone)
          picture.current = {
            frames: [{ image: img, w: img.naturalWidth, h: img.naturalHeight }],
            starts: [0],
            total: 0,
          }
      }
      img.src = fileUrl(media)
    }
    if (!media.endsWith('.gif')) still()
    else
      loadGif(fileUrl(media))
        .then((gif) => {
          if (gone) return
          if (!gif) return still()
          picture.current = {
            frames: gif.frames.map((f) => ({ image: f, w: f.width, h: f.height })),
            starts: gif.starts,
            total: gif.total,
          }
        })
        .catch(() => setStatus(`Couldn't read ${media}`))
    return () => {
      gone = true
    }
  }, [meme.media])

  // The post card's face, a still image.
  useEffect(() => {
    avatar.current = null
    const face = meme.post.avatar
    if (!face) return
    const img = new Image()
    img.onload = () => {
      if (meme.post.avatar === face)
        avatar.current = { image: img, w: img.naturalWidth, h: img.naturalHeight }
    }
    img.src = fileUrl(face)
  }, [meme.post.avatar])

  // The GIF frame showing `t` seconds in, or the still picture.
  const frameAt = (pic: Picture | null, t: number) =>
    pic ? (pic.frames[gifFrame(pic.starts, pic.total, t, true)] ?? null) : null

  // Draw every frame, so a GIF and timed text play; the meme comes from the latest state.
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const g = canvas.current?.getContext('2d')
      const pic = picture.current
      if (g) {
        const loop = memeLength(latest.current, pic?.total ?? 0)
        const t = loop ? ((now - start) / 1000) % loop : 0
        drawMeme(g, latest.current, { picture: frameAt(pic, t), avatar: avatar.current }, t)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Save each change, a moment after the typing stops.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setStatus('Saving…')
    const timer = setTimeout(() => {
      api(`/api/v1/memes/${id}`, { method: 'PUT', json: meme })
        .then(() => setStatus('Saved'))
        .catch((err: Error) => setStatus(`Not saved: ${err.message}`))
    }, 500)
    return () => clearTimeout(timer)
  }, [meme])

  async function upload(
    file: File | undefined,
    use: (path: string) => void = (media) => set({ media }),
  ) {
    if (!file) return
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!/^(gif|png|jpe?g|webp)$/.test(ext)) return setStatus('Pick a GIF, PNG, JPEG or WebP file')
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-') || 'picture'
    const path = `media/${name}.${ext}`
    setStatus('Uploading…')
    try {
      await api(`/api/v1/memes/${id}/file?path=${encodeURIComponent(path)}`, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type || 'application/octet-stream' },
      })
      use(path)
      setStatus('Saved')
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`)
    }
  }

  const save = (blob: Blob, ext: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${id}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function downloadPng() {
    await loadAnton()
    const c = canvas.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    drawMeme(g, meme, { picture: frameAt(picture.current, 0), avatar: avatar.current }, 0)
    c.toBlob((blob) => blob && save(blob, 'png'), 'image/png')
  }

  // Every frame drawn with the meme over it, then encoded here in the browser: a GIF's
  // own frames, or ten a second for a still picture with timed text.
  async function downloadGif() {
    const pic = picture.current
    if (meme.media && !pic) return setStatus('The picture is still loading')
    await loadAnton()
    setStatus('Making the GIF…')
    const [W, H] = MEME_SIZES[meme.size]
    const [w, h] = gifSize(meme)
    const full = document.createElement('canvas')
    full.width = W
    full.height = H
    const small = document.createElement('canvas')
    small.width = w
    small.height = h
    const fg = full.getContext('2d')
    const sg = small.getContext('2d', { willReadFrequently: true })
    if (!fg || !sg) return setStatus("This browser can't make a GIF")
    const animated = pic && pic.total > 0 ? pic : null
    const starts = animated ? animated.starts : stillFrames(meme.seconds)
    const delays = gifDelays(starts, animated ? animated.total : meme.seconds)
    // Loaded here, on click: gifenc is CommonJS, and the server render can't import it by name.
    const { GIFEncoder, applyPalette, quantize } = await import('gifenc')
    const gif = GIFEncoder()
    for (let i = 0; i < starts.length; i++) {
      const t = starts[i]
      drawMeme(fg, meme, { picture: frameAt(pic, t), avatar: avatar.current }, t)
      sg.drawImage(full, 0, 0, w, h)
      const { data } = sg.getImageData(0, 0, w, h)
      const palette = quantize(data, 256)
      gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: delays[i], repeat: 0 })
      // Let the page breathe between frames on a long GIF.
      if (i % 10 === 9) await new Promise((r) => setTimeout(r))
    }
    gif.finish()
    save(new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' }), 'gif')
    setStatus('Saved')
  }

  async function remove() {
    await api(`/api/v1/memes/${id}`, { method: 'DELETE' })
    router.visit('/memes')
  }

  const [W, H] = MEME_SIZES[meme.size]
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <Sections current="memes" />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/memes" className="text-sm text-muted-foreground hover:text-foreground">
          ← All memes
        </Link>
        <h1 className="text-xl font-semibold">{meme.name}</h1>
        <span role="status" className="text-xs text-muted-foreground">
          {status}
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          aria-label={`Preview of ${meme.name}`}
          className="max-h-[75vh] w-full rounded-lg border object-contain"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        <div className="grid content-start gap-4">
          <Row label="Name">
            <Input
              value={meme.name}
              onChange={(e) => e.target.value && set({ name: e.target.value })}
            />
          </Row>
          <Row label={`Picture or GIF${meme.media ? ` (${meme.media})` : ''}`}>
            <input
              type="file"
              accept="image/gif,image/png,image/jpeg,image/webp"
              className="text-xs"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Size">
              <Select value={meme.size} onChange={(e) => set({ size: e.target.value as MemeSize })}>
                {Object.keys(MEME_SIZES).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Row>
            <Row label="Picture">
              <Select
                value={meme.fit}
                onChange={(e) => set({ fit: e.target.value as Meme['fit'] })}
              >
                <option value="contain">Whole picture</option>
                <option value="cover">Fill and crop</option>
              </Select>
            </Row>
            <Row label="Layout">
              <Select
                value={meme.layout}
                onChange={(e) => set({ layout: e.target.value as Meme['layout'] })}
              >
                {MEME_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {LAYOUT_NAMES[l]}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label="Background">
              <Input
                type="color"
                value={meme.background}
                onChange={(e) => set({ background: e.target.value })}
              />
            </Row>
            {meme.layout === 'bar' && (
              <>
                <Row label="Bar">
                  <Input
                    type="color"
                    value={meme.bar}
                    onChange={(e) => set({ bar: e.target.value })}
                  />
                </Row>
                <Row label="Bar text">
                  <Input
                    type="color"
                    value={meme.barText}
                    onChange={(e) => set({ barText: e.target.value })}
                  />
                </Row>
              </>
            )}
          </div>
          {meme.layout === 'post' && (
            <fieldset className="grid gap-2 rounded-md border p-2">
              <legend className="px-1 text-xs text-muted-foreground">Who posted it</legend>
              <p className="text-xs text-muted-foreground">
                For your own or made-up accounts. Don't put words in a real person's mouth.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Name">
                  <Input
                    value={meme.post.name}
                    onChange={(e) => setPost({ name: e.target.value })}
                  />
                </Row>
                <Row label="Handle">
                  <Input
                    value={meme.post.handle}
                    onChange={(e) => setPost({ handle: e.target.value })}
                  />
                </Row>
                <Row label="Time">
                  <Input
                    value={meme.post.time}
                    onChange={(e) => setPost({ time: e.target.value })}
                  />
                </Row>
                <Row label="Card">
                  <Select
                    value={meme.post.dark ? 'dark' : 'light'}
                    onChange={(e) => setPost({ dark: e.target.value === 'dark' })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </Select>
                </Row>
                <Row label="Checkmark">
                  <Select
                    value={meme.post.badge ? 'on' : 'off'}
                    onChange={(e) => setPost({ badge: e.target.value === 'on' })}
                  >
                    <option value="off">None</option>
                    <option value="on">Show</option>
                  </Select>
                </Row>
                <Row label="Checkmark colour">
                  <Input
                    type="color"
                    value={meme.post.badgeColor}
                    onChange={(e) => setPost({ badgeColor: e.target.value })}
                  />
                </Row>
              </div>
              <Row label={`Face${meme.post.avatar ? ` (${meme.post.avatar})` : ''}`}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="text-xs"
                  onChange={(e) =>
                    void upload(e.target.files?.[0], (avatar) => setPost({ avatar }))
                  }
                />
              </Row>
            </fieldset>
          )}
          {memeMoves(meme) && !meme.media?.endsWith('.gif') && (
            <Row label="Loops every (seconds)">
              <Input
                type="number"
                min={1}
                max={30}
                value={meme.seconds}
                onChange={(e) => {
                  const seconds = Number(e.target.value)
                  if (seconds >= 1 && seconds <= 30) set({ seconds })
                }}
              />
            </Row>
          )}
          {meme.texts.map((t, i) => (
            <fieldset key={i} className="grid gap-2 rounded-md border p-2">
              <legend className="px-1 text-xs text-muted-foreground">Text {i + 1}</legend>
              <Textarea
                rows={2}
                value={t.text}
                onChange={(e) => setText(i, { text: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <Row label="Size">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    step={0.5}
                    value={t.size}
                    onChange={(e) => {
                      const size = Number(e.target.value)
                      if (size >= 1 && size <= 30) setText(i, { size })
                    }}
                  />
                </Row>
                {meme.layout !== 'bar' && meme.layout !== 'post' && (
                  <>
                    <Row label="Colour">
                      <Input
                        type="color"
                        value={t.color}
                        onChange={(e) => setText(i, { color: e.target.value })}
                      />
                    </Row>
                    <Row label="Outline">
                      <Select
                        value={t.outline ? 'on' : 'off'}
                        onChange={(e) => setText(i, { outline: e.target.value === 'on' })}
                      >
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </Select>
                    </Row>
                  </>
                )}
                {meme.layout === 'free' &&
                  (['x', 'y'] as const).map((k) => (
                    <Row key={k} label={k === 'x' ? 'Across %' : 'Down %'}>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={t[k]}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (v >= 0 && v <= 100) setText(i, { [k]: v })
                        }}
                      />
                    </Row>
                  ))}
                {(['at', 'until'] as const).map((k) => (
                  <Row key={k} label={k === 'at' ? 'Shows at (s)' : 'Gone at (s)'}>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      step={0.1}
                      value={t[k] ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '') return setText(i, { [k]: undefined })
                        const v = Number(e.target.value)
                        if (v >= 0 && v <= 60 && (k === 'at' || v > 0)) setText(i, { [k]: v })
                      }}
                    />
                  </Row>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start text-destructive"
                onClick={() => set({ texts: meme.texts.filter((_, j) => j !== i) })}
              >
                Remove text
              </Button>
            </fieldset>
          ))}
          <Button
            variant="secondary"
            onClick={() => set({ texts: [...meme.texts, { ...NEW_TEXT }] })}
          >
            Add text
          </Button>
          <Button onClick={() => void downloadPng()}>Download PNG</Button>
          {memeMoves(meme) && (
            <Button variant="secondary" onClick={() => void downloadGif()}>
              Download GIF
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => (sure ? void remove() : setSure(true))}
          >
            {sure ? 'Really delete this meme?' : 'Delete meme'}
          </Button>
        </div>
      </div>
    </main>
  )
}
