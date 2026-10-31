// What the history routes and the editor's undo and redo buttons share.
import { HttpException, Inject, Service } from '@forinda/kickjs'
import type { Trust } from '@/core/storage/trust'
import type { Workspace } from '@/core/storage/workspace'
import { TRUST, WORKSPACE } from '../tokens'
import { ProjectEvents } from './project-events.service'

@Service()
export class ProjectHistory {
  constructor(
    @Inject(WORKSPACE) private readonly ws: Workspace,
    @Inject(TRUST) private readonly trust: Trust,
    private readonly events: ProjectEvents,
  ) {}

  require() {
    const { history } = this.ws
    if (!history) throw HttpException.serviceUnavailable("history is off: SQLite couldn't start")
    return history
  }

  /** After the file changed underneath the editor: tell it, and say what it can do next. */
  async changedUnderneath(slug: string, version: string) {
    const { project } = await this.ws.read(slug)
    this.events.emit(slug, 'project-changed', { version })
    return {
      version,
      trusted: await this.trust.isTrusted(slug, project),
      history: await this.state(slug),
    }
  }

  /** Whether undo and redo have anywhere to go, for the editor's buttons. */
  async state(slug: string): Promise<{ undo: boolean; redo: boolean }> {
    const { history } = this.ws
    if (!history) return { undo: false, redo: false }
    try {
      return {
        undo: (await history.step(slug, 'undo')) !== null,
        redo: (await history.step(slug, 'redo')) !== null,
      }
    } catch {
      return { undo: false, redo: false }
    }
  }
}
