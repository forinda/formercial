import { errorHandler, expressRuntime } from '@forinda/kickjs'
import { MCP_ADAPTER, McpAdapter, type McpAdapterInstance } from '@forinda/kickjs-mcp'
import { memoryStorage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { createTestApp } from '@forinda/kickjs-testing'
import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'
import { starterProject } from '@/core/project/project'
import type { RenderDriver } from '@/core/render/driver'
import { createRegistry } from '@/core/render/registry'
import { localOnly } from '@/middleware/local-only'
import { withDomainErrors } from './http/domain-errors'
import { ProjectsModule } from './projects.module'
import { renderOrigin } from './http/render-origin'
import { REGISTRY } from './tokens'

const fake: RenderDriver = {
  name: 'chromium-ffmpeg-fake',
  check: async () => ({ ok: true, missing: [] }),
  render: async () => ({ mp4: 'renders/a.mp4', srt: 'renders/a.srt' }),
}

async function boot() {
  const { app, container } = await createTestApp({
    runtime: expressRuntime(),
    modules: [ProjectsModule()],
    middlewares: [localOnly(), express.json()],
    onError: withDomainErrors(errorHandler()),
    adapters: [McpAdapter({ name: 'formercial', mode: 'explicit' })],
    overrides: [
      [STORAGE, memoryStorage()],
      [REGISTRY, createRegistry({ drivers: [fake] })],
    ],
  })
  const mcp = container.resolve(MCP_ADAPTER) as McpAdapterInstance
  const http = request(app.handle.bind(app))
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const tool = mcp.getTools().find((t) => t.name === name)
    if (!tool) throw new Error(`no tool ${name}`)
    const result = await mcp.dispatchTool(tool, args)
    const text = (result.content[0] as { text: string }).text
    let json: any
    try {
      json = JSON.parse(text.replace(/^Accepted \(202\)[^\n]*\n/, ''))
    } catch {
      json = undefined
    }
    return { isError: !!result.isError, text, json }
  }
  return { mcp, http, call }
}

const custom = (script: string) => ({
  ...starterProject('Demo'),
  scenes: [{ id: 'c', kind: 'custom', caption: '', script }],
})

describe('mcp tools', () => {
  test('finds an icon and adds it to the project', async () => {
    const { call } = await boot()
    const { json: created } = await call('create_project', { name: 'Icons' })
    const slug = created.slug
    const real = globalThis.fetch
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      if (!String(url).startsWith('https://api.iconify.design')) return real(url, init)
      return Promise.resolve(
        new Response(
          String(url).includes('/search?')
            ? JSON.stringify({ icons: ['logos:postgresql'] })
            : '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ),
      )
    })
    try {
      const found = await call('search_icons', { slug, query: 'postgres' })
      expect(found.json.icons).toEqual(['logos:postgresql'])
      const added = await call('add_icon', { slug, name: 'logos:postgresql' })
      expect(added.json.path).toBe('media/icons/logos-postgresql.svg')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('exposes exactly the agent tools: no trust, recordings, uploads or deletes', async () => {
    const { mcp } = await boot()
    expect(
      mcp
        .getTools()
        .map((t) => t.name)
        .sort(),
    ).toEqual([
      'add_icon',
      'create_project',
      'get_project',
      'get_renders',
      'list_drivers',
      'list_history',
      'list_presets',
      'list_projects',
      'project_schema',
      'render_project',
      'restore_revision',
      'search_icons',
      'update_project',
      'voice_project',
    ])
  })

  test('every tool describes its arguments', async () => {
    const { mcp } = await boot()
    const tool = (name: string) => mcp.getTools().find((t) => t.name === name)!
    expect(JSON.stringify(tool('create_project').inputSchema)).toContain('preset')
    expect(JSON.stringify(tool('update_project').inputSchema)).toContain('baseVersion')
    expect(JSON.stringify(tool('render_project').inputSchema)).toContain('format')
    expect(JSON.stringify(tool('render_project').inputSchema)).toContain('slug')
  })

  test('an agent can read the history and put a project back', async () => {
    const { call } = await boot()
    const made = await call('create_project', { name: 'Hist', preset: 'python-basics' })
    const { slug } = made.json
    const read = await call('get_project', { slug })
    await call('update_project', {
      slug,
      project: { ...read.json.project, name: 'Renamed' },
      baseVersion: read.json.version,
    })
    const history = await call('list_history', { slug })
    expect(history.json.older).toBe(false)
    expect(history.json.revisions.map((r: { source: string }) => r.source)).toEqual([
      'agent',
      expect.any(String),
    ])
    const older = await call('list_history', { slug, before: history.json.revisions[0].id })
    expect(older.json.revisions.length).toBe(1)
    const restored = await call('restore_revision', { slug, id: older.json.revisions[0].id })
    expect(restored.isError).toBe(false)
    expect(restored.json.version).toBe(read.json.version)
    expect((await call('get_project', { slug })).json.project.name).toBe('Hist')
  })

  test('an agent can start from a preset, read it, and change it', async () => {
    const { call } = await boot()
    const made = await call('create_project', { name: 'Py Ad', preset: 'python-basics' })
    expect(made.isError).toBe(false)
    const read = await call('get_project', { slug: made.json.slug })
    expect(read.json.project.scenes[0].id).toBe('py-intro')
    const saved = await call('update_project', {
      slug: made.json.slug,
      project: { ...read.json.project, name: 'Renamed' },
      baseVersion: read.json.version,
    })
    expect(saved.isError).toBe(false)
    expect((await call('get_project', { slug: made.json.slug })).json.project.name).toBe('Renamed')
  })

  test('project_schema describes project.json', async () => {
    const { call } = await boot()
    const { json } = await call('project_schema')
    expect(json.properties.scenes).toBeDefined()
    expect(json.properties.theme).toBeDefined()
  })

  test('a stale update is an error the agent can read', async () => {
    const { call } = await boot()
    const { json: made } = await call('create_project', { name: 'Demo' })
    const res = await call('update_project', {
      slug: made.slug,
      project: starterProject('X'),
      baseVersion: 'old',
    })
    expect(res.isError).toBe(true)
    expect(res.json.current).toMatch(/^[0-9a-f]{64}$/)
  })

  test('custom code an agent adds is not trusted, and will not render', async () => {
    const { call } = await boot()
    const { json: made } = await call('create_project', { name: 'Demo' })
    const { json: read } = await call('get_project', { slug: made.slug })
    const saved = await call('update_project', {
      slug: made.slug,
      project: custom('export function draw() {}'),
      baseVersion: read.version,
    })
    expect(saved.json.trusted).toBe(false)
    const render = await call('render_project', {
      slug: made.slug,
      format: '16:9',
      driver: fake.name,
    })
    expect(render.isError).toBe(true)
    expect(render.text).toMatch(/trust/)
  })

  test('an agent editing a trusted project loses its trust; the editor does not', async () => {
    const { call, http } = await boot()
    const { json: made } = await call('create_project', { name: 'Demo' })
    const url = `/api/v1/projects/${made.slug}`
    const editor = { 'x-formercial-editor': '1' }
    let { version } = (await http.get(url)).body
    ;({ version } = (
      await http
        .put(url)
        .set(editor)
        .send({ project: custom('export function draw() {}'), baseVersion: version })
        .expect(200)
    ).body)
    expect((await http.get(url)).body.trusted).toBe(true)

    const edited = await http
      .put(url)
      .set(editor)
      .send({ project: custom('export function draw(t) { t }'), baseVersion: version })
      .expect(200)
    expect(edited.body.trusted).toBe(true)

    const byAgent = await call('update_project', {
      slug: made.slug,
      project: custom('export function draw() { fetch("//evil") }'),
      baseVersion: edited.body.version,
    })
    expect(byAgent.json.trusted).toBe(false)
    expect((await http.get(url)).body.trusted).toBe(false)
  })

  test('a save without the editor mark does not keep trust either', async () => {
    const { http, call } = await boot()
    const { json: made } = await call('create_project', { name: 'Demo' })
    const url = `/api/v1/projects/${made.slug}`
    const { version } = (await http.get(url)).body
    const res = await http
      .put(url)
      .send({ project: custom('export function draw() {}'), baseVersion: version })
      .expect(200)
    expect(res.body.trusted).toBe(false)
  })

  test('render_project queues and reports through get_renders', async () => {
    const { call } = await boot()
    const { json: made } = await call('create_project', { name: 'Demo' })
    const res = await call('render_project', { slug: made.slug, format: '16:9', driver: fake.name })
    expect(res.text).toMatch(/Accepted/)
    expect(res.json.jobs[0].format).toBe('16:9')
    const { json } = await call('get_renders', { slug: made.slug })
    expect(json.jobs).toHaveLength(1)
  })
})

describe('renderOrigin', () => {
  const req = (host: string, tool?: string, localPort = 5555) => ({
    headers: { host, ...(tool ? { 'x-mcp-tool': tool } : {}) },
    socket: { localPort },
  })

  test('a browser request uses the port it connected to, whatever Host says', () => {
    expect(renderOrigin(req('localhost:9'), 3000)).toBe('http://127.0.0.1:5555')
  })
  test('a tool call uses the port the client reached, from Host', () => {
    expect(renderOrigin(req('localhost:3911', 'render_project'), 3000)).toBe(
      'http://127.0.0.1:3911',
    )
  })
  test('a tool call with no port in Host (stdio) uses the configured port', () => {
    expect(renderOrigin(req('localhost', 'render_project'), 3000)).toBe('http://127.0.0.1:3000')
  })
})
