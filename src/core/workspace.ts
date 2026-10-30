// The projects folder, through @forinda/kickjs-storage: every read and write of
// a project goes here, so swapping the disk driver for S3 is a config change.
import { createHash } from 'node:crypto'
import { checkKey, type Body, type FileInfo, type Storage } from '@forinda/kickjs-storage'
import { SLUG, parseProject, type Project } from './project'

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

export function createWorkspace(storage: Storage) {
  const key = (slug: string, path: string): string => {
    if (!SLUG.test(slug)) throw new PathError(`invalid project name "${slug}"`)
    try {
      return checkKey(`${slug}/${path}`)
    } catch {
      throw new PathError(`invalid path "${path}"`)
    }
  }

  const getFile = (slug: string, path: string) => storage.get(key(slug, path))

  return {
    storage,
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
    ): Promise<{ version: string }> {
      const k = key(slug, 'project.json')
      const bytes = new TextEncoder().encode(`${JSON.stringify(parseProject(project), null, 2)}\n`)
      if (baseVersion === null) {
        if (!(await storage.putIfAbsent(k, bytes))) {
          throw new StaleWriteError(versionOf((await storage.get(k))!))
        }
        return { version: versionOf(bytes) }
      }
      // ponytail: read-then-write, not atomic; one local user, add a lock if
      // several writers share a workspace.
      const current = await storage.get(k)
      const currentVersion = current ? versionOf(current) : ''
      if (currentVersion !== baseVersion) throw new StaleWriteError(currentVersion)
      await storage.put(k, bytes, { contentType: 'application/json' })
      return { version: versionOf(bytes) }
    },
  }
}
