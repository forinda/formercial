// The app's sections, at the top of each section's page.
import { Link } from '@inertiajs/react'
import { TooltipProvider } from '@/client/components/ui/tooltip'
import { ThemeToggle } from '@/client/editor/theme'
import { cn } from '@/client/lib/utils'

const SECTIONS = [
  { id: 'commercials', href: '/', label: 'Commercials' },
  { id: 'fun', href: '/fun', label: 'Fun Club' },
  { id: 'memes', href: '/memes', label: 'Memes' },
  { id: 'utilities', href: '/utilities', label: 'Utilities' },
] as const
export type Section = (typeof SECTIONS)[number]['id']

export function Sections({ current }: { current: Section }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <nav aria-label="Sections" className="flex flex-wrap gap-1">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            aria-current={s.id === current ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-lg font-semibold text-muted-foreground hover:text-foreground',
              s.id === current && 'bg-secondary text-foreground',
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <TooltipProvider>
        <ThemeToggle />
      </TooltipProvider>
    </header>
  )
}
