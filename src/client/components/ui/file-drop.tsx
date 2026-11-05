// Pick files by dropping them, clicking, or the keyboard; each one listed with a
// preview where the browser can show one, and can be removed or moved.
import { ArrowDown, ArrowUp, FileText, Upload, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/client/lib/utils'

type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'html' | 'other'

const BY_EXT: Record<string, Kind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  pdf: 'pdf',
  html: 'html',
  htm: 'html',
}

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** What kind of preview a file gets, from its name. */
export const kindOf = (name: string): Kind => BY_EXT[extOf(name)] ?? 'other'

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${Number((n / 1024 / 1024).toFixed(1))} MB`
}

/** A file shown the way the browser can: picture, player, page, or nothing. */
export function FilePreview({
  url,
  name,
  className,
}: {
  url: string
  name: string
  className?: string
}) {
  const kind = kindOf(name)
  const box = cn('w-full rounded-md border bg-secondary/40', className)
  if (kind === 'image')
    return <img src={url} alt={name} className={cn(box, 'max-h-64 object-contain')} />
  if (kind === 'video') return <video src={url} controls muted className={cn(box, 'max-h-64')} />
  if (kind === 'audio') return <audio src={url} controls className="w-full" />
  if (kind === 'pdf') return <iframe src={url} title={name} className={cn(box, 'h-80')} />
  // No scripts and no origin of its own: the page can show, not act.
  if (kind === 'html')
    return <iframe src={url} title={name} sandbox="" className={cn(box, 'h-64 bg-white')} />
  return null
}

/** A blob's URL for as long as it's shown. Made in an effect, so React's double run can't revoke it. */
function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/**
 * A file on the server, previewed. Pages (PDF) can't be framed from the server,
 * which forbids framing, so they're fetched and shown from a blob instead.
 */
export function RemotePreview({ url, name }: { url: string; name: string }) {
  const framed = kindOf(name) === 'pdf'
  const [blob, setBlob] = useState<Blob | null>(null)
  useEffect(() => {
    if (!framed) return
    let live = true
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => live && setBlob(new Blob([b], { type: 'application/pdf' })))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [url, framed])
  const local = useObjectUrl(blob)
  if (framed) return local ? <FilePreview url={local} name={name} /> : null
  return <FilePreview url={url} name={name} />
}

function Picked({
  file,
  index,
  count,
  onRemove,
  onMove,
}: {
  file: File
  index: number
  count: number
  onRemove: () => void
  onMove: (by: number) => void
}) {
  const url = useObjectUrl(file)
  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
        {count > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label={`Move ${file.name} up`}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
              aria-label={`Move ${file.name} down`}
            >
              <ArrowDown />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
        >
          <X />
        </Button>
      </div>
      {url && <FilePreview url={url} name={file.name} />}
    </li>
  )
}

export function FileDrop({
  files,
  onChange,
  accept,
  max = 1,
  maxSize,
  disabled,
  label = 'Drop files here',
}: {
  files: File[]
  onChange: (files: File[]) => void
  /** File extensions, without the dot. */
  accept: string[]
  max?: number
  maxSize?: number
  disabled?: boolean
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const hint = useId()
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState('')

  function add(list: FileList | null) {
    if (!list?.length) return
    const fresh = [...list]
    const refused = fresh.filter((f) => !accept.includes(extOf(f.name)))
    const tooBig = maxSize ? fresh.filter((f) => f.size > maxSize) : []
    const ok = fresh.filter((f) => !refused.includes(f) && !tooBig.includes(f))
    // One file: a new pick replaces it. Several: added on, up to the limit.
    const next = max === 1 ? ok.slice(0, 1) : [...files, ...ok].slice(0, max)
    const over = max === 1 ? ok.length > 1 : files.length + ok.length > max
    setProblem(
      [
        refused.length && `${refused.map((f) => f.name).join(', ')}: not a kind this takes`,
        tooBig.length &&
          `${tooBig.map((f) => f.name).join(', ')}: larger than ${formatSize(maxSize ?? 0)}`,
        over && `only ${max} at a time`,
      ]
        .filter(Boolean)
        .join('. '),
    )
    if (ok.length) onChange(next)
  }

  function move(i: number, by: number) {
    const next = [...files]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }

  const full = max > 1 && files.length >= max
  return (
    <div className="grid gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={hint}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => {
          if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return
          e.preventDefault()
          input.current?.click()
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
        }}
        onDragLeave={(e) => {
          // Only on leaving the zone itself, not moving between its children.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!disabled) add(e.dataTransfer.files)
        }}
        className={cn(
          'grid cursor-pointer place-items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors outline-none',
          'hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40',
          over && 'border-primary bg-primary/5',
          disabled && 'pointer-events-none opacity-50',
          full && 'py-5',
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-medium">
          {full ? 'That is all this takes' : over ? 'Let go to add them' : label}
        </span>
        <span id={hint} className="text-sm text-muted-foreground">
          or click to choose · {accept.map((a) => a.toUpperCase()).join(', ')}
          {max > 1 && ` · up to ${max}`}
          {maxSize ? ` · ${formatSize(maxSize)} each` : ''}
        </span>
        <input
          ref={input}
          type="file"
          hidden
          multiple={max > 1}
          accept={accept.map((a) => `.${a}`).join(',')}
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {files.length > 0 && (
        <ul className="grid gap-2" aria-label="Chosen files">
          {files.map((f, i) => (
            <Picked
              key={`${f.name}-${f.size}-${f.lastModified}`}
              file={f}
              index={i}
              count={files.length}
              onRemove={() => onChange(files.filter((_, j) => j !== i))}
              onMove={(by) => move(i, by)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
