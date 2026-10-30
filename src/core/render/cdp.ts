// Headless Chromium over the DevTools protocol, with Node's built-in WebSocket:
// no Puppeteer or Playwright package.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** CHROME, else the newest Playwright headless shell in its cache. */
export function findChrome(): string | null {
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null
  const cache = join(homedir(), '.cache/ms-playwright')
  if (!existsSync(cache)) return null
  const shell = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .at(-1)
  if (!shell) return null
  const bin = join(cache, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell')
  return existsSync(bin) ? bin : null
}

export interface Page {
  send<T = any>(method: string, params?: object): Promise<T>
  close(): void
}

/** Launch Chromium and open one page. */
export async function launchChrome(): Promise<Page> {
  const bin = findChrome()
  if (!bin)
    throw new Error(
      'no Chromium: set CHROME, or run `npx playwright install chromium-headless-shell`',
    )
  // --no-sandbox, as Playwright launches it: Ubuntu blocks the user-namespace
  // sandbox, and this only loads the app's own render page.
  const chrome = spawn(
    bin,
    [
      '--no-sandbox',
      '--remote-debugging-port=0',
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  )
  const wsUrl = await new Promise<string>((resolve, reject) => {
    let log = ''
    chrome.stderr.on('data', (d) => {
      log += d
      const hit = /DevTools listening on (ws:\S+)/.exec(log)
      if (hit) resolve(hit[1])
    })
    chrome.on('exit', (code) => reject(new Error(`chromium exited ${code}: ${log.slice(-300)}`)))
    // A launch that never prints its address fails the job instead of hanging it.
    const timer = setTimeout(() => {
      chrome.kill()
      reject(new Error(`chromium didn't start within 20s: ${log.slice(-300)}`))
    }, 20_000)
    chrome.stderr.on('data', () => /DevTools listening/.test(log) && clearTimeout(timer))
    chrome.on('error', reject)
  })
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(String(e.data))
    const p = msg.id && pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
  })
  let session: string | undefined
  const send = <T>(method: string, params: object = {}) =>
    new Promise<T>((resolve, reject) => {
      const n = ++id
      // A call Chromium never answers (a crashed page) fails instead of hanging the queue.
      const timer = setTimeout(() => {
        pending.delete(n)
        reject(new Error(`chromium didn't answer ${method} within 30s`))
      }, 30_000)
      pending.set(n, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      })
      ws.send(JSON.stringify({ id: n, method, params, ...(session ? { sessionId: session } : {}) }))
    })
  const { targetId } = await send<{ targetId: string }>('Target.createTarget', {
    url: 'about:blank',
  })
  session = (
    await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true })
  ).sessionId
  return {
    send,
    close() {
      ws.close()
      chrome.kill()
    },
  }
}
