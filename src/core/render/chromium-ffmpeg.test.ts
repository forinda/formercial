import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { memoryStorage } from '@forinda/kickjs-storage'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { parseProject, starterProject } from '@/core/project/project'
import { resolveTimeline } from '@/core/project/timeline'
import { withWorkdir } from '@/core/storage/workdir'
import { createWorkspace } from '@/core/storage/workspace'
import { chromiumFfmpeg, chromiumNvenc } from './chromium-ffmpeg'
import type { RenderJob } from './driver'

// A page implementing the render contract: colour from t, and an error once
// scene b starts when the URL asks for one.
const PAGE = `<!doctype html><body style="margin:0"><div id="n" style="font:40px sans-serif;color:#fff">0</div><script>
const fail = location.search.includes('fail')
let t = 0
window.formercial = {
  ready: document.fonts.ready.then(() => {}),
  frame(x) { t = x; document.body.style.background = 'hsl(' + Math.round(x * 90) + ',60%,40%)'; n.textContent = x.toFixed(2) },
  errors() { return fail && t >= 1 ? { b: 'boom' } : {} },
}
</script></body>`

const project = parseProject({
  ...starterProject('R'),
  scenes: [
    { id: 'a', kind: 'blocks', blocks: [], caption: 'A', minSeconds: 1 },
    { id: 'b', kind: 'blocks', blocks: [], caption: 'B', minSeconds: 1 },
  ],
})

let server: Server
let base = ''
let ready = false

beforeAll(async () => {
  ready = (await chromiumFfmpeg.check()).ok
  server = createServer((_req, res) =>
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE),
  )
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`
})
afterAll(() => server?.close())

function job(dir: string, url: string): RenderJob {
  mkdirSync(join(dir, 'voice'), { recursive: true })
  for (const id of ['a', 'b']) {
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=f=440:d=0.5',
      join(dir, `voice/${id}.mp3`),
    ])
  }
  const timeline = resolveTimeline(
    project,
    { a: { path: 'voice/a.mp3', seconds: 0.5 }, b: { path: 'voice/b.mp3', seconds: 0.5 } },
    () => 0,
  )
  return { slug: 'demo', format: '9:16', fps: 10, timeline, renderUrl: url, project }
}

describe('chromium-ffmpeg', () => {
  test("renders an mp4 of the timeline's size and length", async (ctx) => {
    if (!ready) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'formercial-test-'))
    const j = job(dir, base)
    const out = await chromiumFfmpeg.render(j, dir, () => {})
    const probe = (entries: string) =>
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        entries,
        '-of',
        'csv=p=0',
        join(dir, out.mp4),
      ])
        .toString()
        .trim()
    expect(probe('stream=width,height')).toMatch(/^1080,1920/)
    const duration = Number(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        join(dir, out.mp4),
      ]).toString(),
    )
    expect(Math.abs(duration - j.timeline.total)).toBeLessThan(0.15)
    expect(existsSync(join(dir, out.srt))).toBe(true)
  }, 60_000)

  test('burned-in captions keep the srt away from players that auto-load it', async (ctx) => {
    if (!ready) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'formercial-test-'))
    const out = await chromiumFfmpeg.render(job(dir, base), dir, () => {})
    // VLC and mpv show a same-named .srt beside the video: captions twice.
    expect(dirname(out.srt)).toBe('renders/srt')
    expect(basename(out.srt, '.srt')).toBe(basename(out.mp4, '.mp4'))
    expect(existsSync(join(dir, out.srt))).toBe(true)
    expect(existsSync(join(dir, out.mp4.replace(/\.mp4$/, '.srt')))).toBe(false)
  }, 60_000)

  test('without burned-in captions the srt sits beside the video, for players to load', async (ctx) => {
    if (!ready) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'formercial-test-'))
    const j = job(dir, base)
    const out = await chromiumFfmpeg.render(
      { ...j, project: { ...j.project, captions: false } },
      dir,
      () => {},
    )
    expect(out.srt).toBe(out.mp4.replace(/\.mp4$/, '.srt'))
    expect(existsSync(join(dir, out.srt))).toBe(true)
  }, 60_000)

  test('chromium-nvenc encodes with the GPU, where there is one', async (ctx) => {
    if (!(await chromiumNvenc.check()).ok) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'formercial-test-'))
    const out = await chromiumNvenc.render(job(dir, base), dir, () => {})
    const codec = execFileSync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height',
      '-of',
      'csv=p=0',
      join(dir, out.mp4),
    ]).toString()
    expect(codec).toMatch(/^h264,1080,1920/)
  }, 60_000)

  test('render fails with scene id when a scene throws', async (ctx) => {
    if (!ready) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'formercial-test-'))
    await expect(chromiumFfmpeg.render(job(dir, `${base}?fail`), dir, () => {})).rejects.toThrow(
      'scene b: boom',
    )
  }, 60_000)

  test('removes the work folder on failure', async (ctx) => {
    if (!ready) return ctx.skip()
    const ws = createWorkspace(memoryStorage())
    let seen = ''
    await expect(
      withWorkdir(ws, 'demo', [], async (dir) => {
        seen = dir
        writeFileSync(join(dir, 'x'), '')
        await chromiumFfmpeg.render(job(dir, `${base}?fail`), dir, () => {})
        return { result: null, outputs: [] }
      }),
    ).rejects.toThrow('scene b')
    expect(existsSync(seen)).toBe(false)
  }, 60_000)
})
