import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expressRuntime } from '@forinda/kickjs'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'
import { starterProject } from '@/core/project'
import type { RenderDriver } from '@/core/render/driver'
import { createRegistry } from '@/core/render/registry'
import { ProjectsModule } from './projects.module'
import { REGISTRY } from './tokens'
import { localOnly } from '@/middleware/local-only'

const urls: string[] = []
const customProject = (script = 'export function draw() {}') => ({
  ...starterProject('Demo'),
  scenes: [{ id: 'c', kind: 'custom', caption: '', script }],
})
/** Custom code that arrives outside the editor: a git pull, a script. */
const pull = (project: unknown) => storage.put('demo/project.json', JSON.stringify(project))
function driver(name: string, opts: { ok?: boolean; hold?: Promise<void> } = {}): RenderDriver {
  return {
    name,
    check: async () => ({ ok: opts.ok ?? true, missing: opts.ok === false ? ['ffmpeg'] : [] }),
    async render(job, dir) {
      urls.push(job.renderUrl)
      await opts.hold
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync(join(dir, 'renders'), { recursive: true })
      writeFileSync(join(dir, `renders/${job.format.replace(':', 'x')}.mp4`), 'mp4')
      writeFileSync(join(dir, `renders/${job.format.replace(':', 'x')}.srt`), 'srt')
      return {
        mp4: `renders/${job.format.replace(':', 'x')}.mp4`,
        srt: `renders/${job.format.replace(':', 'x')}.srt`,
      }
    },
  }
}

let storage = memoryStorage()
async function boot(drivers: RenderDriver[] = [driver('fake')]) {
  storage = memoryStorage()
  const { app } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ProjectsModule()],
    middlewares: [localOnly(), express.json()],
    overrides: [
      [STORAGE, storage],
      [REGISTRY, createRegistry({ drivers })],
    ],
  })
  const http = request(app.handle.bind(app))
  await http.post('/api/v1/projects').send({ name: 'Demo' }).expect(201)
  return http
}

function audio(ext: 'webm', seconds = 1): Buffer {
  const file = join(tmpdir(), `formercial-rec-${process.pid}.${ext}`)
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=f=300:d=${seconds}`,
    '-c:a',
    'libopus',
    file,
  ])
  return readFileSync(file)
}

describe('projects api', () => {
  test('creates, lists and reads a project', async () => {
    const http = await boot()
    expect((await http.get('/api/v1/projects').expect(200)).body).toEqual([
      { slug: 'demo', name: 'Demo' },
    ])
    const second = await http.post('/api/v1/projects').send({ name: 'Demo' }).expect(201)
    expect(second.body.slug).toBe('demo-2')
    const read = await http.get('/api/v1/projects/demo').expect(200)
    expect(read.body.project.name).toBe('Demo')
    expect(read.body.version).toMatch(/^[0-9a-f]{64}$/)
    expect(read.body.clips).toEqual({})
  })

  test('GET /api/v1/projects/..%2fx is 400', async () => {
    const http = await boot()
    await http.get('/api/v1/projects/..%2fx').expect(400)
    await http.get('/api/v1/projects/demo/file?path=../../etc/passwd').expect(400)
  })

  test('PUT with a stale baseVersion is 409 with current', async () => {
    const http = await boot()
    const { version } = (await http.get('/api/v1/projects/demo')).body
    const next = (
      await http
        .put('/api/v1/projects/demo')
        .send({ project: starterProject('Two'), baseVersion: version })
        .expect(200)
    ).body.version
    const res = await http
      .put('/api/v1/projects/demo')
      .send({ project: starterProject('Three'), baseVersion: version })
      .expect(409)
    expect(res.body.current).toBe(next)
  })

  test('PUT with an invalid project is 400 listing the zod path', async () => {
    const http = await boot()
    const { version } = (await http.get('/api/v1/projects/demo')).body
    const res = await http
      .put('/api/v1/projects/demo')
      .send({ project: { ...starterProject('X'), scenes: [] }, baseVersion: version })
      .expect(400)
    expect(JSON.stringify(res.body)).toContain('scenes')
  })

  test('recording upload: empty body 400, text/plain 400, over 50MB 413, ok stores and returns seconds', async () => {
    const http = await boot()
    const url = '/api/v1/projects/demo/recordings/s1'
    await http.put(url).set('content-type', 'audio/webm').send(Buffer.alloc(0)).expect(400)
    await http.put(url).set('content-type', 'text/plain').send('hello').expect(400)
    await http
      .put(url)
      .set('content-type', 'audio/webm')
      .send(Buffer.alloc(50 * 1024 * 1024 + 1))
      .expect(413)
    const ok = await http
      .put(url)
      .set('content-type', 'audio/webm')
      .send(audio('webm', 1))
      .expect(200)
    expect(ok.body.seconds).toBeGreaterThan(0.9)
    const file = await http.get('/api/v1/projects/demo/file?path=voice/s1.rec.webm').expect(200)
    expect(file.headers['content-type']).toMatch(/audio\/webm/)
    await http.delete(url).expect(204)
  }, 30_000)

  test('serves a byte range of a file', async () => {
    const http = await boot()
    await http
      .put('/api/v1/projects/demo/file?path=media/a.txt')
      .set('content-type', 'text/plain')
      .send('0123456789')
      .expect(204)
    const res = await http
      .get('/api/v1/projects/demo/file?path=media/a.txt')
      .set('range', 'bytes=2-4')
      .expect(206)
    expect(res.text).toBe('234')
    await http
      .put('/api/v1/projects/demo/file?path=voice/x.mp3')
      .set('content-type', 'audio/mpeg')
      .send('x')
      .expect(400)
  })

  test('refuses a driver that is not ready', async () => {
    const http = await boot([driver('broken', { ok: false })])
    const res = await http
      .post('/api/v1/projects/demo/renders')
      .send({ format: '16:9', driver: 'broken' })
      .expect(400)
    expect(res.body.missing).toEqual(['ffmpeg'])
  })

  test('second render queues while the first runs', async () => {
    let release!: () => void
    const hold = new Promise<void>((r) => (release = r))
    const http = await boot([driver('slow', { hold })])
    const first = await http
      .post('/api/v1/projects/demo/renders')
      .send({ format: '16:9', driver: 'slow' })
      .expect(202)
    const second = await http
      .post('/api/v1/projects/demo/renders')
      .send({ format: '1:1', driver: 'slow' })
      .expect(202)
    expect(first.body.jobs[0].state).toBe('running')
    expect(second.body.jobs[0].state).toBe('queued')
    release()
    // Waiting on the outcome, not a fixed time: a busy machine takes longer.
    await vi.waitFor(
      async () => {
        const { jobs } = (await http.get('/api/v1/projects/demo/renders').expect(200)).body
        expect(jobs.map((j: { state: string }) => j.state)).toEqual(['done', 'done'])
      },
      { timeout: 10_000, interval: 100 },
    )
    const list = (await http.get('/api/v1/projects/demo/renders').expect(200)).body
    expect(list.files).toContain('renders/16x9.mp4')
  })

  test('a project with custom scenes renders only once trusted', async () => {
    const http = await boot()
    await pull(customProject())
    expect((await http.get('/api/v1/projects/demo')).body.trusted).toBe(false)
    await http
      .post('/api/v1/projects/demo/renders')
      .send({ format: '16:9', driver: 'fake' })
      .expect(403)
    await http.post('/api/v1/projects/demo/trust').send({ trusted: true }).expect(204)
    expect((await http.get('/api/v1/projects/demo')).body.trusted).toBe(true)
    await http
      .post('/api/v1/projects/demo/renders')
      .send({ format: '16:9', driver: 'fake' })
      .expect(202)
  })

  test('lists drivers with their checks', async () => {
    const http = await boot([driver('broken', { ok: false })])
    const res = await http.get('/api/v1/drivers').expect(200)
    expect(res.body.find((d: { name: string }) => d.name === 'broken')).toEqual({
      name: 'broken',
      check: { ok: false, missing: ['ffmpeg'] },
    })
  })

  test('refuses other hosts and cross-site origins', async () => {
    const http = await boot()
    await http.get('/api/v1/projects').set('host', 'evil.example').expect(403)
    await http
      .post('/api/v1/projects/demo/trust')
      .set('origin', 'http://evil.example')
      .send({ trusted: true })
      .expect(403)
    await http.get('/api/v1/projects').set('host', 'localhost:3000').expect(200)
  })

  test("renders from the server's own loopback address, whatever Host says", async () => {
    const http = await boot()
    await http
      .post('/api/v1/projects/demo/renders')
      .set('host', 'localhost:9')
      .send({ format: '16:9', driver: 'fake' })
      .expect(202)
    await new Promise((r) => setTimeout(r, 100))
    expect(urls.at(-1)).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/p\/demo\/render\/16x9$/)
    expect(urls.at(-1)).not.toContain(':9/')
  })

  test('fps must be a whole number from 1 to 60', async () => {
    const http = await boot()
    for (const fps of [0, 61, 2.5, 'x']) {
      await http
        .post('/api/v1/projects/demo/renders')
        .send({ format: '16:9', driver: 'fake', fps })
        .expect(400)
    }
  })

  test('project files are served sandboxed', async () => {
    const http = await boot()
    await http
      .put('/api/v1/projects/demo/file?path=media/logo.svg')
      .set('content-type', 'image/svg+xml')
      .send('<svg onload="alert(1)"/>')
      .expect(204)
    const res = await http.get('/api/v1/projects/demo/file?path=media/logo.svg').expect(200)
    expect(res.headers['content-security-policy']).toMatch(/sandbox/)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  test('downloads a Google font into the project', async () => {
    const http = await boot()
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).startsWith('https://fonts.googleapis.com')
        ? new Response(
            `/* latin */\n@font-face { font-weight: 400; src: url(https://fonts.gstatic.com/a.woff2) format('woff2'); }`,
          )
        : new Response(new Uint8Array([1, 2, 3])),
    )
    try {
      const res = await http
        .post('/api/v1/projects/demo/fonts')
        .send({ family: 'Space Mono' })
        .expect(200)
      expect(res.body.files).toEqual([
        { family: 'Space Mono', weight: 400, path: 'media/fonts/space-mono-400.woff2' },
      ])
      const { project } = (await http.get('/api/v1/projects/demo')).body
      expect(project.theme.fonts.files).toEqual(res.body.files)
      await http.get('/api/v1/projects/demo/file?path=media/fonts/space-mono-400.woff2').expect(200)
      await http.post('/api/v1/projects/demo/fonts').send({ family: 'x&y=z' }).expect(400)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('saving your own edits keeps a trusted project trusted', async () => {
    const http = await boot()
    const scene = (script: string) => ({ id: 'c', kind: 'custom', caption: '', script })
    let { version } = (await http.get('/api/v1/projects/demo')).body
    const first = { ...starterProject('Demo'), scenes: [scene('export function draw() {}')] }
    ;({ version } = (
      await http
        .put('/api/v1/projects/demo')
        .set('x-formercial-editor', '1')
        .send({ project: first, baseVersion: version })
        .expect(200)
    ).body)
    await http.post('/api/v1/projects/demo/trust').send({ trusted: true }).expect(204)
    const edited = { ...first, scenes: [scene('export function draw(t) { t }')] }
    const res = await http
      .put('/api/v1/projects/demo')
      .set('x-formercial-editor', '1')
      .send({ project: edited, baseVersion: version })
      .expect(200)
    expect(res.body.trusted).toBe(true)
    expect((await http.get('/api/v1/projects/demo')).body.trusted).toBe(true)
  })

  test('custom code pulled in from outside stays untrusted after you save edits', async () => {
    const http = await boot()
    await pull(customProject())
    const { version, project } = (await http.get('/api/v1/projects/demo')).body
    const res = await http
      .put('/api/v1/projects/demo')
      .set('x-formercial-editor', '1')
      .send({ project: { ...project, name: 'Renamed' }, baseVersion: version })
      .expect(200)
    expect(res.body.trusted).toBe(false)
  })

  test('a custom scene you add in the editor can run', async () => {
    const http = await boot()
    const { version } = (await http.get('/api/v1/projects/demo')).body
    const res = await http
      .put('/api/v1/projects/demo')
      .set('x-formercial-editor', '1')
      .send({ project: customProject(), baseVersion: version })
      .expect(200)
    expect(res.body.trusted).toBe(true)
  })

  test('starts a project from a preset', async () => {
    const http = await boot()
    const presets = (await http.get('/api/v1/presets').expect(200)).body
    expect(presets.map((p: { id: string }) => p.id)).toEqual([
      'showcase',
      'doodle-light-bulb',
      'typescript-intro',
      'javascript-basics',
      'python-basics',
    ])
    const res = await http
      .post('/api/v1/projects')
      .send({ name: 'Py Ad', preset: 'python-basics' })
      .expect(201)
    const { project } = (await http.get(`/api/v1/projects/${res.body.slug}`)).body
    expect(project.name).toBe('Py Ad')
    expect(project.scenes[0].id).toBe('py-intro')
    await http.post('/api/v1/projects').send({ name: 'X', preset: 'cobol' }).expect(400)
  })
})
