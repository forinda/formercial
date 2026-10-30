import { useEffect, useState, useSyncExternalStore } from 'react'
import { ProjectSession, type SessionState } from './session'

/** The editor's project, saved as you go and kept in step with the file on disk. */
export function useProject(slug: string, initial: Omit<SessionState, 'status'>) {
  const [session] = useState(() => new ProjectSession(slug, initial))
  const state = useSyncExternalStore(
    session.subscribe,
    () => session.state,
    () => session.state,
  )
  useEffect(() => {
    const events = new EventSource(`/api/v1/projects/${slug}/events`)
    events.addEventListener('project-changed', (e) => {
      void session.outsideChange(JSON.parse((e as MessageEvent).data).version)
    })
    return () => events.close()
  }, [session, slug])
  return { ...state, session }
}

/** fetch() that throws the server's error message. */
export async function api<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers:
      init?.json !== undefined
        ? { 'content-type': 'application/json', ...init.headers }
        : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const missing = body?.missing?.length ? ` (missing: ${body.missing.join(', ')})` : ''
    throw new Error(`${body?.error ?? `request failed (${res.status})`}${missing}`)
  }
  return body as T
}

export const fileUrl = (slug: string, path: string) =>
  `/api/v1/projects/${slug}/file?path=${encodeURIComponent(path)}`
