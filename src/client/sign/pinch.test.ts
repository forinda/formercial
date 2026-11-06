// @vitest-environment happy-dom
// Fingers on the work area, as the browser sends them: one finger on an item
// drags it; a second finger makes it a pinch that zooms, and the item stays put.
import { act, createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test } from 'vitest'
import { ItemBox } from './ItemBox'
import type { Placed } from './items'
import { usePinch } from './pinch'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const start: Placed = {
  id: 'a',
  label: 'tick',
  pages: [1],
  box: { x: 0.25, y: 0.25, w: 0.1, h: 0.1 },
  color: '#111111',
}

function mount() {
  const seen = { zoom: 1, item: start }
  function Work() {
    const [zoom, setZoom] = useState(1)
    const [item, setItem] = useState(start)
    seen.zoom = zoom
    seen.item = item
    const pinch = usePinch(zoom, setZoom)
    return h(
      'div',
      {
        id: 'work',
        onPointerDown: pinch.down,
        onPointerMove: pinch.move,
        onPointerUp: pinch.up,
        onPointerCancel: pinch.up,
      },
      h(ItemBox, {
        item,
        px: { width: 400, height: 400 },
        scale: 1,
        selected: true,
        onSelect() {},
        onChange: setItem,
        onDelete() {},
        pinching: pinch.active,
      }),
    )
  }
  const root = document.createElement('div')
  document.body.append(root)
  act(() => createRoot(root).render(h(Work)))
  const item = root.querySelector('[role=button]')!
  const work = root.querySelector('#work')!
  const finger = (type: string, on: Element, id: number, x: number, y: number) =>
    act(() => {
      on.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
        }),
      )
    })
  return { seen, item, work, finger }
}

describe('fingers on the work area', () => {
  test('one finger on an item drags it', () => {
    const { seen, item, finger } = mount()
    finger('pointerdown', item, 1, 120, 120)
    finger('pointermove', item, 1, 160, 120)
    finger('pointerup', item, 1, 160, 120)
    expect(seen.item.box.x).toBeCloseTo(0.35)
    expect(seen.zoom).toBe(1)
  })

  test('a pinch that starts on an item zooms, and the item stays put', () => {
    const { seen, item, work, finger } = mount()
    finger('pointerdown', item, 1, 120, 120)
    finger('pointerdown', work, 2, 220, 120)
    // Spread the fingers to twice as far apart.
    finger('pointermove', item, 1, 70, 120)
    finger('pointermove', work, 2, 270, 120)
    finger('pointerup', work, 2, 270, 120)
    finger('pointerup', item, 1, 70, 120)
    expect(seen.zoom).toBeCloseTo(2)
    expect(seen.item.box).toEqual(start.box)
  })
})
