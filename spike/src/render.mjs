#!/usr/bin/env node
// Renders a spot page to MP4: scene lengths from the voiceover clips, frames from
// headless Chromium, one frame at a time (so fades and typing land on exact frames),
// then ffmpeg lays the clips over the picture. No npm dependencies.
//
//   node make-video.mjs <spot.html> [--fps 30] [--out spot.mp4] [--seconds N]
//
// The page's folder holds vo/1.mp3 … vo/N.mp3, one per scene. The page has a
// `const DURS = [...] // @durs` line (rewritten here) and `window.spotRecord()`.
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const page = resolve(args[0] ?? 'kickdb-spot.html')
const root = dirname(page)
const fps = Number(opt('fps', 30))
const out = resolve(opt('out', join(root, 'spot.mp4')))
const limit = opt('seconds') ? Number(opt('seconds')) : Infinity
const TAIL = 1.3 // seconds of picture after each line ends

// 1. Scene lengths: at least the page's own, and long enough for the line.
let html = readFileSync(page, 'utf8')
const m = /const DURS = \[([^\]]*)\] \/\/ @durs/.exec(html)
if (!m) throw new Error('page has no `const DURS = [...] // @durs` line')
const base = m[1].split(',').map(Number)
const probe = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())
const clips = base.map((_, i) => join(root, 'vo', `${i + 1}.mp3`))
const missing = clips.filter((c) => !existsSync(c))
if (missing.length) throw new Error(`missing voiceover: ${missing.join(', ')}`)
const lens = clips.map(probe)
const durs = base.map((d, i) => Math.max(d, Math.ceil((lens[i] + TAIL) * 10) / 10))
html = html.replace(m[0], `const DURS = [${durs.join(', ')}] // @durs`)
writeFileSync(page, html)
const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0))
const total = Math.min(durs.reduce((a, b) => a + b, 0), limit)
console.log(`scenes: ${durs.join(' ')}  total ${total.toFixed(1)}s`)

// 2. Serve the folder (the page loads its clips and fonts by URL).
const types = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.js': 'text/javascript' }
const server = createServer((req, res) => {
  const file = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(root) || !existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/${page.slice(root.length + 1)}`

// 3. Headless Chromium over the DevTools protocol.
const cache = join(homedir(), '.cache/ms-playwright')
const shellDir = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1)
const chrome = process.env.CHROME ?? join(cache, shellDir, 'chrome-headless-shell-linux64', 'chrome-headless-shell')
// --no-sandbox as Playwright launches it: Ubuntu blocks the user-namespace sandbox, and
// this only ever loads the local spot page.
const browser = spawn(chrome, ['--no-sandbox', '--remote-debugging-port=0', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', 'about:blank'])
const wsUrl = await new Promise((res, rej) => {
  browser.stderr.on('data', (d) => {
    const hit = /DevTools listening on (ws:\S+)/.exec(d.toString())
    if (hit) res(hit[1])
  })
  browser.on('exit', (code) => rej(new Error(`chrome exited ${code}`)))
})
const ws = new WebSocket(wsUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let nextId = 0
const pending = new Map()
const waiters = []
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
  } else if (msg.method) {
    for (const w of waiters.filter((w) => w.method === msg.method)) {
      waiters.splice(waiters.indexOf(w), 1)
      w.res(msg.params)
    }
  }
})
let session
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++nextId
    pending.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }))
  })
const once = (method) => new Promise((res) => waiters.push({ method, res }))

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
const loaded = once('Page.loadEventFired')
await send('Page.navigate', { url })
await loaded
await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })

// 4. Frames: the page jumps to each frame's time, then a screenshot.
const tmpVideo = out.replace(/\.mp4$/, '.picture.mp4')
const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', tmpVideo], { stdio: ['pipe', 'inherit', 'inherit'] })
await send('Runtime.evaluate', { expression: 'window.spotRecord()' })
const frames = Math.round(total * fps)
for (let f = 0; f < frames; f++) {
  await send('Runtime.evaluate', { expression: `window.spotFrame(${f / fps})` })
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  if (!enc.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => enc.stdin.once('drain', r))
  if (f % fps === 0) process.stdout.write(`\rframe ${f}/${frames}`)
}
enc.stdin.end()
await new Promise((r) => enc.on('close', r))
browser.kill()
server.close()
console.log(`\rframes: ${frames}            `)

// 5. Voiceover: each clip delayed to its scene's start, mixed, laid on the picture.
const inputs = clips.flatMap((c) => ['-i', c])
const delays = clips.map((_, i) => `[${i + 1}:a]adelay=${Math.round(starts[i] * 1000)}:all=1[a${i}]`)
const mix = `${delays.join(';')};${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0[vo]`
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmpVideo, ...inputs, '-filter_complex', mix,
  '-map', '0:v', '-map', '[vo]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(total), out])
execFileSync('rm', ['-f', tmpVideo])

// 6. Subtitles: the page's captions, timed to the clips.
const captions = [...html.matchAll(/^\s*\[\d+, '((?:[^'\\]|\\.)*)'/gm)].map((c) => c[1].replace(/\\'/g, "'"))
const ts = (s) => new Date(s * 1000).toISOString().slice(11, 23).replace('.', ',')
writeFileSync(out.replace(/\.mp4$/, '.srt'), captions.slice(0, clips.length)
  .map((c, i) => `${i + 1}\n${ts(starts[i])} --> ${ts(starts[i] + lens[i])}\n${c}\n`).join('\n'))
console.log(`wrote ${out} (+ .srt)`)
