// Draws a project at any time t. The editor's preview and the render page both
// use this, so what you watch is what renders. Every frame follows from t:
// no CSS transitions, timers or clocks.
import { fontFaceCss } from '@/core/assets/fonts'
import { FORMATS, type Format, type Project, type Scene } from '@/core/project/project'
import type { Timeline, TimelineScene } from '@/core/project/timeline'
import { BLOCKS, reveal, type BlockCtx } from './blocks'
import { compileDraw } from './custom'
import { esc } from './highlight'
import { SCENE_CSS, STAGE_CSS, UNIT, boxColors } from './styles'
import {
  defaultSeconds,
  openingEffect,
  transitionEffect,
  type Effect,
  type Look,
} from './transitions'

export interface Player {
  frame(t: number): void
  destroy(): void
  errors: Map<string, Error>
  /** Custom scenes not run because the project isn't trusted. */
  locked: string[]
  /** Every image a block shows has loaded, or been noted in `errors`. */
  loaded(): Promise<void>
}

/** How long a scene's blocks take to finish appearing, plus time to read them. */
export function sceneNeeds(scene: Scene, read = 1): number {
  if (scene.kind !== 'blocks' || scene.blocks.length === 0) return 0
  const needs = (b: Scene & { kind: 'blocks' }) =>
    b.blocks.map((block) => (BLOCKS[block.type].needs as (x: typeof block) => number)(block))
  return Math.max(...needs(scene)) + read
}

const round = (x: number) => Math.round(x * 1000) / 1000

export function createPlayer(
  host: HTMLElement,
  project: Project,
  timeline: Timeline,
  format: Format,
  /**
   * `trusted`: run custom scenes' HTML, CSS and scripts. They're code, and a
   * project may come from someone else, so the app asks before running them.
   */
  opts: { captions?: boolean; trusted?: boolean; fileUrl?: (path: string) => string } = {},
): Player {
  const [width, height] = FORMATS[format]
  const { colors, fonts } = project.theme
  const box = boxColors(colors.bg, colors.fg)
  const stage = document.createElement('div')
  stage.className = 'fm-stage'
  stage.dataset.format = format
  stage.style.cssText = [
    `--ratio: ${width} / ${height}`,
    // Burned-in captions take the bottom band: scenes keep clear of it.
    ...((opts.captions ?? project.captions)
      ? [`--below: calc(${format === '9:16' ? 28 : 12} * var(--u))`]
      : []),
    `--u: calc(${UNIT[format]} * 1cqw)`,
    ...Object.entries(colors).map(([k, v]) => `--${k}: ${v}`),
    `--box: ${box.box}`,
    `--keyword: ${box.keyword}`,
    `--call: ${box.call}`,
    `--display: '${fonts.display}', system-ui, sans-serif`,
    `--body: '${fonts.body}', system-ui, sans-serif`,
    `--mono: '${fonts.mono}', ui-monospace, monospace`,
  ].join('; ')
  const style = document.createElement('style')
  // @font-face can't live in a shadow root, so the project's fonts go here.
  style.textContent = STAGE_CSS + (opts.fileUrl ? fontFaceCss(project.theme, opts.fileUrl) : '')
  host.append(style, stage)
  // Over the scenes, for the edges of a breaking transition.
  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  edges.setAttribute('class', 'fm-edges')
  const edgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  edges.append(edgePath)
  stage.append(edges)

  const errors = new Map<string, Error>()
  const lockedScenes: string[] = []
  const loading: Promise<void>[] = []
  const ctx: BlockCtx = {
    theme: project.theme,
    format,
    width,
    height,
    fileUrl: opts.fileUrl ?? ((path) => path),
    load(path, img) {
      loading.push(
        (img.decode?.() ?? Promise.resolve()).catch(() => {
          errors.set(path, new Error(`can't load ${path}`))
        }),
      )
    },
  }
  const byId = new Map(project.scenes.map((s) => [s.id, s]))

  const scenes = timeline.scenes.map((at) => {
    const scene = byId.get(at.id)!
    const el = document.createElement('div')
    el.dataset.scene = scene.id
    el.dataset.format = format
    stage.append(el)
    const root = el.attachShadow({ mode: 'open' })
    const fail = (err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err))
      if (!errors.has(scene.id)) {
        errors.set(scene.id, e)
        const notice = document.createElement('div')
        notice.className = 'scene-error'
        notice.textContent = `Scene ${scene.id}: ${e.message}`
        root.append(notice)
      }
    }
    let draw: (local: number) => void = () => {}
    if (scene.kind === 'blocks') {
      root.innerHTML = `<style>${SCENE_CSS}</style><div class="scene"><div class="stack"></div></div>`
      const frame = root.querySelector<HTMLElement>('.scene')!
      const body = root.querySelector<HTMLElement>('.stack')!
      const draws = scene.blocks.map((block) => {
        const wrap = document.createElement('div')
        wrap.className = 'block'
        body.append(wrap)
        try {
          const paint = (
            BLOCKS[block.type].mount as (
              r: HTMLElement,
              b: typeof block,
              c: BlockCtx,
            ) => (l: number) => void
          )(wrap, block, ctx)
          return (local: number) => {
            reveal(wrap, local - (block.at ?? 0))
            paint(local)
          }
        } catch (err) {
          fail(err)
          return () => {}
        }
      })
      // A scene with more than fits is zoomed down once (never below 55%),
      // measured with real fonts and every block at its final size.
      let fitted = false
      const fitScene = () => {
        if (fitted || !frame.clientHeight || document.fonts?.status === 'loading') return
        fitted = true
        draws.forEach((d) => d(at.length))
        const css = getComputedStyle(frame)
        const room = frame.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom)
        if (body.scrollHeight > room)
          body.style.zoom = String(
            Math.max(0.55, Math.floor((room / body.scrollHeight) * 1000) / 1000),
          )
      }
      draw = (local) => {
        fitScene()
        draws.forEach((d) => d(local))
      }
    } else if (!opts.trusted) {
      lockedScenes.push(scene.id)
      const css = document.createElement('style')
      css.textContent = SCENE_CSS
      const locked = document.createElement('div')
      locked.className = 'scene scene-locked'
      locked.textContent = `Custom scene "${scene.id}" isn't run until you trust this project.`
      root.append(css, locked)
    } else {
      // textContent, so the scene's CSS can't close the <style> and add markup.
      const css = document.createElement('style')
      css.textContent = SCENE_CSS + scene.css
      const body = document.createElement('div')
      body.className = 'scene custom'
      body.innerHTML = scene.html
      root.append(css, body)
      try {
        const userDraw = compileDraw(scene.script)
        const drawCtx = {
          root,
          theme: project.theme,
          format,
          width,
          height,
          length: at.length,
          scene,
        }
        draw = (local) => userDraw(local, drawCtx)
      } catch (err) {
        fail(err)
      }
    }
    return {
      at,
      scene,
      el,
      draw: (local: number) => {
        if (errors.has(scene.id) && scene.kind === 'custom') return
        try {
          draw(local)
        } catch (err) {
          fail(err)
        }
      },
    }
  })

  const caption = document.createElement('div')
  caption.className = 'fm-caption'
  caption.dataset.caption = ''
  caption.hidden = true
  stage.append(caption)
  const showCaptions = opts.captions ?? project.captions

  const indexAt = (t: number) => {
    const i = scenes.findIndex(({ at }) => t >= at.start && t < at.start + at.length)
    return i < 0 ? (t >= timeline.total ? scenes.length - 1 : 0) : i
  }

  function place(
    s: (typeof scenes)[number],
    state: { live: boolean; shown: boolean; look?: Look; z: number },
  ) {
    const { opacity, shift, transform, clipPath } = state.look ?? {}
    s.el.dataset.live = String(state.live)
    // The whole style at once, so its text doesn't depend on what was drawn before.
    s.el.style.cssText = [
      `visibility: ${state.shown ? 'visible' : 'hidden'}`,
      `opacity: ${state.shown ? round(opacity ?? 1) : 0}`,
      `z-index: ${state.z}`,
      ...(transform || shift ? [`transform: ${transform ?? `translateX(${round(shift!)}%)`}`] : []),
      ...(clipPath ? [`clip-path: ${clipPath}`] : []),
    ].join('; ')
  }

  function frame(t: number) {
    const i = indexAt(t)
    const current = scenes[i]
    const local = t - current.at.start
    const kind = current.scene.transition
    const seconds = current.scene.transitionSeconds ?? defaultSeconds(kind)
    const p = Math.min(1, Math.max(0, local / seconds))
    // While a transition runs, the previous scene stays in the picture.
    const under = kind !== 'cut' && p < 1 && i > 0 ? scenes[i - 1] : undefined
    const effect: Effect =
      p >= 1
        ? { incoming: {} }
        : (under ? transitionEffect : openingEffect)(kind, p, stage.clientWidth, stage.clientHeight)
    for (const s of scenes) {
      if (s === current) {
        place(s, { live: true, shown: true, look: effect.incoming, z: effect.oldOnTop ? 1 : 2 })
        s.draw(local)
      } else if (s === under) {
        place(s, { live: false, shown: true, look: effect.outgoing, z: effect.oldOnTop ? 2 : 1 })
        s.draw(t - s.at.start)
      } else {
        place(s, { live: false, shown: false, z: 0 })
        // Hidden scenes are drawn too, at their nearest moment, so the page at
        // t is the same whatever was played before.
        s.draw(Math.min(s.at.length, Math.max(0, t - s.at.start)))
      }
    }
    edges.setAttribute('viewBox', `0 0 ${stage.clientWidth || 1} ${stage.clientHeight || 1}`)
    edgePath.setAttribute('d', effect.edges ?? '')
    drawCaption(current.at, local)
  }

  function drawCaption(at: TimelineScene, local: number) {
    const text = byId.get(at.id)!.caption
    const on = showCaptions && !!text.trim() && local < (at.clip ? at.clip.seconds : at.length)
    caption.hidden = !on
    const html = on ? `<span>${esc(text)}</span>` : ''
    if (caption.innerHTML !== html) caption.innerHTML = html
  }

  return {
    frame,
    errors,
    locked: lockedScenes,
    loaded: () => Promise.all(loading).then(() => {}),
    destroy() {
      stage.remove()
      style.remove()
    },
  }
}
