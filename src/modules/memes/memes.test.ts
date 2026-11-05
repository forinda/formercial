import { errorHandler, expressRuntime } from '@forinda/kickjs'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { localOnly } from '@/middleware/local-only'
import { withDomainErrors } from '@/modules/projects/http/domain-errors'
import { ProjectsModule } from '@/modules/projects/projects.module'
import { MemesModule } from './memes.module'

async function boot() {
  const storage = memoryStorage()
  const { app } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ProjectsModule(), MemesModule()],
    middlewares: [localOnly(), express.json()],
    onError: withDomainErrors(errorHandler()),
    overrides: [[STORAGE, storage]],
  })
  return { http: request(app.handle.bind(app)), storage }
}

describe('memes', () => {
  test('a new meme is listed, read, saved and deleted', async () => {
    const { http } = await boot()
    const { body } = await http.post('/api/v1/memes').send({ name: 'Monday mood' }).expect(201)
    expect(body.id).toBe('monday-mood')
    const again = await http.post('/api/v1/memes').send({ name: 'Monday mood' }).expect(201)
    expect(again.body.id).toBe('monday-mood-2')

    const list = await http.get('/api/v1/memes').expect(200)
    expect(list.body.map((m: { id: string }) => m.id)).toEqual(['monday-mood', 'monday-mood-2'])

    const meme = (await http.get('/api/v1/memes/monday-mood').expect(200)).body
    expect(meme).toMatchObject({ name: 'Monday mood', size: '1:1', layout: 'bar' })
    const saved = await http
      .put('/api/v1/memes/monday-mood')
      .send({ ...meme, layout: 'classic', texts: [{ text: 'top' }, { text: 'bottom' }] })
      .expect(200)
    expect(saved.body.texts[1]).toMatchObject({ text: 'bottom', outline: true })

    await http.delete('/api/v1/memes/monday-mood').expect(204)
    await http.get('/api/v1/memes/monday-mood').expect(404)
  })

  test('a save that breaks the schema is refused, and changes nothing', async () => {
    const { http } = await boot()
    await http.post('/api/v1/memes').send({ name: 'M' }).expect(201)
    const before = (await http.get('/api/v1/memes/m')).body
    await http
      .put('/api/v1/memes/m')
      .send({ ...before, bar: 'red' })
      .expect(400)
    await http
      .put('/api/v1/memes/m')
      .send({ ...before, media: 'media/../x.png' })
      .expect(400)
    expect((await http.get('/api/v1/memes/m')).body).toEqual(before)
  })

  test('pictures go under media/ and come back with their type', async () => {
    const { http } = await boot()
    await http.post('/api/v1/memes').send({ name: 'M' }).expect(201)
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    await http
      .put('/api/v1/memes/m/file?path=media/cat.png')
      .set('content-type', 'application/octet-stream')
      .send(png)
      .expect(204)
    const got = await http.get('/api/v1/memes/m/file?path=media/cat.png').expect(200)
    expect(got.headers['content-type']).toBe('image/png')
    expect(Buffer.from(got.body)).toEqual(png)

    for (const path of ['meme.json', 'media/../meme.json', 'media/x.svg', 'other/cat.png'])
      await http
        .put(`/api/v1/memes/m/file?path=${encodeURIComponent(path)}`)
        .set('content-type', 'application/octet-stream')
        .send(png)
        .expect(400)
    await http
      .put('/api/v1/memes/nope/file?path=media/cat.png')
      .set('content-type', 'application/octet-stream')
      .send(png)
      .expect(404)
  })

  test("memes stay out of the projects list, and a meme id can't leave its folder", async () => {
    const { http } = await boot()
    await http.post('/api/v1/memes').send({ name: 'M' }).expect(201)
    const projects = await http.get('/api/v1/projects').expect(200)
    expect(JSON.stringify(projects.body)).not.toContain('_memes')
    await http.get('/api/v1/memes/..%2Fdemo').expect(400)
  })
})
