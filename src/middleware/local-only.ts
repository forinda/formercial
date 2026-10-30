// The app runs on your machine with no accounts. Other sites open in the same
// browser can still send it requests, so it answers only when addressed by a
// local name (stops DNS rebinding) and refuses requests a different site
// started (stops cross-site writes, like trusting a project).
import type { IncomingMessage, ServerResponse } from 'node:http'

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i

export function localOnly(extraHosts: string[] = []) {
  const allowed = (host: string) => LOCAL.test(host) || extraHosts.includes(host.toLowerCase())
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const host = String(req.headers.host ?? '')
    const origin = req.headers.origin
    let ok = allowed(host)
    if (ok && origin && origin !== 'null') {
      try {
        ok = allowed(new URL(origin).host)
      } catch {
        ok = false
      }
    }
    if (ok) return next()
    res.statusCode = 403
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'this app only answers requests from this machine' }))
  }
}
