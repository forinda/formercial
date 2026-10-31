// The projects folder, through @forinda/kickjs-storage: every read and write of
// a project goes here, so swapping the disk driver for S3 is a config change.
import { createHash } from 'node:crypto'
import { checkKey, type Body, type FileInfo, type Storage } from '@forinda/kickjs-storage'
import type { History } from './history'
import { SLUG, parseProject, type Project } from '@/core/project/project'

export class StaleWriteError extends Error {
  constructor(readonly current: string) {
    super('project.json changed since it was read')
    this.name = 'StaleWriteError'
  }
}

export class PathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathError'
  }
}

export type Workspace = ReturnType<typeof createWorkspace>

const versionOf = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

export function createWorkspace(storage: Storage, opts: { history?: History } = {}) {
  const { history } = opts
  // History is a safety net: if it fails, the save still goes through.
  const remember = async (slug: string, bytes: Uint8Array | null, source: string) => {
    if (!history || !bytes) return
    try {
      await history.capture(slug, bytes, source)
    } catch (err) {
      console.warn(`history not recorded for ${slug}: ${(err as Error).message}`)
    }
  }

  const key = (slug: string, path: string): string => {
    if (!SLUG.test(slug)) throw new PathError(`invalid project name "${slug}"`)
    try {
      return checkKey(`${slug}/${path}`)
    } catch {
      throw new PathError(`invalid path "${path}"`)
    }
  }

  const getFile = (slug: string, path: string) => storage.get(key(slug, path))

  /** Put back a step's exact bytes and make it current. */
  async function restore(slug: string, id: number, baseVersion?: string) {
    if (!history) throw new Error('history is off')
    const bytes = await history.bytes(slug, id)
    if (!bytes) throw new PathError(`no step ${id} in ${slug}`)
    parseProject(JSON.parse(new TextDecoder().decode(bytes)))
    const k = key(slug, 'project.json')
    const current = await storage.get(k)
    if (baseVersion !== undefined && (current ? versionOf(current) : '') !== baseVersion) {
      throw new StaleWriteError(current ? versionOf(current) : '')
    }
    // Anything on disk that history hasn't seen is kept, so this can be undone too.
    await remember(slug, current, 'outside')
    await storage.put(k, bytes, { contentType: 'application/json' })
    await history.moveHead(slug, id)
    return { version: versionOf(bytes) }
  }

  const step = async (slug: string, direction: 'undo' | 'redo') => {
    if (!history) throw new Error('history is off')
    const current = await storage.get(key(slug, 'project.json'))
    await remember(slug, current, 'outside')
    const id = await history.step(slug, direction)
    return id === null ? null : restore(slug, id)
  }

  return {
    storage,
    history,
    remember,
    restore,
    undo: (slug: string) => step(slug, 'undo'),
    redo: (slug: string) => step(slug, 'redo'),
    key,
    getFile,
    putFile: (slug: string, path: string, body: Body) => storage.put(key(slug, path), body),
    deleteFile: (slug: string, path: string) => storage.delete(key(slug, path)),
    stat: (slug: string, path: string): Promise<FileInfo | null> => storage.stat(key(slug, path)),

    async list(): Promise<{ slug: string; name: string }[]> {
      const out: { slug: string; name: string }[] = []
      let cursor: string | undefined
      do {
        const page = await storage.list({ delimiter: '/', cursor })
        for (const prefix of page.prefixes ?? []) {
          const slug = prefix.slice(0, -1)
          if (!SLUG.test(slug)) continue
          const bytes = await storage.get(`${slug}/project.json`)
          if (!bytes) continue
          try {
            out.push({ slug, name: parseProject(JSON.parse(new TextDecoder().decode(bytes))).name })
          } catch {
            out.push({ slug, name: `${slug} (invalid project.json)` })
          }
        }
        cursor = page.cursor
      } while (cursor)
      return out.sort((a, b) => a.slug.localeCompare(b.slug))
    },

    async read(slug: string): Promise<{ project: Project; version: string }> {
      const bytes = await getFile(slug, 'project.json')
      if (!bytes) throw new PathError(`no project "${slug}"`)
      return {
        project: parseProject(JSON.parse(new TextDecoder().decode(bytes))),
        version: versionOf(bytes),
      }
    },

    /** `baseVersion` is the version the edit started from; `null` creates the project. */
    async write(
      slug: string,
      project: Project,
      baseVersion: string | null,
      source = 'app',
    ): Promise<{ version: string }> {
      const k = key(slug, 'project.json')
      const bytes = new TextEncoder().encode(`${JSON.stringify(parseProject(project), null, 2)}\n`)
      if (baseVersion === null) {
        if (!(await storage.putIfAbsent(k, bytes))) {
          throw new StaleWriteError(versionOf((await storage.get(k))!))
        }
        await remember(slug, bytes, source)
        return { version: versionOf(bytes) }
      }
      // ponytail: read-then-write, not atomic; one local user, add a lock if
      // several writers share a workspace.
      const current = await storage.get(k)
      const currentVersion = current ? versionOf(current) : ''
      if (currentVersion !== baseVersion) throw new StaleWriteError(currentVersion)
      await remember(slug, current, 'outside')
      await storage.put(k, bytes, { contentType: 'application/json' })
      await remember(slug, bytes, source)
      return { version: versionOf(bytes) }
    },
  }
}
