// The built-in render drivers: Chromium draws each frame of the render page,
// ffmpeg encodes them and lays the voice and music under the picture.
// chromium-nvenc does the drawing and encoding on an NVIDIA GPU.
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { audioGraph } from '@/core/media/audio'
import { hasCommand, run } from '@/core/media/media'
import { FORMATS } from '@/core/project/project'
import { toSrt } from '@/core/media/srt'
import { findChrome, launchChrome } from './cdp'
import type { RenderDriver } from './driver'
import { startEncoder } from './encoder'

const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')

export type ChromiumDriverSetup = {
  name: string
  /** ffmpeg's video encoding arguments. */
  video: string[]
  chrome?: Parameters<typeof launchChrome>[0]
  /** What else the driver needs, beyond ffmpeg and Chromium. */
  needs?: () => Promise<string[]>
}

export const chromiumDriver = ({
  name: driverName,
  video,
  chrome,
  needs,
}: ChromiumDriverSetup): RenderDriver => ({
  name: driverName,

  async check() {
    const missing: string[] = []
    if (!(await hasCommand('ffmpeg'))) missing.push('ffmpeg')
    if (!(await hasCommand('ffprobe'))) missing.push('ffprobe')
    if (!findChrome())
      missing.push('chromium (set CHROME, or npx playwright install chromium-headless-shell)')
    if (needs && missing.length === 0) missing.push(...(await needs()))
    return { ok: missing.length === 0, missing }
  },

  async render(job, dir, progress) {
    const [width, height] = FORMATS[job.format]
    const total = Math.min(job.timeline.total, job.seconds ?? Infinity)
    const frames = Math.round(total * job.fps)
    const name = `renders/${job.format.replace(':', 'x')}-${stamp()}`
    await mkdir(join(dir, 'renders'), { recursive: true })
    const picture = join(dir, `${name}.picture.mp4`)

    const page = await launchChrome(chrome)
    const encoder = startEncoder('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(job.fps),
      '-i',
      '-',
      ...video,
      picture,
    ])

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
        if (window.formercial) return window.formercial.ready.then(ok, fail)
        if (Date.now() - s > 30000) return fail(new Error('render page never set window.formercial'))
        setTimeout(poll, 50) })() })`)

      for (let f = 0; f < frames; f++) {
        await evaluate(`window.formercial.frame(${f / job.fps})`)
        {
          const errors = await evaluate<Record<string, string>>('window.formercial.errors()')
          const [id, message] = Object.entries(errors)[0] ?? []
          if (id) throw new Error(`scene ${id}: ${message}`)
        }
        const { data } = await page.send<{ data: string }>('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 92,
        })
        await encoder.write(Buffer.from(data, 'base64'))
        if (f % job.fps === 0) progress({ phase: 'frames', frame: f, frames })
      }
      await encoder.end()
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

    // Players auto-load a same-named .srt beside the video. With captions in the
    // picture that would show them twice, so the file goes where they don't look.
    const srt = job.project.captions ? `renders/srt/${basename(name)}.srt` : `${name}.srt`
    await mkdir(dirname(join(dir, srt)), { recursive: true })
    await writeFile(join(dir, srt), toSrt(job.project, job.timeline))
    progress({ phase: 'done', frame: frames, frames })
    return { mp4: `${name}.mp4`, srt }
  },
})

export const chromiumFfmpeg = chromiumDriver({
  name: 'chromium-ffmpeg',
  video: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18'],
})

export const chromiumNvenc = chromiumDriver({
  name: 'chromium-nvenc',
  video: [
    '-c:v',
    'h264_nvenc',
    '-preset',
    'p5',
    '-tune',
    'hq',
    '-rc',
    'vbr',
    '-cq',
    '19',
    '-b:v',
    '0',
    '-pix_fmt',
    'yuv420p',
  ],
  chrome: {
    args: [
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--use-gl=angle',
      '--use-angle=gl-egl',
    ],
    // On a laptop with two GPUs, Chromium would otherwise pick the other one.
    env: { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia' },
  },
  // ffmpeg lists h264_nvenc whether or not a GPU can run it, so encode a frame.
  needs: () =>
    run('ffmpeg', [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=black:s=256x256',
      '-frames:v',
      '1',
      '-c:v',
      'h264_nvenc',
      '-f',
      'null',
      '-',
    ]).then(
      () => [],
      () => ['NVENC (an NVIDIA GPU and driver, and ffmpeg built with h264_nvenc)'],
    ),
})
