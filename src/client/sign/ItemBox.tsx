// One placed item on a page: drag to move, the corner handle to resize, arrow
// keys to nudge, Delete to remove. Positions are fractions of the page.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/client/lib/utils'
import { isPicture, isText, type Placed } from './items'

type Props = {
  item: Placed
  /** The page's size on screen, in pixels, and in points. */
  px: { width: number; height: number }
  scale: number
  picture?: string
  selected: boolean
  onSelect(): void
  onChange(next: Placed): void
  onDelete(): void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function ItemBox({
  item,
  px,
  scale,
  picture,
  selected,
  onSelect,
  onChange,
  onDelete,
}: Props) {
  // While dragging, the box moves here; it's committed (one undo step) on release.
  const [live, setLive] = useState<Placed | null>(null)
  const start = useRef<{ x: number; y: number; item: Placed; resize: boolean } | null>(null)
  const shown = live ?? item
  const { x, y, w, h } = shown.box

  function down(e: PointerEvent, resize: boolean) {
    e.stopPropagation()
    e.preventDefault()
    onSelect()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, item, resize }
  }

  function move(e: PointerEvent) {
    const s = start.current
    if (!s) return
    const dx = (e.clientX - s.x) / px.width
    const dy = (e.clientY - s.y) / px.height
    const b = s.item.box
    if (!s.resize) {
      setLive({
        ...s.item,
        box: { ...b, x: clamp(b.x + dx, 0, 1 - b.w), y: clamp(b.y + dy, 0, 1 - b.h) },
      })
      return
    }
    // Everything keeps its shape: text grows its letters, pictures and ticks their size.
    const k = clamp((b.w + dx) / b.w, 0.1, Math.min((1 - b.x) / b.w, (1 - b.y) / b.h))
    const size = s.item.size ? Math.min(72, Math.max(6, s.item.size * k)) : undefined
    const kk = size && s.item.size ? size / s.item.size : k
    setLive({ ...s.item, size, box: { ...b, w: b.w * kk, h: b.h * kk } })
  }

  function up() {
    if (live) onChange(live)
    setLive(null)
    start.current = null
  }

  function key(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.05 : 0.01
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      return onDelete()
    }
    const d = by[e.key]
    if (!d) return
    e.preventDefault()
    const b = item.box
    onChange({
      ...item,
      box: { ...b, x: clamp(b.x + d[0], 0, 1 - b.w), y: clamp(b.y + d[1], 0, 1 - b.h) },
    })
  }

  const size = (shown.size ?? 12) * scale
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.label}${item.text ? `: ${item.text}` : ''}`}
      aria-pressed={selected}
      onPointerDown={(e) => down(e, false)}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      onFocus={onSelect}
      className={cn(
        'absolute cursor-move touch-none outline-none select-none',
        selected ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/60',
      )}
      style={{ left: x * px.width, top: y * px.height, width: w * px.width, height: h * px.height }}
    >
      {isPicture(item.label) && picture && (
        <img src={picture} alt="" draggable={false} className="size-full object-fill" />
      )}
      {isText(item.label) && (
        // Helvetica, as the PDF gets it, with the baseline where the server puts it.
        <span
          className="absolute left-0 whitespace-pre leading-none"
          style={{
            top: size * 0.23,
            fontSize: size,
            fontFamily: 'Helvetica, Arial, sans-serif',
            color: shown.color,
          }}
        >
          {shown.text}
        </span>
      )}
      {item.label === 'tick' && (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="size-full">
          <polyline
            points="0.1,0.5 0.4,0.85 0.9,0.15"
            fill="none"
            stroke={shown.color}
            strokeWidth={0.1}
            vectorEffect="none"
          />
        </svg>
      )}
      {selected && (
        <span
          aria-hidden
          onPointerDown={(e) => down(e, true)}
          className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-sm border-2 border-background bg-primary touch:size-6"
        />
      )}
    </div>
  )
}
