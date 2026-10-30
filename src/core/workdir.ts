// ffmpeg, edge-tts and Chromium need real files. A work folder holds copies of
// what a step reads; what it makes goes back through the workspace.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Workspace } from './workspace'

export async function withWorkdir<T>(
  ws: Workspace,
  slug: string,
  paths: string[],
  fn: (dir: string) => Promise<{ result: T; outputs: string[] }>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'cxc-'))
  try {
    for (const path of paths) {
      const bytes = await ws.getFile(slug, path)
      if (!bytes) throw new Error(`${slug}/${path} is missing`)
      await mkdir(dirname(join(dir, path)), { recursive: true })
      await writeFile(join(dir, path), bytes)
    }
    const { result, outputs } = await fn(dir)
    for (const out of outputs) await ws.putFile(slug, out, await readFile(join(dir, out)))
    return result
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
