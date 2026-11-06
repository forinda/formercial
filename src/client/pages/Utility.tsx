import { Link } from '@inertiajs/react'
import { useState } from 'react'
import { Sections } from '@/client/components/sections'
import { ToolIcon } from '@/client/components/tool-icon'
import { Button } from '@/client/components/ui/button'
import { FileDrop, kindOf, RemotePreview } from '@/client/components/ui/file-drop'
import { Input } from '@/client/components/ui/input'
import { outputUrl, useToolJob } from '@/client/lib/tool-job'
import type { ToolSummary } from '@/modules/tools/tool-jobs.service'

const EXTS: Record<string, string[]> = {
  ooxml: ['docx', 'xlsx', 'pptx'],
  jpg: ['jpg', 'jpeg'],
  html: ['html', 'htm'],
  p12: ['p12', 'pfx'],
}
/** Extensions to offer for the kinds a tool takes (as the server sniffs them). */
const accepts = (kinds: string[]) => [...new Set(kinds.flatMap((k) => EXTS[k] ?? [k]))]

const defaults = (tool: ToolSummary) =>
  Object.fromEntries(
    tool.fields.map((f) => [
      f.key,
      f.kind === 'select' ? f.choices[0].value : f.kind === 'text' ? '' : 0,
    ]),
  ) as Record<string, string | number>

export default function Utility({ tool }: { tool: ToolSummary }) {
  const [options, setOptions] = useState(() => defaults(tool))
  const [files, setFiles] = useState<File[]>([])
  const { job, step, error, busy, run: start } = useToolJob(tool.id)

  function run(e: { preventDefault(): void }) {
    e.preventDefault()
    void start(
      options,
      files.map((f) => ({ name: f.name, body: f })),
    )
  }

  const max = tool.maxFiles
  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <Sections current="utilities" />
      <div className="grid gap-1">
        <Link href="/utilities" className="text-sm text-muted-foreground hover:text-foreground">
          ← All utilities
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <ToolIcon id={tool.id} group={tool.group} />
          {tool.title}
        </h1>
        <p className="text-muted-foreground">{tool.description}</p>
        {tool.note && <p className="text-sm text-muted-foreground">{tool.note}</p>}
      </div>
      {tool.missing.length > 0 ? (
        <p className="text-destructive">
          This machine is missing {tool.missing.join(', ')} for this one.
        </p>
      ) : (
        <form onSubmit={run} className="grid gap-4">
          <FileDrop
            files={files}
            onChange={setFiles}
            accept={accepts(tool.accepts)}
            max={max}
            maxSize={tool.maxSize}
            disabled={busy}
            label={max > 1 ? 'Drop your files here' : 'Drop your file here'}
          />
          {tool.fields.map((f) => (
            <label key={f.key} className="grid gap-1 text-sm">
              {f.label}
              {f.kind === 'select' ? (
                <select
                  value={options[f.key]}
                  onChange={(e) => setOptions({ ...options, [f.key]: e.target.value })}
                  className="h-9 rounded-md border bg-background px-3"
                >
                  {f.choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : f.kind === 'text' ? (
                <Input
                  type={f.secret ? 'password' : 'text'}
                  autoComplete={f.secret ? 'off' : undefined}
                  value={options[f.key]}
                  onChange={(e) => setOptions({ ...options, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  value={options[f.key]}
                  onChange={(e) => setOptions({ ...options, [f.key]: Number(e.target.value) || 0 })}
                />
              )}
            </label>
          ))}
          <Button type="submit" disabled={busy || files.length < tool.minFiles}>
            {step || (busy ? 'Working…' : tool.action)}
          </Button>
        </form>
      )}
      <div aria-live="polite" className="grid gap-2">
        {error && <p className="text-destructive">{error}</p>}
        {job?.state === 'queued' && <p className="text-muted-foreground">Waiting for its turn…</p>}
        {job?.state === 'running' && <p className="text-muted-foreground">Working on it…</p>}
        {job?.state === 'failed' && <p className="text-destructive">It didn't work: {job.error}</p>}
        {job?.state === 'done' && (
          <ul className="grid gap-3" aria-label="Results">
            {job.outputs.map(({ file, name }) => {
              const url = outputUrl(job, file)
              return (
                <li key={file} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <Button asChild size="sm">
                      <a href={url} download>
                        Download
                      </a>
                    </Button>
                  </div>
                  {kindOf(name) !== 'html' && <RemotePreview url={`${url}?view=1`} name={name} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
