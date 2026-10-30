// One clip per scene: a recording when the scene uses one, else a generated
// line, made again only when its text, voice or rate changed.
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { probeSeconds } from '../media'
import type { Project, Scene } from '../project'
import type { Clip } from '../timeline'
import { withWorkdir } from '../workdir'
import type { Workspace } from '../workspace'
import type { VoiceProvider } from './provider'

type Made = Record<string, { stamp: string; seconds: number }>
const MADE = 'voice/.made.json'

export const ttsPath = (id: string) => `voice/${id}.tts.mp3`
export const recordingPath = (id: string) => `voice/${id}.rec.webm`
const stampOf = (p: Project, s: Scene) => `${p.voice.tts}|${p.voice.rate}|${s.spoken.trim()}`

async function readMade(ws: Workspace, slug: string): Promise<Made> {
  const bytes = await ws.getFile(slug, MADE)
  return bytes ? JSON.parse(new TextDecoder().decode(bytes)) : {}
}

async function probeStored(ws: Workspace, slug: string, path: string): Promise<number> {
  return withWorkdir(ws, slug, [path], async (dir) => ({
    result: await probeSeconds(join(dir, path)),
    outputs: [],
  }))
}

/** The clips that exist now, without making any. */
export async function clipLengths(
  ws: Workspace,
  slug: string,
  project: Project,
): Promise<Record<string, Clip | undefined>> {
  const made = await readMade(ws, slug)
  const out: Record<string, Clip | undefined> = {}
  for (const scene of project.scenes) {
    if (scene.voice === 'recording' && (await ws.stat(slug, recordingPath(scene.id)))) {
      out[scene.id] = {
        path: recordingPath(scene.id),
        seconds: await probeStored(ws, slug, recordingPath(scene.id)),
      }
    } else if (
      scene.spoken.trim() &&
      made[scene.id]?.stamp === stampOf(project, scene) &&
      (await ws.stat(slug, ttsPath(scene.id)))
    ) {
      out[scene.id] = { path: ttsPath(scene.id), seconds: made[scene.id].seconds }
    }
  }
  return out
}

export async function voiceProject(
  ws: Workspace,
  slug: string,
  provider: VoiceProvider,
  opts: { only?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<Record<string, Clip | undefined>> {
  const { project } = await ws.read(slug)
  const made = await readMade(ws, slug)
  const clips = await clipLengths(ws, slug, project)
  const todo = project.scenes.filter((s) => (!opts.only || s.id === opts.only) && !clips[s.id])
  let done = 0
  for (const scene of todo) {
    opts.onProgress?.(done++, todo.length)
    if (scene.voice === 'recording' && (await ws.stat(slug, recordingPath(scene.id)))) continue
    const text = scene.spoken.trim()
    if (!text) continue
    const path = ttsPath(scene.id)
    const seconds = await withWorkdir(ws, slug, [], async (dir) => {
      await mkdir(dirname(join(dir, path)), { recursive: true })
      await provider.speak(
        text,
        { voice: project.voice.tts, rate: project.voice.rate },
        join(dir, path),
      )
      return { result: await probeSeconds(join(dir, path)), outputs: [path] }
    })
    made[scene.id] = { stamp: stampOf(project, scene), seconds }
    await ws.putFile(slug, MADE, JSON.stringify(made, null, 2))
    clips[scene.id] = { path, seconds }
  }
  opts.onProgress?.(todo.length, todo.length)
  return clips
}
