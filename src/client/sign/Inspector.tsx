// The settings panel for the selected item: its ink, words and size, which
// pages it goes on, and removing it.
import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { InkPicker } from './InkPicker'
import {
  DATE_FORMATS,
  formatDate,
  isPicture,
  isText,
  parsePages,
  type DateFormat,
  type Placed,
} from './items'

const NAMES: Record<Placed['label'], string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date',
  name: 'Name',
  text: 'Text',
  tick: 'Tick',
}

type Props = {
  item: Placed
  /** The page it was picked on: "this page", and where Detach leaves a copy. */
  page: number
  pageCount: number
  onChange(next: Placed): void
  onDetach(): void
  onDelete(): void
  onReplacePicture(): void
}

export function Inspector({
  item,
  page,
  pageCount,
  onChange,
  onDetach,
  onDelete,
  onReplacePicture,
}: Props) {
  const all = Array.from({ length: pageCount }, (_, i) => i + 1)
  const where =
    item.pages.length === pageCount && pageCount > 1
      ? 'all'
      : item.pages.length > 1
        ? 'pick'
        : 'this'
  const [pick, setPick] = useState(item.pages.join(', '))
  const picked = parsePages(pick, pageCount)

  return (
    <div className="grid content-start gap-4 p-3 text-sm">
      <h2 className="font-semibold">{NAMES[item.label]}</h2>

      {isPicture(item.label) && (
        <Button variant="outline" size="sm" onClick={onReplacePicture}>
          Change the picture
        </Button>
      )}

      {item.label === 'date' && (
        <label className="grid gap-1">
          Format
          <select
            className="h-8 rounded-md border bg-background px-2"
            onChange={(e) =>
              onChange({ ...item, text: formatDate(new Date(), e.target.value as DateFormat) })
            }
            defaultValue=""
          >
            <option value="" disabled>
              Today, as…
            </option>
            {DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {isText(item.label) && (
        <>
          <label className="grid gap-1">
            Words
            <Input
              value={item.text ?? ''}
              onChange={(e) => onChange({ ...item, text: e.target.value })}
            />
          </label>
          <label className="grid gap-1">
            Size (points)
            <Input
              type="number"
              min={6}
              max={72}
              value={item.size ?? 12}
              onChange={(e) =>
                onChange({ ...item, size: Math.min(72, Math.max(6, Number(e.target.value) || 12)) })
              }
            />
          </label>
        </>
      )}

      {!isPicture(item.label) && (
        <InkPicker value={item.color} onChange={(color) => onChange({ ...item, color })} />
      )}

      <fieldset className="grid gap-1.5">
        <legend className="mb-1">Pages</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={where === 'this'}
            onChange={() => onChange({ ...item, pages: [page] })}
          />
          This page ({page})
        </label>
        {pageCount > 1 && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={where === 'all'}
              onChange={() => onChange({ ...item, pages: all })}
            />
            All pages
          </label>
        )}
        {pageCount > 1 && (
          <label className="grid gap-1">
            <span className="flex items-center gap-2">
              <input
                type="radio"
                checked={where === 'pick'}
                onChange={() => picked && onChange({ ...item, pages: picked })}
              />
              These pages
            </span>
            <Input
              value={pick}
              placeholder="1, 3–5"
              aria-invalid={!picked}
              onChange={(e) => {
                setPick(e.target.value)
                const next = parsePages(e.target.value, pageCount)
                if (next) onChange({ ...item, pages: next })
              }}
            />
            {!picked && (
              <span className="text-xs text-destructive">Pages like 1, 3–5, up to {pageCount}</span>
            )}
          </label>
        )}
        {item.pages.length > 1 && (
          <Button variant="outline" size="sm" onClick={onDetach}>
            Detach page {page} to move it on its own
          </Button>
        )}
      </fieldset>

      <Button variant="destructive" size="sm" onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}
