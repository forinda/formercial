import { cn } from '@/client/lib/utils'

/** A thin progress bar. `value` is a percentage, clamped to 0–100. */
export function Progress({
  value,
  label,
  className,
}: {
  readonly value: number
  /** Accessible name, e.g. "Goal progress". */
  readonly label?: string | undefined
  readonly className?: string | undefined
}) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
