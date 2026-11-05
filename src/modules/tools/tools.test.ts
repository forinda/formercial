import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { errorHandler, expressRuntime } from '@forinda/kickjs'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { hasCommand } from '@/core/media/media'
import { findChrome } from '@/core/render/cdp'
import { htmlToPdf, mediaArgs, mediaConvert, officeToPdf } from '@/core/tools/converters'
import { exec } from '@/core/tools/exec'
import { sniff } from '@/core/tools/sniff'
import { defineTool, type AnyTool } from '@/core/tools/tool'
import { localOnly } from '@/middleware/local-only'
import { ToolJobs } from './tool-jobs.service'
import { ToolsModule } from './tools.module'

const PDF = Buffer.from('%PDF-1.4\n% a tiny one\n')
const bytes = (s: string) => new TextEncoder().encode(s)

/** Copies its input to out/, upper-cased; fails when asked to. */
const shout = defineTool<{ fail: boolean }>({
  id: 'shout',
  title: 'Shout',
  description: 'test',
  group: 'pdf',
  accepts: ['pdf'],
  maxFiles: 2,
  fields: [],
  options: z.object({ fail: z.boolean().default(false) }),
  needs: [],
  async run({ inputs, dir, options }) {
    if (options.fail) throw new Error('it broke')
    const text = await readFile(inputs[0], 'utf8')
    await writeFile(join(dir, 'out', 'in-1.txt'), text.toUpperCase())
    return ['in-1.txt']
  },
})

async function boot(tools: AnyTool[] = [shout]) {
  const { app, container } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ToolsModule()],
    middlewares: [localOnly(), express.json()],
    onError: errorHandler(),
  })
  const jobs = container.resolve(ToolJobs)
  jobs.tools = tools
  jobs.root = await mkdtemp(join(tmpdir(), 'tools-test-'))
  return { http: request(app.handle.bind(app)), jobs }
}

const upload = (http: ReturnType<typeof request>, id: string, name: string, body: Uint8Array) =>
  http
    .put(`/api/v1/tools/jobs/${id}/files?name=${encodeURIComponent(name)}`)
    .set('content-type', 'application/octet-stream')
    .send(Buffer.from(body))

describe('tool jobs over HTTP', () => {
  test('make a job, add a file, start it, download what it made', async () => {
    const { http, jobs } = await boot()
    const list = await http.get('/api/v1/tools').expect(200)
    expect(list.body).toEqual([expect.objectContaining({ id: 'shout', missing: [], maxFiles: 2 })])

    const { body: job } = await http
      .post('/api/v1/tools/shout/jobs')
      .send({ options: {} })
      .expect(201)
    expect(job.id).toMatch(/^[0-9a-f]{32}$/)
    await upload(http, job.id, 'My report.pdf', PDF).expect(200)
    await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
    await jobs.idle()

    const done = await http.get(`/api/v1/tools/jobs/${job.id}`).expect(200)
    expect(done.body).toMatchObject({
      state: 'done',
      outputs: [{ file: 'in-1.txt', name: 'My_report.txt' }],
    })
    const file = await http
      .get(`/api/v1/tools/jobs/${job.id}/files/in-1.txt`)
      .buffer(true)
      .expect(200)
    expect(String(file.headers['content-disposition'])).toContain('My_report.txt')
    expect(String(file.body)).toContain('A TINY ONE')

    // A kind the browser shouldn't show in place still downloads, even asked to view it.
    const viewed = await http.get(`/api/v1/tools/jobs/${job.id}/files/in-1.txt?view=1`).expect(200)
    expect(viewed.headers['content-type']).toBe('application/octet-stream')
    expect(String(viewed.headers['content-disposition'])).toMatch(/^attachment/)
    expect(viewed.headers['content-security-policy']).toBe('sandbox')
  })

  test('a PDF it made can be viewed in place', async () => {
    const pdfOut = defineTool<Record<string, never>>({
      ...shout,
      id: 'copy',
      options: z.object({}),
      run: async ({ inputs, dir }) => {
        await writeFile(join(dir, 'out', 'in-1.pdf'), await readFile(inputs[0]))
        return ['in-1.pdf']
      },
    })
    const { http, jobs } = await boot([pdfOut])
    const { body: job } = await http.post('/api/v1/tools/copy/jobs').send({}).expect(201)
    await upload(http, job.id, 'a.pdf', PDF).expect(200)
    await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
    await jobs.idle()
    const viewed = await http.get(`/api/v1/tools/jobs/${job.id}/files/in-1.pdf?view=1`).expect(200)
    expect(viewed.headers['content-type']).toBe('application/pdf')
    expect(String(viewed.headers['content-disposition'])).toMatch(/^inline/)
  })

  test('a file is judged by its contents, not its name', async () => {
    const { http } = await boot()
    const { body: job } = await http.post('/api/v1/tools/shout/jobs').send({}).expect(201)
    await upload(http, job.id, 'fake.pdf', bytes('<html><body>not a pdf</body></html>')).expect(400)
    await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(400)
  })

  test('bad options, unknown tools, jobs and outputs are refused', async () => {
    const { http } = await boot()
    await http.post('/api/v1/tools/nope/jobs').send({}).expect(404)
    await http
      .post('/api/v1/tools/shout/jobs')
      .send({ options: { fail: 'yes' } })
      .expect(400)
    await http.get(`/api/v1/tools/jobs/${'a'.repeat(32)}`).expect(404)
    await http.get('/api/v1/tools/jobs/not-a-job').expect(404)
    const { body: job } = await http.post('/api/v1/tools/shout/jobs').send({}).expect(201)
    await http.get(`/api/v1/tools/jobs/${job.id}/files/in-1.pdf`).expect(404)
    await http.get(`/api/v1/tools/jobs/${job.id}/files/..%2F..%2Fetc%2Fpasswd`).expect(404)
  })

  test('a failing tool says why, and a started job takes no more files', async () => {
    const { http, jobs } = await boot()
    const { body: job } = await http
      .post('/api/v1/tools/shout/jobs')
      .send({ options: { fail: true } })
      .expect(201)
    await upload(http, job.id, 'a.pdf', PDF).expect(200)
    await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
    await upload(http, job.id, 'b.pdf', PDF).expect(400)
    await jobs.idle()
    const failed = await http.get(`/api/v1/tools/jobs/${job.id}`).expect(200)
    expect(failed.body).toMatchObject({ state: 'failed', error: 'it broke' })
  })
})

describe('sniff', () => {
  test('names kinds by their first bytes', () => {
    expect(sniff(PDF)).toBe('pdf')
    expect(sniff(bytes('{\\rtf1 hi}'))).toBe('rtf')
    expect(sniff(bytes('﻿  <!DOCTYPE html><p>hi'))).toBe('html')
    expect(sniff(bytes('GIF89a....'))).toBe('gif')
    expect(sniff(bytes('....ftypisom'))).toBe('mp4')
    expect(sniff(bytes('....ftypqt  '))).toBe('mov')
    expect(sniff(bytes('RIFF....WAVE'))).toBe('wav')
    expect(sniff(bytes('PK\x03\x04....word/document.xml'))).toBe('docx')
    expect(sniff(bytes('just some text'))).toBeNull()
  })
})

describe('mediaArgs', () => {
  test('cuts and scales, reading local files only', () => {
    const args = mediaArgs('in.mp4', 'out.webm', { to: 'webm', start: 2, length: 3, width: 640 })
    expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('file')
    expect(args).toEqual(
      expect.arrayContaining(['-ss', '2', '-t', '3', '-vf', 'scale=640:-2', 'libvpx-vp9']),
    )
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args.at(-1)).toBe('out.webm')
  })

  test('sound drops the video, and a GIF gets a palette', () => {
    expect(mediaArgs('a', 'b.mp3', { to: 'mp3', start: 0, length: 0, width: 0 })).toContain('-vn')
    const gif = mediaArgs('a', 'b.gif', { to: 'gif', start: 0, length: 0, width: 0 }).join(' ')
    expect(gif).toContain('scale=480:-2')
    expect(gif).toContain('palettegen')
  })
})

// The real programs, when this machine has them.
async function convert(tool: AnyTool, input: Uint8Array, options = {}) {
  const { http, jobs } = await boot([tool])
  const { body: job } = await http
    .post(`/api/v1/tools/${tool.id}/jobs`)
    .send({ options })
    .expect(201)
  await upload(http, job.id, 'sample', input).expect(200)
  await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
  await jobs.idle()
  const done = (await http.get(`/api/v1/tools/jobs/${job.id}`)).body
  expect(done.error).toBeUndefined()
  const out = await http
    .get(`/api/v1/tools/jobs/${job.id}/files/${done.outputs[0].file}`)
    .buffer(true)
    .expect(200)
  return out.body as Buffer
}

const hasFfmpeg = await hasCommand('ffmpeg')
const hasSoffice = await hasCommand('soffice', ['--version'])

describe.runIf(hasFfmpeg)('ffmpeg', () => {
  test('a WAV becomes an MP3', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tools-wav-'))
    await exec('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=d=0.5', join(dir, 'a.wav')])
    const mp3 = await convert(mediaConvert, await readFile(join(dir, 'a.wav')), { to: 'mp3' })
    expect(sniff(mp3)).toBe('mp3')
  }, 30_000)
})

describe.runIf(hasSoffice)('LibreOffice', () => {
  test('an RTF becomes a PDF', async () => {
    const pdf = await convert(officeToPdf, bytes('{\\rtf1\\ansi Hello from a test.}'))
    expect(sniff(pdf)).toBe('pdf')
  }, 120_000)
})

describe.runIf(findChrome() !== null)('Chromium', () => {
  test('HTML prints to PDF', async () => {
    const pdf = await convert(htmlToPdf, bytes('<!doctype html><h1>Hello</h1>'))
    expect(sniff(pdf)).toBe('pdf')
  }, 60_000)
})
