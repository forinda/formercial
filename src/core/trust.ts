// Which projects may run their custom scenes. A custom scene's HTML, CSS and
// script are code, and projects get shared, so running them is a choice made
// by this user on this machine. It's kept in the user's config folder, never
// next to the projects (a shared folder could ship its own), keyed by the
// workspace and tied to a hash of the custom code, so a pulled change asks
// again.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Project } from './project'

type TrustFile = Record<string, Record<string, string>>

export function defaultTrustFile(): string {
  if (process.env.FORMERCIAL_TRUST_FILE) return process.env.FORMERCIAL_TRUST_FILE
  const config = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  return join(config, 'formercial', 'trust.json')
}

export function customHash(project: Project): string | null {
  const custom = project.scenes.filter((s) => s.kind === 'custom')
  if (custom.length === 0) return null
  const code = custom.map((s) => (s.kind === 'custom' ? [s.id, s.html, s.css, s.script] : []))
  return createHash('sha256').update(JSON.stringify(code)).digest('hex')
}

/** `workspace` names where the projects are: an absolute folder, or `s3:<bucket>`. */
export function createTrust(opts: { workspace: string; file?: string }) {
  const file = opts.file ?? defaultTrustFile()
  const read = async (): Promise<TrustFile> => {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      return {}
    }
  }
  return {
    /** A project with no custom scenes needs no trust. */
    async isTrusted(slug: string, project: Project): Promise<boolean> {
      const hash = customHash(project)
      return hash === null || (await read())[opts.workspace]?.[slug] === hash
    },
    async set(slug: string, project: Project, trusted: boolean): Promise<void> {
      const all = await read()
      const mine = (all[opts.workspace] ??= {})
      const hash = customHash(project)
      if (trusted && hash) mine[slug] = hash
      else delete mine[slug]
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 })
    },
  }
}
