// Two fingers on the work area zoom it; the items under them don't move.
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

/** Two fingers on the work area zoom it, from where they started. */
export function usePinch(scale: number, setZoom: (zoom: number) => void) {
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ apart: number; scale: number } | null>(null)
  const apart = () => {
    const [a, b] = [...fingers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  return {
    down(e: ReactPointerEvent) {
      if (e.pointerType !== 'touch') return
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (fingers.current.size === 2) start.current = { apart: apart(), scale }
    },
    move(e: ReactPointerEvent) {
      if (!fingers.current.has(e.pointerId)) return
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const s = start.current
      if (s && fingers.current.size === 2 && s.apart > 0)
        setZoom(Math.min(6, Math.max(0.2, (s.scale * apart()) / s.apart)))
    },
    up(e: ReactPointerEvent) {
      fingers.current.delete(e.pointerId)
      if (fingers.current.size < 2) start.current = null
    },
    active: () => start.current !== null,
  }
}
