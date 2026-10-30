import { describe, expect, test } from 'vitest'
import { localOnly } from './local-only'

function call(opts: { method?: string; remote?: string; headers?: Record<string, string> }) {
  const req = {
    method: opts.method ?? 'GET',
    headers: { host: 'localhost:3000', ...opts.headers },
    socket: { remoteAddress: opts.remote ?? '127.0.0.1' },
  }
  const res = { statusCode: 200, setHeader() {}, end() {} }
  let passed = false
  localOnly()(req as never, res as never, () => (passed = true))
  return passed ? 'next' : res.statusCode
}

describe('localOnly', () => {
  test('lets local requests through', () => {
    expect(call({})).toBe('next')
    expect(call({ remote: '::ffff:127.0.0.1' })).toBe('next')
    expect(call({ method: 'POST', headers: { origin: 'http://localhost:3000' } })).toBe('next')
  })
  test('refuses a connection from another machine, whatever Host says', () => {
    expect(call({ remote: '192.168.1.20' })).toBe(403)
  })
  test('refuses another host name', () => {
    expect(call({ headers: { host: 'evil.example' } })).toBe(403)
  })
  test('refuses writes from another origin, a null origin, or a cross-site fetch', () => {
    expect(call({ method: 'POST', headers: { origin: 'http://localhost:5555' } })).toBe(403)
    expect(call({ method: 'POST', headers: { origin: 'null' } })).toBe(403)
    expect(call({ method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })).toBe(403)
    expect(call({ method: 'PUT', headers: { 'sec-fetch-site': 'same-site' } })).toBe(403)
  })
})
