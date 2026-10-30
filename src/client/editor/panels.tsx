// Project-wide settings (theme, captions, music, formats) and rendering.
import { useEffect, useState } from 'react'
import { FORMATS, type Format, type Project } from '@/core/project'
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
  const setColor = (key: keyof Project['theme']['colors'], value: string) =>
    onChange({ ...project, theme: { ...theme, colors: { ...theme.colors, [key]: value } } })
  return (
    <section className="panel" aria-label="Project">
      <h2>Project</h2>
      <div className="field">
        <label htmlFor="p-name">Name</label>
        <input
          id="p-name"
          value={project.name}
          onChange={(e) => onChange({ ...project, name: e.target.value })}
        />
      </div>
      <fieldset>
        <legend>Formats to render</legend>
        <div className="row wrap">
          {(Object.keys(FORMATS) as Format[]).map((f) => (
            <label key={f} className="check">
              <input
                type="checkbox"
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
      </fieldset>
      <fieldset>
        <legend>Colors</legend>
        <div className="swatches">
          {(Object.keys(theme.colors) as (keyof typeof theme.colors)[]).map((k) => (
            <label key={k} className="swatch">
              <input
                type="color"
                value={theme.colors[k]}
                onChange={(e) => setColor(k, e.target.value)}
              />
              {k}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Fonts</legend>
        {(['display', 'body', 'mono'] as const).map((k) => {
          const family = theme.fonts[k]
          const stored = theme.fonts.files?.some((f) => f.family === family)
          return (
            <div className="row" key={k}>
              <div className="field">
                <label htmlFor={`font-${k}`}>{k}</label>
                <input
                  id={`font-${k}`}
                  value={family}
                  onChange={(e) =>
                    onChange({
                      ...project,
                      theme: { ...theme, fonts: { ...theme.fonts, [k]: e.target.value } },
                    })
                  }
                />
              </div>
              <button
                type="button"
                disabled={!!fetching || stored}
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
                {stored ? 'In project' : fetching === k ? 'Downloading…' : 'Download'}
              </button>
            </div>
          )
        })}
        <p className="note">
          Downloaded fonts are kept in media/fonts/, so renders look the same on any machine.
        </p>
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          checked={project.captions}
          onChange={(e) => onChange({ ...project, captions: e.target.checked })}
        />
        Burn captions into the video
      </label>
      <div className="field">
        <label htmlFor="p-voice">Voice (edge-tts name)</label>
        <input
          id="p-voice"
          value={project.voice.tts}
          onChange={(e) =>
            onChange({ ...project, voice: { ...project.voice, tts: e.target.value } })
          }
        />
      </div>
      <div className="field">
        <label htmlFor="p-logo">Logo</label>
        <input
          id="p-logo"
          type="file"
          accept="image/*"
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
      </div>
      <fieldset>
        <legend>Background music</legend>
        <input
          id="p-music"
          type="file"
          accept="audio/*"
          aria-label="Music file"
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
              <div className="field" key={k}>
                <label htmlFor={`music-${k}`}>
                  {k === 'volume' ? 'Volume' : 'Level while someone speaks'} ·{' '}
                  {Math.round(project.music![k] * 100)}%
                </label>
                <input
                  id={`music-${k}`}
                  type="range"
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
              </div>
            ))}
            <button
              type="button"
              className="danger"
              onClick={() => onChange({ ...project, music: undefined })}
            >
              Remove music
            </button>
          </>
        )}
      </fieldset>
      {error && <p className="error">{error}</p>}
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
    void api<Driver[]>('/api/v1/drivers').then(setDrivers)
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
    <section className="panel" aria-label="Render">
      <h2>Render</h2>
      <div className="field">
        <label htmlFor="driver">Driver</label>
        <select id="driver" value={driver} onChange={(e) => setDriver(e.target.value)}>
          {drivers.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name} {d.check.ok ? '· ready' : '· needs setup'}
            </option>
          ))}
        </select>
      </div>
      {chosen && !chosen.check.ok && (
        <p className="error">Missing: {chosen.check.missing.join(', ')}</p>
      )}
      {!trusted && (
        <p className="error">This project has custom scenes. Trust it to render them.</p>
      )}
      <button
        type="button"
        disabled={!chosen?.check.ok || !trusted}
        onClick={async () => {
          setError('')
          try {
            await api(`/api/v1/projects/${slug}/renders`, {
              method: 'POST',
              json: { format: 'all', driver },
            })
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        Render {project.formats.join(', ')}
      </button>
      {error && <p className="error">{error}</p>}
      <ul className="jobs">
        {jobs.map((j) => (
          <li key={j.id}>
            <strong>{j.format}</strong> {j.state}
            {j.state === 'running' && j.progress?.frames
              ? ` · ${j.progress.phase} ${Math.round(((j.progress.frame ?? 0) / j.progress.frames) * 100)}%`
              : ''}
            {j.error && <span className="error"> · {j.error}</span>}
          </li>
        ))}
      </ul>
      {files.map((f) => (
        <figure key={f} className="render">
          <video controls preload="metadata" src={fileUrl(slug, f)} />
          <figcaption>
            <a href={fileUrl(slug, f)}>{f}</a>
          </figcaption>
        </figure>
      ))}
    </section>
  )
}
