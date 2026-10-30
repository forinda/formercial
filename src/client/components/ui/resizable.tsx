import { Group, Panel, Separator, type GroupProps, type PanelProps } from 'react-resizable-panels'
import type { ComponentProps } from 'react'

import { cn } from '@/client/lib/utils'

/**
 * Draggable split panes.
 *
 * A thin skin over `react-resizable-panels`: it owns the drag, the keyboard and
 * the ARIA, and this file owns how it looks. Named the shadcn way so the layout
 * reads as panels rather than as the library.
 *
 * Sizes are pixels when written as bare numbers (`defaultSize={240}`) and
 * percentages as bare strings (`defaultSize="50"`). The shell wants pixels: a
 * sidebar should not grow just because the window did.
 */

/**
 * How wide the grab area is, though the line itself is hairline.
 *
 * A finger needs more room than a cursor, which is why the library asks for two
 * numbers rather than one.
 */
const GRAB_TARGET = { coarse: 16, fine: 8 }

function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      resizeTargetMinimumSize={GRAB_TARGET}
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel({ className, ...props }: PanelProps) {
  return <Panel className={cn('flex min-w-0 flex-col', className)} {...props} />
}

/**
 * The line between two panels.
 *
 * Hairline until it is wanted: the grab area is wider than the line, so it is
 * easy to hit without drawing a gutter down the page. Double-clicking it resets
 * the panel to its default size, which the library gives us.
 */
function ResizableHandle({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      // Only `data-separator` and `data-disabled` are emitted, so the hover and
      // focus states are plain CSS rather than data-attribute selectors.
      className={cn(
        'relative w-px shrink-0 bg-border transition-colors',
        'hover:bg-ring/60 focus-visible:bg-ring focus-visible:outline-none',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
