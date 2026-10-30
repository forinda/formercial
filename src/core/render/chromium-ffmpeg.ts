// The built-in render driver: Chromium draws each frame of the render page,
// ffmpeg encodes them and lays the voice and music under the picture.
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { audioGraph } from '@/core/audio'
import { hasCommand, run } from '@/core/media'
import { FORMATS } from '@/core/project'
import { toSrt } from '@/core/srt'
import { findChrome, launchChrome } from './cdp'
import type { RenderDriver } from './driver'

const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')

export const chromiumFfmpeg: RenderDriver = {
  name: 'chromium-ffmpeg',

  async check() {
    const missing: string[] = []
    if (!(await hasCommand('ffmpeg'))) missing.push('ffmpeg')
    if (!(await hasCommand('ffprobe'))) missing.push('ffprobe')
    if (!findChrome())
      missing.push('chromium (set CHROME, or npx playwright install chromium-headless-shell)')
    return { ok: missing.length === 0, missing }
  },

  async render(job, dir, progress) {
    const [width, height] = FORMATS[job.format]
    const total = Math.min(job.timeline.total, job.seconds ?? Infinity)
    const frames = Math.round(total * job.fps)
    const name = `renders/${job.format.replace(':', 'x')}-${stamp()}`
    await mkdir(join(dir, 'renders'), { recursive: true })
    const picture = join(dir, `${name}.picture.mp4`)

    const page = await launchChrome()
    const encoder = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(job.fps),
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'medium',
        '-crf',
        '18',
        picture,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    )
    let encoderLog = ''
    encoder.stderr.on('data', (d) => (encoderLog += d))
    const encoded = new Promise<void>((resolve, reject) => {
      encoder.on('error', reject)
      encoder.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg: ${encoderLog.slice(-300)}`)),
      )
    })

    try {
      await page.send('Page.enable')
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await page.send('Page.navigate', { url: job.renderUrl })
      const evaluate = async <T>(expression: string): Promise<T> => {
        const r = await page.send<{
          result: { value: T }
          exceptionDetails?: { text: string; exception?: { description?: string } }
        }>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        }
        return r.result.value
      }
      // The page may still be loading: wait for its contract to appear.
      await evaluate(`new Promise((ok, fail) => { const s = Date.now(); (function poll() {
        if (window.cxc) return window.cxc.ready.then(ok, fail)
        if (Date.now() - s > 30000) return fail(new Error('render page never set window.cxc'))
        setTimeout(poll, 50) })() })`)

      const firstFrames = new Set(job.timeline.scenes.map((s) => Math.round(s.start * job.fps)))
      for (let f = 0; f < frames; f++) {
        await evaluate(`window.cxc.frame(${f / job.fps})`)
        if (firstFrames.has(f) || f === frames - 1) {
          const errors = await evaluate<Record<string, string>>('window.cxc.errors()')
          const [id, message] = Object.entries(errors)[0] ?? []
          if (id) throw new Error(`scene ${id}: ${message}`)
        }
        const { data } = await page.send<{ data: string }>('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 92,
        })
        if (!encoder.stdin.write(Buffer.from(data, 'base64'))) {
          await new Promise((r) => encoder.stdin.once('drain', r))
        }
        if (f % job.fps === 0) progress({ phase: 'frames', frame: f, frames })
      }
      encoder.stdin.end()
      await encoded
    } catch (err) {
      encoder.kill()
      throw err
    } finally {
      page.close()
    }

    progress({ phase: 'audio', frame: frames, frames })
    const clips = audioGraph(job.timeline).inputs
    const graph = audioGraph(
      job.timeline,
      job.music && { input: clips.length + 1, volume: job.music.volume, duck: job.music.duck },
    )
    const args = [
      '-y',
      '-loglevel',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      picture,
      ...clips.flatMap((c) => ['-i', join(dir, c)]),
    ]
    if (job.music) args.push('-stream_loop', '-1', '-i', join(dir, job.music.path))
    if (graph.filter) args.push('-filter_complex', graph.filter, '-map', '0:v', '-map', '[aout]')
    else
      args.push(
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-map',
        '0:v',
        '-map',
        `${clips.length + 1}:a`,
      )
    args.push(
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      String(total),
      join(dir, `${name}.mp4`),
    )
    await run('ffmpeg', args)
    await run('rm', ['-f', picture])

    await writeFile(join(dir, `${name}.srt`), toSrt(job.project, job.timeline))
    progress({ phase: 'done', frame: frames, frames })
    return { mp4: `${name}.mp4`, srt: `${name}.srt` }
  },
}
