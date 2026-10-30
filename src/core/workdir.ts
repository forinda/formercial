// ffmpeg, edge-tts and Chromium need real files. A work folder holds copies of
// what a step reads; what it makes goes back through the workspace.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import type { Workspace } from './workspace'

export async function withWorkdir<T>(
  ws: Workspace,
  slug: string,
  paths: string[],
  fn: (dir: string) => Promise<{ result: T; outputs: string[] }>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'cxc-'))
  const inside = (path: string) => {
    const full = resolve(dir, path)
    if (!full.startsWith(dir + sep)) throw new Error(`"${path}" is outside the work folder`)
    return full
  }
  try {
    for (const path of paths) {
      const full = inside(path)
      const bytes = await ws.getFile(slug, path)
      if (!bytes) throw new Error(`${slug}/${path} is missing`)
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, bytes)
    }
    const { result, outputs } = await fn(dir)
    for (const out of outputs) await ws.putFile(slug, out, await readFile(inside(out)))
    return result
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
