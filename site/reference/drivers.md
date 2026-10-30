# Render drivers and voice providers

How a render runs, and where a generated voice comes from, are both pluggable. Formercial ships with one of each:

- `chromium-ffmpeg`: headless Chromium draws the frames, and ffmpeg encodes them.
- `edge-tts`: Microsoft's neural voices.

Add your own in `src/formercial.config.ts`.

## Render drivers

```ts
interface RenderDriver {
  name: string
  check(): Promise<{ ok: boolean; missing: string[] }>
  render(job: RenderJob, dir: string, progress: (p: RenderProgress) => void): Promise<{ mp4: string; srt: string }>
}
```

### check()

Says whether the driver can run on this machine, and if not, what to install or set. The editor and `kick formercial drivers` show the result, and a render with a driver that isn't ready is refused before it starts.

### render(job, dir, progress)

`dir` is a work folder. The job's voice clips and music are already in it, at their project paths (`voice/s1.tts.mp3`, `media/music.mp3`). Write the MP4 and SRT under `dir`, and return their paths relative to it, like `renders/16x9-….mp4`. They're copied back into the project and the folder is removed.

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

### The render page

`renderUrl` shows only the player, filling the window. Open it at the format's size (1920×1080, 1080×1920 or 1080×1080), and it sets up `window.formercial`:

| | |
|---|---|
| `ready` | A promise that resolves once fonts are loaded. Wait for it before the first frame. |
| `frame(t)` | Draws the frame at `t` seconds. The same `t` always draws the same frame. |
| `errors()` | `{ sceneId: message }` for scenes that threw or aren't trusted. If it's not empty, fail the render. |

That's all a driver needs to capture frames its own way, whether through a different browser, a GPU capture, or a remote machine.

### Example

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
