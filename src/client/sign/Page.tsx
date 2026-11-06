// One page of the document: drawn only when it's near the view (so a long
// document opens quickly), with its placed items on top. Clicking empty page
// with a placing tool chosen drops an item there.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LoadedPdf } from './pdf'

type Props = {
  pdf: LoadedPdf
  page: number
  /** Pixels per point. */
  scale: number
  /** Called with where it was clicked, in fractions of the page. */
  onClick?(at: { x: number; y: number }): void
  /** How much of it is in view, as it changes. */
  onSeen?(ratio: number): void
  /** A thumbnail: not a scroll target. */
  thumb?: boolean
  className?: string
  children?: ReactNode
}

export function PdfPage({ pdf, page, scale, onClick, onSeen, thumb, className, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const { width, height } = pdf.size(page)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting)
        onSeen?.(e.intersectionRatio)
      },
      { rootMargin: '100% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    watch.observe(el)
    return () => watch.disconnect()
  }, [onSeen])

  useEffect(() => {
    if (near && canvas.current) void pdf.render(page, canvas.current, scale)
  }, [near, pdf, page, scale])

  return (
    <div
      ref={box}
      id={thumb ? undefined : `page-${page}`}
      data-drawn={near || undefined}
      // A tap or click, not the start of a scroll: click doesn't fire when a finger moves.
      onClick={(e) => {
        if (!onClick || e.target !== e.currentTarget.firstChild) return
        const r = e.currentTarget.getBoundingClientRect()
        onClick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
      }}
      className={className}
      style={{ position: 'relative', width: width * scale, height: height * scale }}
    >
      <canvas
        ref={canvas}
        aria-label={thumb ? undefined : `Page ${page}`}
        className="absolute inset-0 size-full bg-white"
        style={{ visibility: near ? 'visible' : 'hidden' }}
      />
      {children}
    </div>
  )
}
