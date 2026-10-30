// `kick cxc …`: make, voice and render commercials without opening the app.
// Registered in kick.config.ts; add your own commands next to it with another
// defineCliPlugin.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { defineCliPlugin, type KickCliPlugin } from '@forinda/kickjs-cli'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { FORMATS, slugFrom, starterProject, type Format } from '../core/project'
import { createRegistry, driverReport, type CxcConfig } from '../core/render/registry'
import { renderProject } from '../core/render/render-project'
import { voiceProject } from '../core/voice/voice-project'
import { createWorkspace } from '../core/workspace'

/** A slug under the projects folder, or a path to a project folder. */
export function resolveProject(arg: string, projectRoot: string): { root: string; slug: string } {
  const asPath = isAbsolute(arg) ? arg : resolve(projectRoot, arg)
  if (
    arg.includes('/') ||
    (existsSync(asPath) &&
      statSync(asPath).isDirectory() &&
      existsSync(join(asPath, 'project.json')))
  ) {
    return { root: dirname(asPath), slug: basename(asPath) }
  }
  const root = process.env.CXC_PROJECTS
    ? resolve(projectRoot, process.env.CXC_PROJECTS)
    : join(projectRoot, 'projects')
  return { root, slug: arg }
}

const freePort = () =>
  new Promise<number>((ok, fail) => {
    const s = createServer()
    s.once('error', fail)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => ok(port))
    })
  })

/** Start `kick dev` on a free port so a driver has a render page to open. */
async function startApp(
  projectRoot: string,
  projects: string,
): Promise<{ origin: string; stop(): void }> {
  const port = await freePort()
  const child: ChildProcess = spawn('pnpm', ['exec', 'kick', 'dev'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), CXC_PROJECTS: projects },
    stdio: 'ignore',
  })
  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`kick dev exited ${child.exitCode}`)
    const up = await fetch(`${origin}/api/v1/drivers`).then(
      (r) => r.ok,
      () => false,
    )
    if (up) return { origin, stop: () => child.kill('SIGINT') }
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill('SIGINT')
  throw new Error("the app didn't start within 60s")
}

export function cxcCliPlugin(config: CxcConfig): KickCliPlugin {
  return defineCliPlugin({
    name: 'commercial-x-creator',
    register(program, ctx) {
      const registry = createRegistry(config)
      const open = (arg: string) => {
        const { root, slug } = resolveProject(arg, ctx.projectRoot)
        return { root, slug, ws: createWorkspace(diskStorage({ root })) }
      }
      const cxc = program
        .command('cxc')
        .description('Make commercials: new, voice, render, drivers, preview')

      cxc
        .command('new <name>')
        .description('Create a project with one starter scene')
        .action(async (name: string) => {
          const { root, slug, ws } = open(slugFrom(name))
          await ws.write(slug, starterProject(name), null)
          ctx.log(`Created ${join(root, slug).replace(`${ctx.projectRoot}/`, '')}/project.json`)
        })

      cxc
        .command('voice <project>')
        .description('Generate any missing or changed voice lines')
        .action(async (arg: string) => {
          const { slug, ws } = open(arg)
          const provider = registry.voices.get('edge-tts')!
          const check = await provider.check()
          if (!check.ok)
            throw new Error(`${provider.name} can't run here: ${check.missing.join(', ')}`)
          const clips = await voiceProject(ws, slug, provider, {
            onProgress: (done, total) => ctx.log(`voice ${done}/${total}`),
          })
          ctx.log(`${Object.values(clips).filter(Boolean).length} scene(s) voiced`)
        })

      cxc
        .command('render <project>')
        .description('Voice, then render each format to renders/')
        .option('--format <format>', '16:9, 9:16, 1:1 or all', 'all')
        .option('--driver <name>', 'render driver', 'chromium-ffmpeg')
        .option('--fps <n>', 'frames per second', '30')
        .option('--seconds <n>', 'render only the first N seconds')
        .option('--origin <url>', 'a running app to render from (default: start one)')
        .action(
          async (
            arg: string,
            opts: {
              format: string
              driver: string
              fps: string
              seconds?: string
              origin?: string
            },
          ) => {
            const { root, slug, ws } = open(arg)
            const driver = registry.drivers.get(opts.driver)
            if (!driver)
              throw new Error(`no render driver "${opts.driver}" (kick cxc drivers lists them)`)
            const check = await driver.check()
            if (!check.ok)
              throw new Error(`${driver.name} can't run here: ${check.missing.join(', ')}`)
            const { project } = await ws.read(slug)
            const formats = (opts.format === 'all' ? project.formats : [opts.format]) as Format[]
            if (!formats.every((f) => f in FORMATS))
              throw new Error('--format is 16:9, 9:16, 1:1 or all')
            const voice = registry.voices.get('edge-tts')!
            const canVoice = (await voice.check()).ok
            if (!canVoice) ctx.log('edge-tts not found: rendering with the clips already made')
            const app = opts.origin
              ? { origin: opts.origin, stop() {} }
              : await startApp(ctx.projectRoot, root)
            try {
              for (const format of formats) {
                const out = await renderProject({
                  ws,
                  slug,
                  format,
                  driver,
                  fps: Number(opts.fps),
                  seconds: opts.seconds ? Number(opts.seconds) : undefined,
                  origin: app.origin,
                  voice: canVoice ? voice : undefined,
                  onProgress: (p) =>
                    p.phase === 'frames' &&
                    p.frames &&
                    ctx.log(`${format} ${Math.round(((p.frame ?? 0) / p.frames) * 100)}%`),
                })
                ctx.log(`${format}: ${join(root, slug, out.mp4)}`)
              }
            } finally {
              app.stop()
            }
          },
        )

      cxc
        .command('drivers')
        .description('List render drivers and what each one needs')
        .action(async () => {
          for (const { name, check } of await driverReport(registry)) {
            ctx.log(
              `${name.padEnd(20)} ${check.ok ? 'ready' : `missing: ${check.missing.join(', ')}`}`,
            )
          }
        })

      cxc
        .command('preview <project>')
        .description('Start the app and print the editor address')
        .action(async (arg: string) => {
          const { root, slug } = open(arg)
          const app = await startApp(ctx.projectRoot, root)
          ctx.log(`Editing ${slug}: ${app.origin}/p/${slug}  (Ctrl+C to stop)`)
          await new Promise<void>((done) => process.once('SIGINT', () => (app.stop(), done())))
        })
    },
  })
}
