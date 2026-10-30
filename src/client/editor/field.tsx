import type { ReactNode } from 'react'
import { Label } from '@/client/components/ui/label'

/** A label over its control. */
export function Field(props: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid flex-1 content-start gap-1.5">
      <Label htmlFor={props.id} className="font-normal text-muted-foreground">
        {props.label}
      </Label>
      {props.children}
    </div>
  )
}

/** Controls that belong together, named. */
export function Group(props: { title: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="grid gap-2.5 border-t pt-3">
      <legend className="float-left mb-2.5 w-full font-medium">{props.title}</legend>
      {props.children}
    </fieldset>
  )
}
