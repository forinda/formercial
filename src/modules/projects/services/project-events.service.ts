// Live updates to open editors, per project.
import { Service } from '@forinda/kickjs'

type Listener = { send(data: unknown, event?: string): void }

@Service()
export class ProjectEvents {
  private listeners = new Map<string, Set<Listener>>()

  listen(slug: string, listener: Listener): () => void {
    const set = this.listeners.get(slug) ?? new Set()
    set.add(listener)
    this.listeners.set(slug, set)
    return () => set.delete(listener)
  }

  emit(slug: string, event: string, data: unknown) {
    for (const l of this.listeners.get(slug) ?? []) l.send(data, event)
  }
}
