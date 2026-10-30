// The editor's copy of a project: saves on a short pause, notices when the
// file changed on disk, and never silently overwrites someone else's edit.
import type { Project } from '@/core/project'
import type { Clip } from '@/core/timeline'

export type Status = 'saved' | 'saving' | 'conflict' | 'error'
export interface SessionState {
  project: Project
  version: string
  clips: Record<string, Clip>
  trusted: boolean
  status: Status
  error?: string
}

const SAVE_AFTER = 600

export class ProjectSession {
  state: SessionState
  private dirty = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()

  constructor(
    readonly slug: string,
    initial: Omit<SessionState, 'status'>,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {
    this.state = { ...initial, status: 'saved' }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private update(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }

  private url = (suffix = '') => `/api/v1/projects/${this.slug}${suffix}`

  set(project: Project) {
    this.dirty = true
    this.update({ project, status: this.state.status === 'conflict' ? 'conflict' : 'saving' })
    if (this.state.status === 'conflict') return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.save(this.state.version), SAVE_AFTER)
  }

  private async save(baseVersion: string) {
    const res = await this.fetchFn(this.url(), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: this.state.project, baseVersion }),
    })
    const body = await res.json()
    if (res.status === 409) return this.update({ status: 'conflict' })
    if (!res.ok)
      return this.update({ status: 'error', error: body.error ?? `save failed (${res.status})` })
    this.dirty = false
    this.update({
      version: body.version,
      trusted: body.trusted ?? this.state.trusted,
      status: 'saved',
      error: undefined,
    })
  }

  /** Load the file as it is on disk, dropping local edits. */
  async reload() {
    clearTimeout(this.timer)
    const body = await (await this.fetchFn(this.url())).json()
    this.dirty = false
    this.update({
      project: body.project,
      version: body.version,
      clips: body.clips,
      trusted: body.trusted,
      status: 'saved',
    })
  }

  /** Keep local edits, replacing whatever is on disk now. */
  async overwrite() {
    const body = await (await this.fetchFn(this.url())).json()
    await this.save(body.version)
  }

  /** The events stream says project.json is now at `version`. */
  async outsideChange(version: string) {
    if (version === this.state.version) return
    if (this.dirty) return this.update({ status: 'conflict' })
    await this.reload()
  }

  /** Re-read clips and trust after voicing, recording or trusting. */
  async refresh() {
    const body = await (await this.fetchFn(this.url())).json()
    this.update({ clips: body.clips, trusted: body.trusted })
  }
}
