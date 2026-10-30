// Live preview: the same player the render uses, re-made on every edit, with
// each scene's voice clip played in step.
import { useEffect, useMemo, useRef, useState } from 'react'
import { FORMATS, type Format, type Project } from '@/core/project'
import { resolveTimeline, type Clip, type Timeline } from '@/core/timeline'
import { createPlayer, sceneNeeds, type Player } from '@/player/player'
import { fileUrl } from './useProject'

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

/** Re-made only when the project or clips change: the player is rebuilt on a new timeline. */
export function usePreviewTimeline(project: Project, clips: Record<string, Clip>): Timeline {
  return useMemo(() => resolveTimeline(project, clips, sceneNeeds), [project, clips])
}

export function Preview(props: {
  slug: string
  project: Project
  clips: Record<string, Clip>
  trusted: boolean
  timeline: Timeline
  selected: string
  onSelect(id: string): void
}) {
  const { project, clips, timeline } = props
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null)
  const [format, setFormat] = useState<Format>(project.formats[0] ?? '16:9')
  const [t, setT] = useState(() => Math.min(1, timeline.total))
  const [playing, setPlaying] = useState(false)
  // Open a second in, where the first scene has appeared, not on its blank start.
  const tRef = useRef(Math.min(1, timeline.total))
  const audio = useRef<HTMLAudioElement | null>(null)
  const voiced = useRef('')

  // Jump to the selected scene when it changes from the list.
  useEffect(() => {
    const scene = timeline.scenes.find((s) => s.id === props.selected)
    if (scene && (tRef.current < scene.start || tRef.current >= scene.start + scene.length))
      seek(scene.start + 0.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected])

  useEffect(() => {
    if (!host.current) return
    host.current.innerHTML = ''
    player.current = createPlayer(host.current, project, timeline, format, {
      trusted: props.trusted,
      fontUrl: (path) => fileUrl(props.slug, path),
    })
    player.current.frame(Math.min(tRef.current, timeline.total))
    return () => player.current?.destroy()
  }, [project, timeline, format, props.trusted])

  function sceneAt(time: number) {
    return timeline.scenes.find((s) => time >= s.start && time < s.start + s.length)
  }

  function syncVoice(time: number, on: boolean) {
    const scene = sceneAt(time)
    const clip = scene?.clip
    const key = clip ? `${scene.id}|${clip.path}|${clip.seconds}` : ''
    if (!on || !clip || time - scene.start >= clip.seconds) {
      audio.current?.pause()
      voiced.current = ''
      return
    }
    if (voiced.current === key) return
    voiced.current = key
    audio.current?.pause()
    const a = new Audio(fileUrl(props.slug, clip.path))
    a.currentTime = time - scene.start
    void a.play().catch(() => {})
    audio.current = a
  }

  function seek(time: number) {
    tRef.current = Math.max(0, Math.min(timeline.total, time))
    setT(tRef.current)
    player.current?.frame(tRef.current)
    voiced.current = ''
    syncVoice(tRef.current, playing)
    const scene = sceneAt(tRef.current)
    if (scene && scene.id !== props.selected) props.onSelect(scene.id)
  }

  useEffect(() => {
    if (!playing) {
      audio.current?.pause()
      voiced.current = ''
      return
    }
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      tRef.current = Math.min(timeline.total, tRef.current + (now - last) / 1000)
      last = now
      player.current?.frame(tRef.current)
      setT(tRef.current)
      syncVoice(tRef.current, true)
      if (tRef.current >= timeline.total) return setPlaying(false)
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline])

  const [w, h] = FORMATS[format]
  return (
    <section className="preview" aria-label="Preview">
      <div className="row wrap">
        {(Object.keys(FORMATS) as Format[]).map((f) => (
          <button
            key={f}
            type="button"
            className={f === format ? 'chip on' : 'chip'}
            onClick={() => setFormat(f)}
          >
            {f}
          </button>
        ))}
        <span className="muted">
          {w}×{h}
        </span>
      </div>
      <div
        className="frame"
        style={{ maxWidth: format === '9:16' ? 360 : format === '1:1' ? 520 : '100%' }}
      >
        <div ref={host} />
      </div>
      <div className="transport">
        <button
          type="button"
          onClick={() => {
            if (!playing && tRef.current >= timeline.total - 0.05) seek(0)
            setPlaying(!playing)
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <label htmlFor="seek" className="sr-only">
          Position
        </label>
        <input
          id="seek"
          type="range"
          min={0}
          max={timeline.total}
          step={0.05}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="clock">
          {fmt(t)} / {fmt(timeline.total)}
        </span>
      </div>
      <ol className="timeline" aria-label="Timeline">
        {timeline.scenes.map((s, i) => (
          <li
            key={s.id}
            style={{ flexGrow: s.length }}
            className={s.id === props.selected ? 'on' : ''}
          >
            <button
              type="button"
              onClick={() => seek(s.start + 0.01)}
              title={`${s.length.toFixed(1)}s${s.clip ? `, voice ${s.clip.seconds.toFixed(1)}s` : ', no voice'}`}
            >
              {i + 1} · {s.length.toFixed(1)}s{s.clip ? '' : ' · silent'}
            </button>
          </li>
        ))}
      </ol>
      {clips && Object.keys(clips).length === 0 && (
        <p className="muted">No voice yet: generate it or record each scene.</p>
      )}
    </section>
  )
}
