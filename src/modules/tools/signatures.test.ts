import { errorHandler, expressRuntime } from '@forinda/kickjs'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { localOnly } from '@/middleware/local-only'
import { ToolsModule } from './tools.module'

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

async function boot() {
  const { app } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ToolsModule()],
    middlewares: [localOnly(), express.json()],
    onError: errorHandler(),
    overrides: [[STORAGE, memoryStorage()]],
  })
  return request(app.handle.bind(app))
}

const save = (http: ReturnType<typeof request>, query: string, body: Buffer) =>
  http
    .put(`/api/v1/tools/signatures?${query}`)
    .set('content-type', 'application/octet-stream')
    .send(body)

describe('remembered signatures', () => {
  test('saves, lists newest first, serves and deletes a signature', async () => {
    const http = await boot()
    expect((await http.get('/api/v1/tools/signatures').expect(200)).body).toEqual({
      signatures: [],
      name: '',
    })
    const first = (await save(http, 'kind=signature&made=drawn', PNG).expect(201)).body
    const second = (await save(http, 'kind=initials&made=typed', PNG).expect(201)).body
    expect(first).toMatchObject({ kind: 'signature', made: 'drawn' })
    expect(first.id).toMatch(/^[0-9a-f]{16}$/)

    const list = (await http.get('/api/v1/tools/signatures').expect(200)).body
    expect(list.signatures.map((s: { id: string }) => s.id)).toEqual([second.id, first.id])

    const picture = await http.get(`/api/v1/tools/signatures/${first.id}`).buffer(true).expect(200)
    expect(picture.headers['content-type']).toBe('image/png')
    expect(picture.headers['x-content-type-options']).toBe('nosniff')
    expect(Buffer.compare(picture.body, PNG)).toBe(0)

    await http.delete(`/api/v1/tools/signatures/${first.id}`).expect(204)
    await http.get(`/api/v1/tools/signatures/${first.id}`).expect(404)
    const after = (await http.get('/api/v1/tools/signatures').expect(200)).body
    expect(after.signatures.map((s: { id: string }) => s.id)).toEqual([second.id])
  })

  test('refuses a non-PNG or one over 2 MB, and unknown kinds', async () => {
    const http = await boot()
    await save(http, 'kind=signature&made=drawn', Buffer.from('%PDF-1.4 no')).expect(400)
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])
    await save(http, 'kind=signature&made=drawn', big).expect(413)
    await save(http, 'kind=stamp&made=drawn', PNG).expect(400)
    await save(http, 'kind=signature&made=stolen', PNG).expect(400)
  })

  test('remembers the name', async () => {
    const http = await boot()
    await http.put('/api/v1/tools/signatures/name').send({ name: '  Jo Mwangi ' }).expect(200)
    expect((await http.get('/api/v1/tools/signatures').expect(200)).body.name).toBe('Jo Mwangi')
    await http
      .put('/api/v1/tools/signatures/name')
      .send({ name: 'x'.repeat(101) })
      .expect(400)
  })

  test("refuses ids that aren't ours", async () => {
    const http = await boot()
    for (const bad of ['..%2Findex', 'index', 'ABCDEF0123456789', '123'])
      await http.get(`/api/v1/tools/signatures/${bad}`).expect(404)
    await http.delete('/api/v1/tools/signatures/..%2Findex').expect(404)
  })
})
