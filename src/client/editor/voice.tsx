// Voice for the selected scene: generate it, or record it here.
import { useEffect, useRef, useState } from 'react'
import type { Scene } from '../../core/project'
import type { Clip } from '../../core/timeline'
import { api, fileUrl } from './useProject'

export function VoicePanel(props: {
  slug: string
  scene: Scene
  clip?: Clip
  onScene(s: Scene): void
  onClipsChanged(): void
}) {
  const { slug, scene } = props
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    setError('')
    try {
      await fn()
      props.onClipsChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="panel" aria-label="Voice">
      <h2>Voice</h2>
      <p className="muted">
        {props.clip
          ? `${scene.voice === 'recording' ? 'Recording' : 'Generated'} · ${props.clip.seconds.toFixed(1)}s`
          : scene.spoken.trim()
            ? 'No clip yet for this line.'
            : 'No spoken line: this scene is silent.'}
      </p>
      {props.clip && (
        <audio
          controls
          src={fileUrl(slug, props.clip.path)}
          key={props.clip.path + props.clip.seconds}
        />
      )}
      <div className="row wrap">
        <button
          type="button"
          disabled={!!busy || !scene.spoken.trim()}
          onClick={() =>
            run('scene', () =>
              api(`/api/v1/projects/${slug}/voice/${scene.id}`, { method: 'POST' }),
            )
          }
        >
          {busy === 'scene' ? 'Generating…' : 'Generate this line'}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            run('all', () => api(`/api/v1/projects/${slug}/voice`, { method: 'POST' }))
          }
        >
          {busy === 'all' ? 'Generating…' : 'Generate all lines'}
        </button>
      </div>
      <p className="note">Generated voice sends the spoken lines to Microsoft's speech service.</p>
      <Recorder
        onUse={(blob) =>
          run('upload', async () => {
            await api(`/api/v1/projects/${slug}/recordings/${scene.id}`, {
              method: 'PUT',
              body: blob,
              headers: { 'content-type': blob.type || 'audio/webm' },
            })
            props.onScene({ ...scene, voice: 'recording' })
          })
        }
      />
      {scene.voice === 'recording' && (
        <button type="button" onClick={() => props.onScene({ ...scene, voice: 'tts' })}>
          Use generated voice
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

function Recorder({ onUse }: { onUse(blob: Blob): void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const url = blob ? URL.createObjectURL(blob) : ''
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  useEffect(() => {
    if (state !== 'recording') return
    const start = performance.now()
    const timer = setInterval(() => setSeconds((performance.now() - start) / 1000), 100)
    return () => clearInterval(timer)
  }, [state])

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus'
      const rec = new MediaRecorder(stream, { mimeType: type })
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setBlob(new Blob(chunks, { type: rec.mimeType }))
        setState('done')
      }
      rec.start()
      recorder.current = rec
      setState('recording')
    } catch (err) {
      setError(`Can't record: ${(err as Error).message}`)
    }
  }

  return (
    <div className="recorder">
      <h3>Record it yourself</h3>
      <div className="row wrap">
        {state === 'recording' ? (
          <button type="button" className="rec" onClick={() => recorder.current?.stop()}>
            Stop · {seconds.toFixed(1)}s
          </button>
        ) : (
          <button type="button" onClick={start}>
            {state === 'done' ? 'Retake' : 'Record'}
          </button>
        )}
        {blob && state === 'done' && (
          <button type="button" onClick={() => onUse(blob)}>
            Use this recording
          </button>
        )}
      </div>
      {url && state === 'done' && <audio controls src={url} />}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
