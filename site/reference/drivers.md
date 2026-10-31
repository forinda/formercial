# Render drivers and voice providers

How a render runs, and where a generated voice comes from, are both pluggable. Formercial ships with:

- `chromium-ffmpeg`: headless Chromium draws the frames, and ffmpeg encodes them with x264.
- `chromium-nvenc`: the same, with an NVIDIA GPU drawing the frames and encoding them.
- `edge-tts`: Microsoft's neural voices.

Add your own in `src/formercial.config.ts`.

## Render drivers

### chromium-nvenc

Uses about half the CPU of `chromium-ffmpeg`, so the machine stays usable, but renders only a little faster, because frames are still captured one at a time. Files are about a third larger, at similar quality.

It needs an NVIDIA GPU, its driver, and an ffmpeg built with `h264_nvenc`. `pnpm kick formercial drivers` tries encoding a frame to find out. It's tested on Linux. If Chromium can't use the GPU, it draws in software, and the video still comes out right.

Choose it per render with `--driver chromium-nvenc`, or as your default with `FORMERCIAL_DRIVER=chromium-nvenc`.

### Adding another GPU

Each driver appears in the editor's **Driver** list and in `pnpm kick formercial drivers`, as ready or with what it needs. So a machine shows what it can use, and the rest say what's missing.

To add other hardware, use `chromiumDriver` in `src/formercial.config.ts`. You give it ffmpeg's encoding arguments and, optionally, a `needs` check. This one encodes with VA-API, for AMD and Intel on Linux:

```ts
import { run } from './core/media'
import { chromiumDriver } from './core/render/chromium-ffmpeg'
import { defineConfig } from './core/render/registry'

// The AMD or Intel render device: on a machine with two GPUs, it may be renderD129.
const device = ['-vaapi_device', '/dev/dri/renderD128']
const upload = ['-vf', 'format=nv12,hwupload']

export default defineConfig({
  drivers: [
    chromiumDriver({
      name: 'chromium-vaapi',
      video: [...device, ...upload, '-c:v', 'h264_vaapi', '-qp', '20'],
      needs: () =>
        run('ffmpeg', [
          '-loglevel', 'error',
          ...device,
          '-f', 'lavfi', '-i', 'color=black:s=256x256',
          '-frames:v', '1',
          ...upload, '-c:v', 'h264_vaapi',
          '-f', 'null', '-',
        ]).then(
          () => [],
          () => ['VA-API (a GPU and driver, and ffmpeg built with h264_vaapi)'],
        ),
    }),
  ],
})
```

Test by encoding a frame, as here: ffmpeg lists encoders the machine can't run. Pass `chrome: { args, env }` too if Chromium needs flags to use the GPU for drawing.

### Writing a driver

```ts
interface RenderDriver {
  name: string
  check(): Promise<{ ok: boolean; missing: string[] }>
  render(job: RenderJob, dir: string, progress: (p: RenderProgress) => void, signal?: AbortSignal): Promise<{ mp4: string; srt: string }>
}
```

#### check()

Says whether the driver can run on this machine, and if not, what to install or set. The editor and `kick formercial drivers` show the result, and a render with a driver that isn't ready is refused before it starts.

#### render(job, dir, progress, signal)

`dir` is a work folder. The job's voice clips and music are already in it, at their project paths (`voice/s1.tts.mp3`, `media/music.mp3`). Write the MP4 and SRT under `dir`, and return their paths relative to it, like `renders/16x9-….mp4`. When `job.project.captions` is on, keep the SRT away from the MP4 (the built-in driver uses `renders/srt/`), or players that auto-load it will show the captions twice. They're copied back into the project and the folder is removed.

`job` holds:

| Field | |
|---|---|
| `slug`, `project` | The project being rendered |
| `format` | `'16:9'`, `'9:16'` or `'1:1'` |
| `fps`, `seconds` | Frames per second; render only the first `seconds` if set |
| `timeline` | Every scene's `start`, `length` and voice `clip` (`path`, `seconds`), plus `total`. Use it as given, so every driver cuts the same way. |
| `renderUrl` | The page that draws this project at this format |
| `music` | `{ path, volume, duck }` if the project has music |

Report progress with `progress({ phase: 'frames' | 'audio' | 'done', frame, frames })`.

`signal` is aborted when the server is stopping. Check it as you go and stop your processes: a driver that ignores it keeps running after the job has been dropped, and holds up the shutdown.

#### The render page

`renderUrl` shows only the player, filling the window. Open it at the format's size (1920×1080, 1080×1920 or 1080×1080), and it sets up `window.formercial`:

| | |
|---|---|
| `ready` | A promise that resolves once fonts are loaded. Wait for it before the first frame. |
| `frame(t)` | Draws the frame at `t` seconds. The same `t` always draws the same frame. |
| `errors()` | `{ sceneId: message }` for scenes that threw or aren't trusted. If it's not empty, fail the render. |

That's all a driver needs to capture frames its own way, whether through a different browser, a GPU capture, or a remote machine.

#### Example

```ts
import type { RenderDriver } from './core/render/driver'

export const farm: RenderDriver = {
  name: 'farm',
  async check() {
    return process.env.FARM_URL ? { ok: true, missing: [] } : { ok: false, missing: ['FARM_URL'] }
  },
  async render(job, dir, progress) {
    // Send job.timeline, job.format and the clips in `dir` to the farm,
    // download the result into dir/renders/, then:
    return { mp4: 'renders/farm.mp4', srt: 'renders/farm.srt' }
  },
}
```

## Voice providers

```ts
interface VoiceProvider {
  name: string
  check(): Promise<{ ok: boolean; missing: string[] }>
  speak(text: string, opts: { voice: string; rate: string }, outFile: string): Promise<void>
}
```

`speak` writes an audio file ffmpeg can read to `outFile`. `opts` comes from the project's `voice` settings. Pass the text to your tool as an argument, never through a shell.

::: warning Not selectable yet
You can register a voice provider, but the editor and `kick formercial voice` always use `edge-tts`. Choosing a provider per project is on the way. Until then, a provider in `src/formercial.config.ts` is only reachable from your own code.
:::
