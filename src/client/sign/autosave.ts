// Saves a value a moment after it last changed. Compared with what was last
// saved (undoing back to the start is a change too); saved again if it changed
// while a save was out; and sent on the way out if it was never saved.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type SaveState = 'saved' | 'saving' | 'failed'

/** `value` is null until there's something to save; the first value is what's already saved. */
export function useAutosave<T>(
  value: T | null,
  save: (value: T, leaving: boolean) => Promise<unknown>,
  delay = 800,
): SaveState {
  const [state, setState] = useState<SaveState>('saved')
  const [again, setAgain] = useState(0)
  // What's on screen and how to save it, as last committed (not a render React may drop).
  const latest = useRef(value)
  const send = useRef(save)
  useLayoutEffect(() => {
    latest.current = value
    send.current = save
  })
  const lastSaved = useRef<T | null>(null)
  const out = useRef(false)

  useEffect(() => {
    if (value === null) return
    if (lastSaved.current === null) {
      lastSaved.current = value
      return
    }
    if (lastSaved.current === value) {
      // Undone back to what's saved before anything went out: nothing to do.
      if (!out.current) setState('saved')
      return
    }
    setState('saving')
    const timer = setTimeout(() => {
      out.current = true
      send.current(value, false).then(
        () => {
          out.current = false
          lastSaved.current = value
          if (latest.current === value) setState('saved')
          else setAgain((n) => n + 1)
        },
        () => {
          out.current = false
          setState('failed')
        },
      )
    }, delay)
    return () => clearTimeout(timer)
  }, [value, again, delay])

  useEffect(
    () => () => {
      const v = latest.current
      if (v !== null && lastSaved.current !== null && v !== lastSaved.current)
        void send.current(v, true).catch(() => {})
    },
    [],
  )
  return state
}
