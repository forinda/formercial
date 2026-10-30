import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/client/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-[13px] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-input bg-background hover:bg-accent aria-expanded:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /*
       * Every size grows on a touch pointer. The desktop numbers are a mouse's
       * density and were being shipped unchanged to thumbs: an `icon-sm` is
       * 28px, well under Apple's 44pt floor and Material's 48dp. The `touch:`
       * variant is `pointer: coarse`, so a mouse user sees none of this however
       * narrow their window.
       */
      size: {
        default: 'h-8 px-3 touch:h-11 touch:px-4',
        xs: "h-6 gap-1 px-2 text-xs touch:h-9 touch:px-3 [&_svg:not([class*='size-'])]:size-3.5",
        sm: 'h-7 px-2.5 touch:h-10 touch:px-3.5',
        lg: 'h-9 px-4 touch:h-12 touch:px-5',
        icon: 'size-8 touch:size-11',
        'icon-xs': "size-6 touch:size-9 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-7 touch:size-10',
        'icon-lg': 'size-9 touch:size-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // A button inside a form submits by default; make that a choice.
      {...(asChild ? {} : { type })}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
