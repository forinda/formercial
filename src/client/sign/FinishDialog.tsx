// Finishing: stamp what's placed, and optionally sign the result with a
// certificate, so readers can check who signed it and that nothing changed.
import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { FileDrop } from '@/client/components/ui/file-drop'
import { Input } from '@/client/components/ui/input'

export type Certificate = { file: File; password: string }

type Props = {
  /** Upload limit for the certificate, as for the rest of the job. */
  maxSize: number
  onFinish(certificate: Certificate | null): void
  onCancel(): void
}

export function FinishDialog({ maxSize, onFinish, onCancel }: Props) {
  const [digital, setDigital] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const ready = !digital || files.length === 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finish"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <form
        className="grid max-h-full w-full max-w-md gap-4 overflow-y-auto rounded-lg bg-background p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) onFinish(digital ? { file: files[0], password } : null)
        }}
      >
        <h2 className="font-semibold">Finish</h2>
        <p className="text-sm text-muted-foreground">
          Everything you placed is drawn into a new copy of the PDF. The one you opened isn't
          changed.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={digital}
            onChange={(e) => setDigital(e.target.checked)}
          />
          <span>
            Digitally sign it too
            <span className="block text-muted-foreground">
              With your certificate (.p12 or .pfx), so readers can check who signed it and that
              nothing changed since.
            </span>
          </span>
        </label>
        {digital && (
          <div className="grid gap-3">
            <FileDrop
              files={files}
              onChange={setFiles}
              accept={['p12', 'pfx']}
              max={1}
              maxSize={maxSize}
              label="Drop your certificate here"
            />
            <label className="grid gap-1 text-sm">
              Certificate's password
              <Input
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              The certificate and its password are deleted when the job ends.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready}>
            {digital ? 'Sign and finish' : 'Finish'}
          </Button>
        </div>
      </form>
    </div>
  )
}
