// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, test, vi } from 'vitest'
import { parseProject } from '@/core/project/project'
import { resolveTimeline } from '@/core/project/timeline'
import { createPlayer, sceneNeeds } from '../player'
import { disposeScene } from './stage'

const spy = (o: THREE.EventDispatcher<{ dispose: object }>) => {
  const fn = vi.fn()
  o.addEventListener('dispose', fn)
  return fn
}

describe('releasing a 3D scene', () => {
  test('frees geometry, the material, and every texture it uses', () => {
    const map = new THREE.Texture()
    const normalMap = new THREE.Texture()
    const material = new THREE.MeshStandardMaterial({ map, normalMap })
    const geometry = new THREE.BoxGeometry()
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, material))
    const spies = [map, normalMap, material, geometry].map(spy)
    disposeScene(scene)
    for (const fn of spies) expect(fn).toHaveBeenCalledOnce()
  })

  test('frees the background and lighting environment', () => {
    const scene = new THREE.Scene()
    const background = new THREE.Texture()
    const environment = new THREE.Texture()
    scene.background = background
    scene.environment = environment
    const spies = [background, environment].map(spy)
    disposeScene(scene)
    for (const fn of spies) expect(fn).toHaveBeenCalledOnce()
  })
})

describe('a player closed while a block is loading', () => {
  test('still runs cleanup that arrives after it closed', async () => {
    const late = vi.fn()
    let finish = () => {}
    const stage = await import('./stage')
    const mount = vi.spyOn(stage, 'mountStage').mockImplementation(
      (_canvas, _block, ctx) =>
        new Promise((done) => {
          finish = () => {
            ctx.onDestroy(late)
            done(() => {})
          }
        }),
    )
    const project = parseProject({
      version: 1,
      name: 'x',
      formats: ['16:9'],
      voice: { tts: 'en-US-AvaNeural', rate: '+0%' },
      theme: {
        colors: {
          bg: '#000',
          panel: '#000',
          line: '#000',
          fg: '#fff',
          muted: '#fff',
          accent: '#fff',
          good: '#fff',
          bad: '#fff',
        },
        fonts: { display: 'A', body: 'B', mono: 'C' },
      },
      scenes: [{ id: 's', kind: 'blocks', caption: '', blocks: [{ type: 'stage3d', actors: [] }] }],
    })
    const host = document.createElement('div')
    const player = createPlayer(host, project, resolveTimeline(project, {}, sceneNeeds), '16:9')
    await vi.waitFor(() => expect(mount).toHaveBeenCalled())
    player.destroy()
    expect(late).not.toHaveBeenCalled()
    finish()
    await player.loaded()
    expect(late).toHaveBeenCalledOnce()
    mount.mockRestore()
  })
})
