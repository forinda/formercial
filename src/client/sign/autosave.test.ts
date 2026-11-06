// @vitest-environment happy-dom
// Saving what's placed as it changes: a moment after the last change, again if
// it changed while saving, and on the way out if it was never saved.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useAutosave } from './autosave'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function mount(first: string[]) {
  const sent: { value: string[]; leaving: boolean }[] = []
  const pending: (() => void)[] = []
  const seen = { state: '' }
  function Box({ value }: { value: string[] }) {
    seen.state = useAutosave(value, (v, leaving) => {
      sent.push({ value: v, leaving })
      return new Promise<void>((done) => pending.push(done))
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  const show = (value: string[]) => act(() => root.render(h(Box, { value })))
  show(first)
  const settle = async () => {
    await act(async () => {
      pending.splice(0).forEach((done) => done())
    })
  }
  return { sent, seen, show, settle, unmount: () => act(() => root.unmount()) }
}

describe('autosave', () => {
  test('saves a moment after the last change', async () => {
    const opened = ['a']
    const { sent, seen, show, settle } = mount(opened)
    show(['a', 'b'])
    expect(seen.state).toBe('saving')
    act(() => vi.advanceTimersByTime(800))
    expect(sent.map((s) => s.value)).toEqual([['a', 'b']])
    await settle()
    expect(seen.state).toBe('saved')
  })

  test('undone back to what was saved while a save is out: saves again', async () => {
    const opened = ['a']
    const { sent, seen, show, settle } = mount(opened)
    show(['a', 'b'])
    act(() => vi.advanceTimersByTime(800))
    // Undo, while ['a', 'b'] is still on its way.
    show(opened)
    await settle()
    expect(seen.state).toBe('saving')
    act(() => vi.advanceTimersByTime(800))
    expect(sent.at(-1)?.value).toEqual(['a'])
    await settle()
    expect(seen.state).toBe('saved')
  })

  test('leaving before the save sends it on the way out', () => {
    const { sent, show, unmount } = mount(['a'])
    show(['a', 'b'])
    unmount()
    expect(sent).toEqual([{ value: ['a', 'b'], leaving: true }])
  })

  test('nothing sent for a document left as it was opened', () => {
    const { sent, unmount } = mount(['a'])
    unmount()
    expect(sent).toEqual([])
  })
})
