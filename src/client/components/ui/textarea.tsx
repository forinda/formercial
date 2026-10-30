import * as React from 'react'

import { cn } from '@/client/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/20 placeholder:text-muted-foreground aria-invalid:border-destructive flex min-h-16 w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none transition-[color,border-color,box-shadow] focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
