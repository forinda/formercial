import * as React from 'react'

import { cn } from '@/client/lib/utils'
import { Combobox, type ComboboxItem } from './combobox'

/**
 * A select, drawn as one of ours all the way down.
 *
 * It used to dress a native `<select>`, which styled the box and left the
 * list to the browser — the operating system's palette, a pale panel on a
 * dark theme. Now the picker is the Combobox's own popover, so the list
 * wears the theme too.
 *
 * The API is unchanged, which is the point: `value`, an `onChange` that
 * reads `event.target.value`, and `<option>` children — so fifty-odd call
 * sites become themed without being touched. A hidden native select mirrors
 * the value beneath it: a form still posts it by `name`, and a static render
 * still says which options were offered.
 */
function Select({
  className,
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: React.ComponentProps<'select'>) {
  const items = optionsOf(children)
  const [local, setLocal] = React.useState(() => String(defaultValue ?? items[0]?.value ?? ''))
  const current = value === undefined ? local : String(value)

  const pick = (next: string | null) => {
    const chosen = next ?? ''
    setLocal(chosen)
    // What a native select hands its listener, as far as any caller reads it.
    const target = { value: chosen, name } as HTMLSelectElement
    onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>)
  }

  return (
    <>
      <Combobox
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        className={className}
        triggerClassName={cn('border-input bg-background text-foreground', className)}
        items={items}
        value={current}
        // An option always holds; there is no "nothing" a select can be
        // cleared to beyond the empty option a caller writes themselves.
        required
        placeholder={items.find((item) => item.value === current)?.label ?? 'Select…'}
        searchPlaceholder="Find…"
        onChange={pick}
      />
      <select
        aria-hidden="true"
        tabIndex={-1}
        hidden
        name={name}
        value={current}
        disabled={disabled}
        onChange={() => {}}
      >
        {children}
      </select>
    </>
  )
}

/** The `<option>`s among a select's children, through fragments and arrays. */
export function optionsOf(children: React.ReactNode): ComboboxItem[] {
  const out: ComboboxItem[] = []
  const visit = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      const props = child.props as {
        value?: unknown
        disabled?: boolean
        children?: React.ReactNode
      }
      if (child.type === React.Fragment) {
        visit(props.children)
        return
      }
      if (child.type !== 'option') return
      out.push({
        value: String(props.value ?? textOf(props.children)),
        label: textOf(props.children),
        ...(props.disabled ? { disabled: true } : {}),
      })
    })
  }
  visit(children)
  return out
}

/** An option's words, from strings and numbers however they were split up. */
function textOf(node: React.ReactNode): string {
  const parts: string[] = []
  React.Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') parts.push(String(child))
    else if (React.isValidElement(child)) {
      parts.push(textOf((child.props as { children?: React.ReactNode }).children))
    }
  })
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export { Select }
