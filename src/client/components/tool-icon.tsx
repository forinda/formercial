// Each utility's icon, by its id; a new tool without one gets its group's.
import {
  Clapperboard,
  FileCode,
  FileOutput,
  FilePen,
  FileStack,
  FileText,
  Printer,
  Repeat,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/client/lib/utils'

const BY_ID: Record<string, LucideIcon> = {
  'media-convert': Clapperboard,
  'office-to-pdf': FileOutput,
  'office-convert': Repeat,
  'pdf-to-docx': FilePen,
  'html-to-docx': FileCode,
  'html-to-pdf': Printer,
}

const BY_GROUP: Record<string, LucideIcon> = {
  media: Clapperboard,
  documents: FileText,
  pdf: FileStack,
}

export function ToolIcon({
  id,
  group,
  className,
}: {
  id: string
  group: string
  className?: string
}) {
  const Icon = BY_ID[id] ?? BY_GROUP[group] ?? FileText
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary',
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}
