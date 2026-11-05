// The app runs on your machine with no accounts. It answers only connections
// from this machine, addressed by a local name (stops DNS rebinding), and
// refuses writes another site started (stops cross-site requests, like
// trusting a project from a page you happened to visit).
import type { IncomingMessage, ServerResponse } from 'node:http'

export const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Whether a request comes from this machine and, if a page sent it, from this app.
 * Also for WebSocket upgrades, which skip the middleware chain.
 */
export function isLocalRequest(req: IncomingMessage): boolean {
  const host = String(req.headers.host ?? '')
  const origin = req.headers.origin
  const fetchSite = req.headers['sec-fetch-site']
  let ok = LOOPBACK.test(req.socket?.remoteAddress ?? '') && LOCAL_HOST.test(host)
  if (ok && origin) {
    // The page that sent it must be this app: same host and port.
    try {
      ok = origin !== 'null' && new URL(origin).host === host
    } catch {
      ok = false
    }
  }
  if (
    ok &&
    !SAFE.has(req.method ?? 'GET') &&
    (fetchSite === 'cross-site' || fetchSite === 'same-site')
  )
    ok = false
  return ok
}

export function localOnly() {
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    if (isLocalRequest(req)) return next()
    res.statusCode = 403
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({ error: 'this app only answers requests from itself, on this machine' }),
    )
  }
}
