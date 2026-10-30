// `kick formercial …`: make, voice and render commercials without opening the app.
// Registered in kick.config.ts; add your own commands next to it with another
// defineCliPlugin.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { defineCliPlugin, type KickCliPlugin } from '@forinda/kickjs-cli'
import { diskStorage } from '@forinda/kickjs-storage/disk'
import { FORMATS, slugFrom, starterProject, type Format } from '@/core/project'
import { createRegistry, driverReport, type FormercialConfig } from '@/core/render/registry'
import { renderProject } from '@/core/render/render-project'
import { voiceProject } from '@/core/voice/voice-project'
import { FormercialSettings, checkFps } from '@/core/settings'
import { createTrust } from '@/core/trust'
import { PRESETS, fromPreset, storePresetFonts } from '@/presets'
import { historyFileFor, openHistory } from '@/core/history'
import { createWorkspace } from '@/core/workspace'

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
  const root = resolve(projectRoot, FormercialSettings.get().projects)
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
    env: {
      ...process.env,
      PORT: String(port),
      FORMERCIAL_PROJECTS: projects,
      FORMERCIAL_RENDER: '1',
    },
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

/**
 * What the built app needs to serve MCP over stdio. stdout is the protocol
 * stream, so nothing but warnings may be logged (those go to stderr). The port
 * serves the render page; the session secret only has to exist for this run.
 */
export function mcpEnv(opts: {
  port: number
  projects: string
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
}): Record<string, string | undefined> {
  return {
    ...opts.env,
    KICK_MCP_STDIO: '1',
    NODE_ENV: 'production',
    PORT: String(opts.port),
    APP_URL: `http://localhost:${opts.port}`,
    // Always its own: a .env may hold the dev default, which production refuses.
    SESSION_SECRET: randomBytes(32).toString('hex'),
    FORMERCIAL_PROJECTS: opts.projects,
    LOG_LEVEL: 'warn',
  }
}

export function formercialCliPlugin(config: FormercialConfig): KickCliPlugin {
  return defineCliPlugin({
    name: 'formercial',
    register(program, ctx) {
      const registry = createRegistry(config)
      const open = (arg: string) => {
        const { root, slug } = resolveProject(arg, ctx.projectRoot)
        const history = openHistory(
          historyFileFor(ctx.projectRoot, root, FormercialSettings.get().historyFile),
        )
        return { root, slug, ws: createWorkspace(diskStorage({ root }), { history }) }
      }
      const group = program
        .command('formercial')
        .description('Make commercials: new, voice, render, history, rollback, drivers, preview')

      group
        .command('new <name>')
        .description('Create a project: one starter scene, or a preset')
        .option('--preset <id>', `start from a preset: ${PRESETS.map((p) => p.id).join(', ')}`)
        .action(async (name: string, opts: { preset?: string }) => {
          const { root, slug, ws } = open(slugFrom(name))
          const { voice } = FormercialSettings.get()
          await ws.write(
            slug,
            opts.preset ? fromPreset(opts.preset, name, voice) : starterProject(name, voice),
            null,
            'cli',
          )
          if (opts.preset) await storePresetFonts(ws, slug, opts.preset)
          ctx.log(`Created ${join(root, slug).replace(`${ctx.projectRoot}/`, '')}/project.json`)
        })

      group
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

      group
        .command('render <project>')
        .description('Voice, then render each format to renders/')
        .option('--format <format>', '16:9, 9:16, 1:1 or all', 'all')
        .option('--driver <name>', 'render driver (default: FORMERCIAL_DRIVER, or chromium-ffmpeg)')
        .option('--fps <n>', 'frames per second (default: FORMERCIAL_FPS, or 30)')
        .option('--seconds <n>', 'render only the first N seconds')
        .option('--origin <url>', 'a running app to render from (default: start one)')
        .action(
          async (
            arg: string,
            opts: {
              format: string
              driver?: string
              fps?: string
              seconds?: string
              origin?: string
            },
          ) => {
            const { root, slug, ws } = open(arg)
            const driverName = opts.driver ?? FormercialSettings.get().driver
            const driver = registry.drivers.get(driverName)
            if (!driver)
              throw new Error(
                `no render driver "${driverName}" (kick formercial drivers lists them)`,
              )
            const check = await driver.check()
            if (!check.ok)
              throw new Error(`${driver.name} can't run here: ${check.missing.join(', ')}`)
            const fps = opts.fps === undefined ? FormercialSettings.get().fps : checkFps(opts.fps)
            const { project } = await ws.read(slug)
            if (!(await createTrust({ workspace: root }).isTrusted(slug, project))) {
              throw new Error(
                `${slug} has custom scenes you haven't trusted: open it in the app (kick formercial preview ${arg}) and trust it first`,
              )
            }
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
                  fps,
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

      group
        .command('history <project>')
        .description('List the steps a project has been through')
        .action(async (arg: string) => {
          const { slug, ws } = open(arg)
          if (!ws.history) throw new Error("history is off: SQLite couldn't start")
          await ws.remember(slug, await ws.getFile(slug, 'project.json'), 'outside')
          const current = (await ws.history.head(slug))?.id
          for (const r of await ws.history.list(slug)) {
            const when = new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ')
            const name = r.label ? ` [${r.label}]` : ''
            ctx.log(
              `${r.id === current ? '*' : ' '} ${String(r.id).padStart(5)}  ${when}  ${r.source.padEnd(8)} ${r.summary}${name}`,
            )
          }
        })

      group
        .command('rollback <project> <step>')
        .description('Put a project back to a step from history; the steps after it are kept')
        .action(async (arg: string, step: string) => {
          const { slug, ws } = open(arg)
          await ws.restore(slug, Number(step))
          ctx.log(`${slug} is back at step ${step}`)
        })

      group
        .command('name <project> <step> [name]')
        .description('Name a step, like "v1"; leave the name out to clear it')
        .action(async (arg: string, step: string, name?: string) => {
          const { slug, ws } = open(arg)
          if (!ws.history) throw new Error("history is off: SQLite couldn't start")
          await ws.history.setLabel(slug, Number(step), name?.trim() || null)
        })

      group
        .command('drivers')
        .description('List render drivers and what each one needs')
        .action(async () => {
          for (const { name, check } of await driverReport(registry)) {
            ctx.log(
              `${name.padEnd(20)} ${check.ok ? 'ready' : `missing: ${check.missing.join(', ')}`}`,
            )
          }
        })

      group
        .command('preview <project>')
        .description('Start the app and print the editor address')
        .action(async (arg: string) => {
          const { root, slug } = open(arg)
          const app = await startApp(ctx.projectRoot, root)
          ctx.log(`Editing ${slug}: ${app.origin}/p/${slug}  (Ctrl+C to stop)`)
          await new Promise<void>((done) => process.once('SIGINT', () => (app.stop(), done())))
        })

      group
        .command('mcp')
        .description('Serve the agent tools over stdio, for MCP clients that start the server')
        .action(async () => {
          const entry = join(ctx.projectRoot, 'dist/index.js')
          if (!existsSync(entry)) {
            // Build output goes to stderr: stdout belongs to the protocol.
            const build = spawnSync('pnpm', ['build'], {
              cwd: ctx.projectRoot,
              stdio: ['ignore', process.stderr, process.stderr],
            })
            if (build.status !== 0) throw new Error('pnpm build failed')
          }
          const child = spawn(process.execPath, [entry], {
            cwd: ctx.projectRoot,
            stdio: 'inherit',
            env: mcpEnv({
              port: await freePort(),
              projects: resolve(ctx.projectRoot, FormercialSettings.get().projects),
              env: process.env,
            }) as NodeJS.ProcessEnv,
          })
          for (const signal of ['SIGINT', 'SIGTERM'] as const) {
            process.on(signal, () => child.kill(signal))
          }
          child.on('exit', (code) => process.exit(code ?? 0))
          await new Promise(() => {})
        })
    },
  })
}
