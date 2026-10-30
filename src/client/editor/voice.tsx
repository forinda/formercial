// Voice for the selected scene: generate it, or record it here.
import { useEffect, useRef, useState } from 'react'
import type { Scene } from '@/core/project'
import type { Clip } from '@/core/timeline'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { Field, Group } from './field'
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
    <section aria-label="Voice" className="grid gap-3">
      <Field id={`spoken-${scene.id}`} label="Spoken line (spell out what the voice would misread)">
        <Textarea
          id={`spoken-${scene.id}`}
          rows={4}
          value={scene.spoken}
          onChange={(e) => props.onScene({ ...scene, spoken: e.target.value })}
        />
      </Field>
      <p className="text-muted-foreground">
        {props.clip
          ? `${scene.voice === 'recording' ? 'Recording' : 'Generated'}, ${props.clip.seconds.toFixed(1)}s`
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
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!!busy || !scene.spoken.trim()}
          onClick={() =>
            run('scene', () =>
              api(`/api/v1/projects/${slug}/voice/${scene.id}`, { method: 'POST' }),
            )
          }
        >
          {busy === 'scene' ? 'Generating…' : 'Generate this line'}
        </Button>
        <Button
          variant="secondary"
          disabled={!!busy}
          onClick={() =>
            run('all', () => api(`/api/v1/projects/${slug}/voice`, { method: 'POST' }))
          }
        >
          {busy === 'all' ? 'Generating…' : 'Generate all lines'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Generated voice sends the spoken lines to Microsoft's speech service.
      </p>
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
        <Button variant="outline" onClick={() => props.onScene({ ...scene, voice: 'tts' })}>
          Use generated voice
        </Button>
      )}
      {error && <p className="text-destructive">{error}</p>}
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
    <Group title="Record it yourself">
      <div className="flex flex-wrap gap-2">
        {state === 'recording' ? (
          <Button variant="destructive" onClick={() => recorder.current?.stop()}>
            Stop <span className="font-mono tabular-nums">{seconds.toFixed(1)}s</span>
          </Button>
        ) : (
          <Button variant="secondary" onClick={start}>
            {state === 'done' ? 'Retake' : 'Record'}
          </Button>
        )}
        {blob && state === 'done' && (
          <Button variant="secondary" onClick={() => onUse(blob)}>
            Use this recording
          </Button>
        )}
      </div>
      {url && state === 'done' && <audio controls src={url} />}
      {error && <p className="text-destructive">{error}</p>}
    </Group>
  )
}
