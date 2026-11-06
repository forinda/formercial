// Choosing an ink: a few usual ones, or any colour at all.
import { Check } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { INKS } from './items'

type Props = { value: string; onChange(color: string): void; label?: string }

export function InkPicker({ value, onChange, label = 'Ink' }: Props) {
  const custom = !INKS.some((i) => i.color === value.toLowerCase())
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {INKS.map((i) => {
          const on = i.color === value.toLowerCase()
          return (
            <button
              key={i.color}
              type="button"
              title={i.name}
              aria-label={i.name}
              aria-pressed={on}
              onClick={() => onChange(i.color)}
              className={cn(
                'grid size-7 place-items-center rounded-full border-2 touch:size-9',
                on ? 'border-primary' : 'border-transparent hover:border-muted-foreground/40',
              )}
            >
              <span
                className="grid size-5 place-items-center rounded-full touch:size-7"
                style={{ background: i.color }}
              >
                {on && <Check className="size-3 text-white" aria-hidden />}
              </span>
            </button>
          )
        })}
        <label
          title="Any colour"
          className={cn(
            'relative grid size-7 cursor-pointer place-items-center rounded-full border-2 touch:size-9',
            custom ? 'border-primary' : 'border-transparent hover:border-muted-foreground/40',
          )}
        >
          <span
            aria-hidden
            className="size-5 rounded-full touch:size-7"
            style={{
              background: custom
                ? value
                : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            }}
          />
          <input
            type="color"
            aria-label="Any colour"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </fieldset>
  )
}
