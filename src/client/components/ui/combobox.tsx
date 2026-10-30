/**
 * Combobox — a searchable picker for one value or several.
 *
 *   - **Static** — pass `items`; typing filters them client-side.
 *   - **Remote** — pass `onSearch(query, signal)`; the query is debounced, a
 *     newer query aborts the older one, and the caller owns the fetch.
 *   - **Multi** — `multi` with `value: string[]`; selections show as removable
 *     chips above the trigger.
 *
 * Built on Radix Popover and cmdk, so keyboard navigation, focus management
 * and accessibility come with it.
 */
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Popover as PopoverPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/client/lib/utils'

export interface ComboboxItem {
  readonly value: string
  readonly label: string
  /** A smaller second line, e.g. an email under a name. */
  readonly description?: string
  readonly disabled?: boolean
}

// `| undefined` on optional props so wrappers compiled with
// `exactOptionalPropertyTypes` can pass their own optional props straight through.
interface BaseProps {
  readonly placeholder?: string | undefined
  readonly searchPlaceholder?: string | undefined
  readonly emptyMessage?: string | undefined
  /** An action shown with the empty message, so a dead end offers a way on. */
  readonly emptyAction?: React.ReactNode | undefined
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
  readonly triggerClassName?: string | undefined
  readonly contentClassName?: string | undefined
  readonly 'aria-label'?: string | undefined
  /** The id of help text that names what belongs in the field. */
  readonly 'aria-describedby'?: string | undefined
  readonly id?: string | undefined
  /**
   * Labels for values the caller already knows about.
   *
   * Only `onSearch` needs this, and it needs it badly: the items are
   * whatever the last query answered, so a value chosen before — or one
   * that arrived with the record being edited — is not among them, and
   * the trigger would print the raw value. On a people picker that is a
   * user id where a name should be.
   */
  readonly selectedItems?: ReadonlyArray<ComboboxItem> | undefined
}

interface StaticItemsProps extends BaseProps {
  readonly items: ReadonlyArray<ComboboxItem>
  readonly onSearch?: never
}

interface RemoteSearchProps extends BaseProps {
  readonly items?: never
  readonly onSearch: (query: string, signal: AbortSignal) => Promise<ReadonlyArray<ComboboxItem>>
  /** Default 250ms. */
  readonly debounceMs?: number
  /** Shown before anything is typed. */
  readonly initialItems?: ReadonlyArray<ComboboxItem>
}

interface SingleSelectProps {
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly multi?: false
  /** Always has a value: no clear button, and picking the current item keeps it. */
  readonly required?: boolean | undefined
}

interface MultiSelectProps {
  readonly value: ReadonlyArray<string>
  readonly onChange: (value: ReadonlyArray<string>) => void
  readonly multi: true
  /** Further picks beyond this are ignored. */
  readonly max?: number | undefined
}

export type ComboboxProps = (StaticItemsProps | RemoteSearchProps) &
  (SingleSelectProps | MultiSelectProps)

/**
 * Scroll the options with the wheel, even inside a modal dialog.
 *
 * A modal dialog locks scrolling with `react-remove-scroll`, which cancels
 * wheel events across the document; the popover is portalled to the body, so
 * its list is outside the subtree the lock spares and the wheel does nothing.
 * The list still scrolled by keyboard and by dragging its bar, which is why
 * this reads as "the picker is broken" rather than as a scroll bug.
 *
 * Only while the lock is on: otherwise this would scroll on top of the
 * browser's own handling and move twice as far.
 */
function wheelThroughScrollLock(event: React.WheelEvent<HTMLElement>): void {
  if (!document.body.hasAttribute('data-scroll-locked')) return
  const list = event.currentTarget
  if (list.scrollHeight <= list.clientHeight) return
  list.scrollTop += event.deltaY
  event.preventDefault()
}

export function Combobox(props: ComboboxProps) {
  const {
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyMessage = 'No results.',
    emptyAction,
    disabled,
    className,
    triggerClassName,
    contentClassName,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    id,
    selectedItems,
  } = props

  const remote =
    typeof (props as RemoteSearchProps).onSearch === 'function'
      ? (props as RemoteSearchProps)
      : null
  const staticItems = remote ? [] : ((props as StaticItemsProps).items ?? [])

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [remoteItems, setRemoteItems] = React.useState<ReadonlyArray<ComboboxItem>>(
    remote?.initialItems ?? [],
  )
  const [loading, setLoading] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (!remote) return
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      remote
        .onSearch(query, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setRemoteItems(items)
        })
        .catch(() => {
          /* aborts and transient errors: the caller owns retry */
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, remote.debounceMs ?? 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, remote?.onSearch])

  const items = remote ? remoteItems : staticItems
  const selectedValues: ReadonlyArray<string> = props.multi
    ? props.value
    : props.value
      ? [props.value]
      : []
  // A selection that is not in the current results (a previous search page)
  // still shows: by what the caller knows about it, and only failing that
  // under its own value, so the chip never silently disappears.
  const selected = selectedValues.map(
    (v) =>
      items.find((it) => it.value === v) ??
      selectedItems?.find((it) => it.value === v) ?? { value: v, label: v },
  )

  function pick(value: string) {
    if (props.multi) {
      const current = props.value
      if (current.includes(value)) props.onChange(current.filter((v) => v !== value))
      else if (props.max === undefined || current.length < props.max)
        props.onChange([...current, value])
      return
    }
    props.onChange(props.value === value && !props.required ? null : value)
    setOpen(false)
  }

  function clearAll(event: React.MouseEvent) {
    event.stopPropagation()
    if (props.multi) props.onChange([])
    else props.onChange(null)
  }

  const label = props.multi ? (
    selectedValues.length === 0 ? (
      <span className="truncate text-muted-foreground">{placeholder}</span>
    ) : (
      <span className="truncate">{selectedValues.length} selected</span>
    )
  ) : selected[0] ? (
    <span className="truncate">{selected[0].label}</span>
  ) : (
    <span className="truncate text-muted-foreground">{placeholder}</span>
  )

  return (
    <div className={cn('w-full', className)}>
      {props.multi && selected.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {selected.map((it) => (
            <span
              key={it.value}
              className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {it.label}
              <button
                type="button"
                aria-label={`Remove ${it.label}`}
                onClick={(e) => {
                  e.stopPropagation()
                  pick(it.value)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            data-slot="combobox"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              'flex h-8 touch:h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
              triggerClassName,
            )}
          >
            {/* `min-w-0` lets the label truncate instead of pushing the icons out. */}
            <span className="min-w-0 flex-1 text-left">{label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {selectedValues.length > 0 && !disabled && (props.multi || !props.required) && (
                // A span, not a button: the trigger already is a button, and a
                // nested one is invalid HTML.
                <span
                  role="button"
                  aria-label="Clear selection"
                  onClick={clearAll}
                  tabIndex={-1}
                  className="inline-flex cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </span>
              )}
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </span>
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className={cn(
              // Sized to the options, never narrower than the trigger, so
              // labels are not cut to the field's width.
              'z-50 w-max max-w-[min(28rem,var(--radix-popover-content-available-width))] min-w-[max(14rem,var(--radix-popover-trigger-width))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
              contentClassName,
            )}
          >
            <Command shouldFilter={!remote}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                className="w-full border-b bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <CommandList
                className="max-h-64 overflow-y-auto p-1"
                onWheel={wheelThroughScrollLock}
              >
                {loading && (
                  <div className="py-3 text-center text-xs text-muted-foreground">Searching…</div>
                )}
                <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                  <span>{emptyMessage}</span>
                  {emptyAction && <div className="mt-2">{emptyAction}</div>}
                </CommandEmpty>
                <CommandGroup>
                  {items.map((it) => {
                    const isSelected = selectedValues.includes(it.value)
                    return (
                      <CommandItem
                        key={it.value}
                        value={it.value}
                        keywords={[it.label, it.description ?? ''].filter(Boolean)}
                        disabled={it.disabled ?? false}
                        onSelect={() => !it.disabled && pick(it.value)}
                        className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-[13px] aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
                      >
                        <IconCheck
                          className={cn(
                            'mt-0.5 size-3.5 shrink-0',
                            isSelected ? 'text-foreground' : 'text-transparent',
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate">{it.label}</div>
                          {it.description && (
                            <div className="truncate text-xs text-muted-foreground">
                              {it.description}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  )
}
