import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { errorHandler, expressRuntime } from '@forinda/kickjs'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { defineTool } from '@/core/tools/tool'
import { localOnly } from '@/middleware/local-only'
import { ToolJobs } from './tool-jobs.service'
import { ToolsModule } from './tools.module'

const PDF = Buffer.from('%PDF-1.7\n% the original\n')
const SIGNED = Buffer.from('%PDF-1.7\n<< /Type /Sig /ByteRange [0 1 2 3] >>\n')
const STAMPED = Buffer.from('%PDF-1.7\n% stamped, no certificate\n')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

/** Stands in for the workspace's tool: writes a "signed" PDF. */
const fakeSign = defineTool<Record<string, unknown>>({
  id: 'pdf-workspace-sign',
  title: 'Sign',
  description: 'test',
  group: 'pdf',
  accepts: ['pdf', 'png'],
  maxFiles: 3,
  fields: [],
  options: z.record(z.string(), z.unknown()),
  needs: [],
  async run({ dir, options }) {
    await writeFile(join(dir, 'out', 'in-1-signed.pdf'), options.plain ? STAMPED : SIGNED)
    return ['in-1-signed.pdf']
  },
})

async function boot() {
  const { app, container } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ToolsModule()],
    middlewares: [localOnly(), express.json({ limit: '2mb' })],
    onError: errorHandler(),
    overrides: [[STORAGE, memoryStorage()]],
  })
  const jobs = container.resolve(ToolJobs)
  jobs.tools = [fakeSign]
  jobs.root = await mkdtemp(join(tmpdir(), 'signing-test-'))
  return { http: request(app.handle.bind(app)), jobs }
}

type Http = ReturnType<typeof request>
const bytes = (http: Http, method: 'post' | 'put', url: string, body: Buffer) =>
  http[method](url).set('content-type', 'application/octet-stream').send(body)

const tick = {
  id: 'a1',
  label: 'tick',
  pages: [1],
  box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
  color: '#111111',
}

async function newDoc(http: Http, name = 'Lease.pdf') {
  const res = await bytes(http, 'post', `/api/v1/tools/signing?name=${name}&pages=3`, PDF).expect(
    201,
  )
  return res.body as { id: string }
}

describe('signing documents', () => {
  test('a PDF opened is kept, listed, and comes back with its items', async () => {
    const { http } = await boot()
    const doc = await newDoc(http)
    expect(doc.id).toMatch(/^[0-9a-f]{16}$/)

    const list = (await http.get('/api/v1/tools/signing').expect(200)).body
    expect(list).toEqual([
      expect.objectContaining({ id: doc.id, name: 'Lease.pdf', pages: 3, versions: 0 }),
    ])

    await http
      .put(`/api/v1/tools/signing/${doc.id}/items`)
      .send({ items: [tick] })
      .expect(200)
    const read = (await http.get(`/api/v1/tools/signing/${doc.id}`).expect(200)).body
    expect(read.items).toEqual([tick])

    const original = await http
      .get(`/api/v1/tools/signing/${doc.id}/original`)
      .buffer(true)
      .expect(200)
    expect(Buffer.compare(original.body, PDF)).toBe(0)
  })

  test('refuses what is not a PDF, and items that are not right', async () => {
    const { http } = await boot()
    await bytes(http, 'post', '/api/v1/tools/signing?name=x.pdf&pages=1', PNG).expect(400)
    const doc = await newDoc(http)
    for (const bad of [
      { ...tick, color: 'url(#x)' },
      { ...tick, label: 'stamp' },
      { ...tick, box: { x: 2, y: 0, w: 0.1, h: 0.1 } },
    ])
      await http
        .put(`/api/v1/tools/signing/${doc.id}/items`)
        .send({ items: [bad] })
        .expect(400)
  })

  test('keeps its own copies of the signature pictures it uses', async () => {
    const { http } = await boot()
    const doc = await newDoc(http)
    const at = `/api/v1/tools/signing/${doc.id}/pictures`
    await bytes(http, 'put', `${at}/signature`, PNG).expect(200)
    const pic = await http.get(`${at}/signature`).buffer(true).expect(200)
    expect(pic.headers['content-type']).toBe('image/png')
    expect((await http.get(`/api/v1/tools/signing/${doc.id}`)).body.pictures).toEqual(['signature'])
    await bytes(http, 'put', `${at}/stamp`, PNG).expect(400)
    await bytes(http, 'put', `${at}/initials`, PDF).expect(400)
  })

  test('every Finish is kept as a numbered version', async () => {
    const { http, jobs } = await boot()
    const doc = await newDoc(http)
    const finish = async (plain = false) => {
      const { body: job } = await http
        .post('/api/v1/tools/pdf-workspace-sign/jobs')
        .send({ options: plain ? { plain: true } : {} })
        .expect(201)
      await bytes(http, 'put', `/api/v1/tools/jobs/${job.id}/files?name=a.pdf`, PDF).expect(200)
      await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
      await jobs.idle()
      return http
        .post(`/api/v1/tools/signing/${doc.id}/versions`)
        .send({ job: job.id, file: 'in-1-signed.pdf', digital: true })
        .expect(201)
    }
    expect((await finish()).body).toMatchObject({ n: 1, digital: true })
    expect((await finish()).body).toMatchObject({ n: 2 })

    const read = (await http.get(`/api/v1/tools/signing/${doc.id}`)).body
    expect(read.versions.map((v: { n: number }) => v.n)).toEqual([1, 2])
    const v1 = await http.get(`/api/v1/tools/signing/${doc.id}/versions/1`).buffer(true).expect(200)
    expect(Buffer.compare(v1.body, SIGNED)).toBe(0)
    expect(String(v1.headers['content-disposition'])).toContain('Lease-v1.pdf')
    await http.get(`/api/v1/tools/signing/${doc.id}/versions/3`).expect(404)
    expect((await http.get('/api/v1/tools/signing')).body[0].versions).toBe(2)
    // Said to be digitally signed, but the copy carries no signature: kept as not.
    expect((await finish(true)).body).toMatchObject({ n: 3, digital: false })
  })

  test('two signed copies kept at once get their own numbers', async () => {
    const { http, jobs } = await boot()
    const doc = await newDoc(http)
    const jobIds: string[] = []
    for (let i = 0; i < 2; i++) {
      const { body: job } = await http.post('/api/v1/tools/pdf-workspace-sign/jobs').send({})
      await bytes(http, 'put', `/api/v1/tools/jobs/${job.id}/files?name=a.pdf`, PDF).expect(200)
      await http.post(`/api/v1/tools/jobs/${job.id}/start`).expect(200)
      jobIds.push(job.id)
    }
    await jobs.idle()
    const made = await Promise.all(
      jobIds.map((job) =>
        http
          .post(`/api/v1/tools/signing/${doc.id}/versions`)
          .send({ job, file: 'in-1-signed.pdf' })
          .expect(201),
      ),
    )
    expect(made.map((r) => r.body.n).sort()).toEqual([1, 2])
    const read = (await http.get(`/api/v1/tools/signing/${doc.id}`)).body
    expect(read.versions).toHaveLength(2)
  })

  test('items with the same id, or on pages the document lacks, are refused', async () => {
    const { http } = await boot()
    const doc = await newDoc(http)
    const at = `/api/v1/tools/signing/${doc.id}/items`
    await http
      .put(at)
      .send({ items: [tick, tick] })
      .expect(400)
    await http
      .put(at)
      .send({ items: [{ ...tick, pages: [4] }] })
      .expect(400)
  })

  test("a version only comes from a finished signing job's own output", async () => {
    const { http } = await boot()
    const doc = await newDoc(http)
    await http
      .post(`/api/v1/tools/signing/${doc.id}/versions`)
      .send({ job: '0'.repeat(32), file: 'in-1-signed.pdf' })
      .expect(404)
    // A signing job that hasn't run yet.
    const { body: job } = await http.post('/api/v1/tools/pdf-workspace-sign/jobs').send({})
    await http
      .post(`/api/v1/tools/signing/${doc.id}/versions`)
      .send({ job: job.id, file: 'in-1-signed.pdf' })
      .expect(404)
    await http
      .post(`/api/v1/tools/signing/${doc.id}/versions`)
      .send({ job: 'x', file: '../../doc.json' })
      .expect(404)
  })

  test('deleting a document removes all of it', async () => {
    const { http } = await boot()
    const doc = await newDoc(http)
    await bytes(http, 'put', `/api/v1/tools/signing/${doc.id}/pictures/signature`, PNG).expect(200)
    await http.delete(`/api/v1/tools/signing/${doc.id}`).expect(204)
    await http.get(`/api/v1/tools/signing/${doc.id}`).expect(404)
    await http.get(`/api/v1/tools/signing/${doc.id}/original`).expect(404)
    expect((await http.get('/api/v1/tools/signing')).body).toEqual([])
  })

  test("refuses ids that aren't ours", async () => {
    const { http } = await boot()
    for (const bad of ['..%2F_signatures', 'ABCDEF0123456789', 'index'])
      await http.get(`/api/v1/tools/signing/${bad}`).expect(404)
  })
})
