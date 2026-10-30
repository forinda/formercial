// Which projects may run their custom scenes. A custom scene's HTML, CSS and
// script are code, and projects get shared, so running them is a choice made
// on this machine: trust is kept outside the project (cxc-trust.json at the
// workspace root, git-ignored) and tied to a hash of the custom code, so a
// pulled change asks again.
import { createHash } from 'node:crypto'
import type { Storage } from '@forinda/kickjs-storage'
import type { Project } from './project'

const KEY = 'cxc-trust.json'

export function customHash(project: Project): string | null {
  const custom = project.scenes.filter((s) => s.kind === 'custom')
  if (custom.length === 0) return null
  const code = custom.map((s) => (s.kind === 'custom' ? [s.id, s.html, s.css, s.script] : []))
  return createHash('sha256').update(JSON.stringify(code)).digest('hex')
}

export function createTrust(storage: Storage) {
  const read = async (): Promise<Record<string, string>> => {
    const bytes = await storage.get(KEY)
    return bytes ? JSON.parse(new TextDecoder().decode(bytes)) : {}
  }
  return {
    /** A project with no custom scenes needs no trust. */
    async isTrusted(slug: string, project: Project): Promise<boolean> {
      const hash = customHash(project)
      return hash === null || (await read())[slug] === hash
    },
    async set(slug: string, project: Project, trusted: boolean): Promise<void> {
      const all = await read()
      const hash = customHash(project)
      if (trusted && hash) all[slug] = hash
      else delete all[slug]
      await storage.put(KEY, JSON.stringify(all, null, 2))
    },
  }
}
