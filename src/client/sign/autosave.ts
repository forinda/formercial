// Saves a value a moment after it last changed. Compared with what was last
// saved (undoing back to the start is a change too); saved again if it changed
// while a save was out; and sent on the way out if it was never saved.
import { useEffect, useRef, useState } from 'react'

export type SaveState = 'saved' | 'saving' | 'failed'

/** `value` is null until there's something to save; the first value is what's already saved. */
export function useAutosave<T>(
  value: T | null,
  save: (value: T, leaving: boolean) => Promise<unknown>,
  delay = 800,
): SaveState {
  const [state, setState] = useState<SaveState>('saved')
  const [again, setAgain] = useState(0)
  const latest = useRef(value)
  latest.current = value
  const lastSaved = useRef<T | null>(null)
  const send = useRef(save)
  send.current = save

  useEffect(() => {
    if (value === null) return
    if (lastSaved.current === null) {
      lastSaved.current = value
      return
    }
    if (lastSaved.current === value) return
    setState('saving')
    const timer = setTimeout(() => {
      send.current(value, false).then(
        () => {
          lastSaved.current = value
          if (latest.current === value) setState('saved')
          else setAgain((n) => n + 1)
        },
        () => setState('failed'),
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
