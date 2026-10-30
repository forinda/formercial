// Project-wide settings (theme, captions, music, formats) and rendering.
import { useEffect, useState } from 'react'
import { FORMATS, type Format, type Project } from '@/core/project'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Progress } from '@/client/components/ui/progress'
import { Select } from '@/client/components/ui/select'
import { Switch } from '@/client/components/ui/switch'
import { Field, Group } from './field'
import { api, fileUrl } from './useProject'

async function upload(slug: string, file: File, name: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `media/${name}.${ext}`
  await api(`/api/v1/projects/${slug}/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type || 'application/octet-stream' },
  })
  return path
}

const FILE_INPUT =
  'w-full text-xs text-muted-foreground file:mr-2 file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:text-[13px] file:font-medium file:text-secondary-foreground'

export function ThemePanel({
  slug,
  project,
  onChange,
  onFontsChanged,
}: {
  slug: string
  project: Project
  onChange(p: Project): void
  onFontsChanged(): void
}) {
  const { theme } = project
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState('')
  const [link, setLink] = useState('')
  const [linkFamily, setLinkFamily] = useState('')
  const [linkWeight, setLinkWeight] = useState('')
  const stored = new Map<string, number[]>()
  for (const f of theme.fonts.files ?? []) {
    stored.set(f.family, [...(stored.get(f.family) ?? []), f.weight])
  }
  const addLink = async () => {
    setFetching('link')
    setError('')
    try {
      await api(`/api/v1/projects/${slug}/fonts`, {
        method: 'POST',
        json: {
          url: link.trim(),
          family: linkFamily.trim() || undefined,
          weight: linkWeight ? Number(linkWeight) : undefined,
        },
      })
      setLink('')
      setLinkFamily('')
      setLinkWeight('')
      onFontsChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setFetching('')
    }
  }
  const setColor = (key: keyof Project['theme']['colors'], value: string) =>
    onChange({ ...project, theme: { ...theme, colors: { ...theme.colors, [key]: value } } })
  return (
    <section aria-label="Project" className="grid gap-4">
      <Field id="p-name" label="Name">
        <Input
          id="p-name"
          value={project.name}
          onChange={(e) => onChange({ ...project, name: e.target.value })}
        />
      </Field>
      <Group title="Formats to render">
        <div className="flex flex-wrap gap-4">
          {(Object.keys(FORMATS) as Format[]).map((f) => (
            <label key={f} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-primary"
                checked={project.formats.includes(f)}
                onChange={(e) => {
                  const formats = e.target.checked
                    ? [...project.formats, f]
                    : project.formats.filter((x) => x !== f)
                  if (formats.length) onChange({ ...project, formats })
                }}
              />
              {f}
            </label>
          ))}
        </div>
      </Group>
      <Group title="Colors">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
          {(Object.keys(theme.colors) as (keyof typeof theme.colors)[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="color"
                className="size-6 shrink-0 cursor-pointer rounded-sm bg-transparent"
                value={theme.colors[k]}
                onChange={(e) => setColor(k, e.target.value)}
              />
              {k}
            </label>
          ))}
        </div>
      </Group>
      <Group title="Fonts">
        {(['display', 'body', 'mono'] as const).map((k) => {
          const family = theme.fonts[k]
          const inProject = stored.has(family)
          return (
            <div className="flex items-end gap-2" key={k}>
              <Field id={`font-${k}`} label={k}>
                <Input
                  id={`font-${k}`}
                  value={family}
                  onChange={(e) =>
                    onChange({
                      ...project,
                      theme: { ...theme, fonts: { ...theme.fonts, [k]: e.target.value } },
                    })
                  }
                />
              </Field>
              <Button
                variant="secondary"
                disabled={!!fetching || inProject}
                title="Download this Google Fonts family into the project"
                onClick={async () => {
                  setFetching(k)
                  setError('')
                  try {
                    await api(`/api/v1/projects/${slug}/fonts`, {
                      method: 'POST',
                      json: { family },
                    })
                    onFontsChanged()
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setFetching('')
                  }
                }}
              >
                {inProject ? 'In project' : fetching === k ? 'Downloading…' : 'Download'}
              </Button>
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground">
          Downloaded fonts are kept in media/fonts/, so renders look the same on any machine.
        </p>
        <Field id="font-link" label="Add from a link (stylesheet or font file)">
          <div className="flex gap-2">
            <Input
              id="font-link"
              type="url"
              placeholder="https://fonts.bunny.net/css?family=inter:400,700"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <Button variant="secondary" disabled={!!fetching || !link.trim()} onClick={addLink}>
              {fetching === 'link' ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </Field>
        <div className="flex gap-2">
          <Field id="font-link-family" label="Family (font file links only)">
            <Input
              id="font-link-family"
              value={linkFamily}
              onChange={(e) => setLinkFamily(e.target.value)}
            />
          </Field>
          <div className="w-24 shrink-0">
            <Field id="font-link-weight" label="Weight">
              <Input
                id="font-link-weight"
                type="number"
                min={1}
                max={1000}
                step={100}
                placeholder="400"
                value={linkWeight}
                onChange={(e) => setLinkWeight(e.target.value)}
              />
            </Field>
          </div>
        </div>
        {stored.size > 0 && (
          <ul className="grid gap-1.5">
            {[...stored].map(([family, weights]) => (
              <li key={family} className="flex flex-wrap items-center gap-1">
                <span className="w-full">
                  {family}{' '}
                  <span className="text-xs text-muted-foreground">
                    {[...weights].sort((a, b) => a - b).join(', ')}
                  </span>
                </span>
                {(['display', 'body', 'mono'] as const).map((k) => (
                  <Button
                    key={k}
                    variant="outline"
                    size="sm"
                    disabled={theme.fonts[k] === family}
                    title={`Use ${family} for ${k}`}
                    onClick={() =>
                      onChange({
                        ...project,
                        theme: { ...theme, fonts: { ...theme.fonts, [k]: family } },
                      })
                    }
                  >
                    {k}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  title={`Remove ${family} from this project`}
                  onClick={() =>
                    onChange({
                      ...project,
                      theme: {
                        ...theme,
                        fonts: {
                          ...theme.fonts,
                          files: theme.fonts.files?.filter((f) => f.family !== family),
                        },
                      },
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Group>
      <div className="flex items-center gap-2 border-t pt-3">
        <Switch
          id="p-captions"
          checked={project.captions}
          onCheckedChange={(captions) => onChange({ ...project, captions })}
        />
        <Label htmlFor="p-captions" className="text-[13px] font-normal">
          Burn captions into the video
        </Label>
      </div>
      <Field id="p-voice" label="Voice (edge-tts name)">
        <Input
          id="p-voice"
          value={project.voice.tts}
          onChange={(e) =>
            onChange({ ...project, voice: { ...project.voice, tts: e.target.value } })
          }
        />
      </Field>
      <Field id="p-pause" label="Pause after each spoken line (s)">
        <Input
          id="p-pause"
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={project.pauseSeconds}
          onChange={(e) => {
            const pauseSeconds = Number(e.target.value)
            if (e.target.value !== '' && pauseSeconds >= 0 && pauseSeconds <= 5) {
              onChange({ ...project, pauseSeconds })
            }
          }}
        />
      </Field>
      <Field id="p-logo" label="Logo">
        <input
          id="p-logo"
          type="file"
          accept="image/*"
          className={FILE_INPUT}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              onChange({ ...project, theme: { ...theme, logo: await upload(slug, file, 'logo') } })
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
      </Field>
      <Group title="Background music">
        <input
          id="p-music"
          type="file"
          accept="audio/*"
          aria-label="Music file"
          className={FILE_INPUT}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const path = await upload(slug, file, 'music')
              onChange({
                ...project,
                music: {
                  file: path,
                  volume: project.music?.volume ?? 0.25,
                  duck: project.music?.duck ?? 0.35,
                },
              })
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
        {project.music && (
          <>
            <audio controls src={fileUrl(slug, project.music.file)} />
            {(['volume', 'duck'] as const).map((k) => (
              <Field
                key={k}
                id={`music-${k}`}
                label={`${k === 'volume' ? 'Volume' : 'Level while someone speaks'}: ${Math.round(project.music![k] * 100)}%`}
              >
                <input
                  id={`music-${k}`}
                  type="range"
                  className="w-full accent-primary"
                  min={0}
                  max={1}
                  step={0.05}
                  value={project.music![k]}
                  onChange={(e) =>
                    onChange({
                      ...project,
                      music: { ...project.music!, [k]: Number(e.target.value) },
                    })
                  }
                />
              </Field>
            ))}
            <Button
              variant="destructive"
              className="justify-self-start"
              onClick={() => onChange({ ...project, music: undefined })}
            >
              Remove music
            </Button>
          </>
        )}
      </Group>
      {error && <p className="text-destructive">{error}</p>}
    </section>
  )
}

type Job = {
  id: string
  format: Format
  driver: string
  state: string
  error?: string
  mp4?: string
  progress?: { phase: string; frame?: number; frames?: number }
}
type Driver = { name: string; check: { ok: boolean; missing: string[] } }

export function RenderPanel({
  slug,
  project,
  trusted,
}: {
  slug: string
  project: Project
  trusted: boolean
}) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driver, setDriver] = useState('chromium-ffmpeg')
  const [fps, setFps] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState('')

  const refresh = () =>
    api<{ jobs: Job[]; files: string[] }>(`/api/v1/projects/${slug}/renders`).then((r) => {
      setJobs(r.jobs)
      setFiles(
        r.files
          .filter((f) => f.endsWith('.mp4'))
          .sort()
          .reverse(),
      )
    })

  useEffect(() => {
    void api<Driver[]>('/api/v1/drivers').then((list) => {
      setDrivers(list)
      if (list[0]) setDriver(list[0].name)
    })
    void refresh()
    const events = new EventSource(`/api/v1/projects/${slug}/events`)
    events.addEventListener('job', (e) => {
      const job = JSON.parse((e as MessageEvent).data) as Job
      setJobs((all) =>
        [...all.filter((j) => j.id !== job.id), job].sort((a, b) => Number(a.id) - Number(b.id)),
      )
      if (job.state === 'done') void refresh()
    })
    return () => events.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const chosen = drivers.find((d) => d.name === driver)
  return (
    <section aria-label="Render" className="grid gap-3">
      <div className="flex gap-2">
        <Field id="driver" label="Driver">
          <Select id="driver" value={driver} onChange={(e) => setDriver(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.check.ok ? 'ready' : 'needs setup'})
              </option>
            ))}
          </Select>
        </Field>
        <div className="w-32">
          <Field id="fps" label="Frame rate">
            <Select id="fps" value={fps} onChange={(e) => setFps(e.target.value)}>
              <option value="">Default</option>
              <option value="15">15, a quick draft</option>
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </Select>
          </Field>
        </div>
      </div>
      {chosen && !chosen.check.ok && (
        <p className="text-destructive">Missing: {chosen.check.missing.join(', ')}</p>
      )}
      {!trusted && (
        <p className="text-destructive">This project has custom scenes. Trust it to render them.</p>
      )}
      <Button
        disabled={!chosen?.check.ok || !trusted}
        onClick={async () => {
          setError('')
          try {
            await api(`/api/v1/projects/${slug}/renders`, {
              method: 'POST',
              json: { format: 'all', driver, fps: fps ? Number(fps) : undefined },
            })
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        Render {project.formats.join(', ')}
      </Button>
      {error && <p className="text-destructive">{error}</p>}
      {jobs.length > 0 && (
        <ul className="grid gap-2">
          {jobs.map((j) => {
            const running = j.state === 'running' && j.progress?.frames
            const percent = running
              ? Math.round(((j.progress!.frame ?? 0) / j.progress!.frames!) * 100)
              : 0
            return (
              <li key={j.id} className="grid gap-1">
                <span>
                  <strong className="font-medium">{j.format}</strong> {j.state}
                  {running ? `, ${j.progress!.phase} ${percent}%` : ''}
                </span>
                {running ? <Progress value={percent} label={`Rendering ${j.format}`} /> : null}
                {j.error && <span className="text-destructive">{j.error}</span>}
              </li>
            )
          })}
        </ul>
      )}
      {files.length > 0 && (
        <Group title="Finished videos">
          {files.map((f) => (
            <figure key={f} className="grid gap-1">
              <video controls preload="metadata" src={fileUrl(slug, f)} />
              <figcaption className="text-xs">
                <a href={fileUrl(slug, f)}>{f}</a>
              </figcaption>
            </figure>
          ))}
        </Group>
      )}
    </section>
  )
}
