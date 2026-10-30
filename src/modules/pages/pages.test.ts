import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from '@forinda/kickjs-testing'
import { InertiaAdapter } from '@forinda/kickjs-inertia'
import { expressRuntime } from '@forinda/kickjs'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import express from 'express'
import { createRegistry } from '@/core/render/registry'
import { ProjectsModule } from '@/modules/projects/projects.module'
import { REGISTRY } from '@/modules/projects/tokens'
import { PagesModule } from './pages.module'

// No client build or `kick dev` needed: without one, pages render without
// their scripts. `version` is pinned so an Inertia visit that sends it isn't
// answered 409 once the client has been built.
async function boot() {
  const { app } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ProjectsModule(), PagesModule()],
    adapters: [InertiaAdapter({ version: 'test', errorPage: 'Error' })],
    middlewares: [express.json()],
    overrides: [
      [STORAGE, memoryStorage()],
      [REGISTRY, createRegistry({})],
    ],
  })
  const http = request(app.handle.bind(app))
  await http.post('/api/v1/projects').send({ name: 'Demo' }).expect(201)
  return http
}

const visit = { 'X-Inertia': 'true', 'X-Inertia-Version': 'test' }

describe('PagesController', () => {
  it('GET / renders Projects', async () => {
    const res = await (await boot()).get('/').set(visit).expect(200)
    expect(res.body.component).toBe('Projects')
    expect(res.body.props.projects).toEqual([{ slug: 'demo', name: 'Demo' }])
    expect(res.body.props.presets.map((p: { id: string }) => p.id)).toEqual([
      'showcase',
      'typescript-intro',
      'javascript-basics',
      'python-basics',
    ])
  })

  it('GET /p/demo renders Editor with the project', async () => {
    const res = await (await boot()).get('/p/demo').set(visit).expect(200)
    expect(res.body.component).toBe('Editor')
    expect(res.body.props).toMatchObject({ slug: 'demo', trusted: true, clips: {} })
    expect(res.body.props.project.name).toBe('Demo')
    expect(res.body.props.version).toMatch(/^[0-9a-f]{64}$/)
  })

  it('GET /p/demo/render/9x16 renders Render', async () => {
    const res = await (await boot()).get('/p/demo/render/9x16').set(visit).expect(200)
    expect(res.body.component).toBe('Render')
    expect(res.body.props).toMatchObject({ slug: 'demo', format: '9:16', trusted: true })
  })

  it('GET /p/nope is a 404 page', async () => {
    const res = await (await boot()).get('/p/nope').set(visit).expect(404)
    expect(res.body.component).toBe('Error')
  })

  it('GET /p/demo/render/4x3 is a 404 page', async () => {
    await (await boot()).get('/p/demo/render/4x3').set(visit).expect(404)
  })
})
