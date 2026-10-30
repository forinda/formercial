# Formercial

Make short product commercials on your own machine. You put scenes together in an editor, see and hear them play as you edit, and render MP4s in 16:9, 9:16 and 1:1. A project is a folder of plain files, so a script can write one as easily as the editor can.

Built on [KickJS](https://kickjs.app/) (the Inertia + React template) with `@forinda/kickjs-storage` for project files.

[![CI](https://github.com/forinda/formercial/actions/workflows/ci.yml/badge.svg)](https://github.com/forinda/formercial/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

It's early (0.x): `project.json` may still change between releases, and changes will say how to update existing projects.

## Install

You need:

- Node 22+ and pnpm
- ffmpeg and ffprobe
- A Chromium for rendering: `npx playwright install chromium-headless-shell`, or point `CHROME` at one
- For generated voice: [edge-tts](https://github.com/rany2/edge-tts) (`pipx install edge-tts`). Spoken lines are sent to Microsoft's speech service. Without it you can still record your own voice in the editor.

```bash
pnpm install
pnpm dev                # the editor, at the address it prints
pnpm kick formercial drivers   # what can render here, and what's missing
```

## Making a commercial

1. Open the app and create a commercial, or run `pnpm kick formercial new "My Product"`.
2. Add scenes. Each one has a **caption** (on screen) and a **spoken line** (for the voice: spell out what a voice would misread, like "KickJS D-B" for `@forinda/kickjs-db`).
3. Build each scene from blocks (headline, code that types itself, terminal, file tree, cards, chips, stamp, end card), or make it a custom scene with your own HTML, CSS and script.
4. Give each scene a voice: **Generate** it, or **Record** it in the browser and use the recording.
5. Set the theme, fonts, captions and music under **Project**, then render under **Render**.

A scene lasts the longest of its minimum, the time its blocks take to appear, and its voice clip plus 1.3s, so lines are never cut off. A scene with more than fits is zoomed down to fit.

`projects/kickjs-db` is a complete example.

## Project folder

```
projects/<name>/
  project.json            # everything about the commercial
  media/                  # logo, music, fonts (media/fonts/*.woff2)
  voice/<scene>.rec.webm  # your recordings
  voice/<scene>.tts.mp3   # generated lines (git-ignored, remade when a line changes)
  renders/                # MP4 + .srt per render (git-ignored)
```

`project.json` is validated on every load (`src/core/project.ts` has the schema). Edit it by hand or from a script while the editor is open: the editor reloads it, or shows "Changed on disk" if you have unsaved edits.

Projects live in `projects/`; set `FORMERCIAL_PROJECTS` to use another folder.

## Custom scenes

A custom scene's script exports `draw(t, ctx)`, called for every frame:

```js
export function draw(t, ctx) {
  // t: seconds into the scene. ctx: { root, theme, format, width, height, length, scene }
  const title = ctx.root.getElementById('title')
  title.style.opacity = Math.min(1, t / 0.6)
  title.style.transform = `translateY(${(1 - Math.min(1, t / 0.6)) * 20}px)`
}
```

- Draw everything from `t`: no timers, `Date.now()` or CSS transitions. The same `t` must give the same frame, or the render won't match the preview.
- `root` is the scene's shadow root, holding its HTML and CSS. Size things with `calc(N * var(--u))`; `--u` grows on tall and square formats. Theme colors are `var(--bg)`, `var(--accent)` and so on.
- `import` isn't supported inside a scene script.

Custom scenes are code. A project you didn't write shows them as placeholders until you trust it in the editor. Trust is kept in `~/.config/formercial/trust.json`, never in the project, and a change to the scene code asks again.

## Command line

```bash
pnpm kick formercial new "My Product"
pnpm kick formercial voice my-product                 # generate missing or changed lines
pnpm kick formercial render my-product --format all   # 16:9, 9:16, 1:1 → projects/my-product/renders/
pnpm kick formercial render ../elsewhere/promo --format 9:16 --seconds 10 --fps 24
pnpm kick formercial drivers
pnpm kick formercial preview my-product
```

`render` starts the app on a free port for the render page (or uses `--origin http://127.0.0.1:3000` if one is running).

These commands come from a kick CLI plugin (`src/cli/plugin.ts`, registered in `kick.config.ts`). Add your own the same way:

```ts
// kick.config.ts
import { defineCliPlugin } from '@forinda/kickjs-cli'

const mine = defineCliPlugin({
  name: 'my-commands',
  register(program, ctx) {
    program.command('promo-week').action(async () => {
      ctx.log('render every project tagged for this week…')
    })
  },
})

export default defineConfig({ plugins: [formercialCliPlugin(formercialConfig), mine] })
```

## Render drivers and voice providers

A render driver turns a project, a format and a resolved timeline into an MP4 and an `.srt`. The built-in one, `chromium-ffmpeg`, screenshots the render page frame by frame in headless Chromium and encodes with ffmpeg. Add your own (a GPU encoder, a render farm) in `src/formercial.config.ts`:

```ts
import { defineConfig } from './core/render/registry'

export default defineConfig({
  drivers: [
    {
      name: 'farm',
      async check() {
        return process.env.FARM_URL ? { ok: true, missing: [] } : { ok: false, missing: ['FARM_URL'] }
      },
      async render(job, dir, progress) {
        // job.timeline has every scene's start, length and voice clip (files in dir).
        // job.renderUrl is the page that draws job.format; window.formercial.frame(t) steps it.
        // Write the MP4 and SRT under dir and return their paths relative to it.
        return { mp4: 'renders/out.mp4', srt: 'renders/out.srt' }
      },
    },
  ],
  voices: [], // { name, check(), speak(text, { voice, rate }, outFile) }
})
```

The editor and `kick formercial drivers` show each driver as ready or list what it's missing, and you pick one per render.

## Running it safely

The app has no accounts. It answers only requests from this machine, addressed as `localhost` or `127.x`, and refuses writes started by other sites. Don't expose it on a network.

## Development

```bash
pnpm test      # vitest; render tests skip when Chromium or ffmpeg are missing
pnpm build
```

Code lives in `src/core` (project, workspace, voice, timeline, render), `src/player` (draws a scene at any `t`; shared by the preview and the render page), `src/modules` (the API and pages) and `src/client` (the editor).

## Contributing

Contributions are welcome: bug reports, fixes, new blocks, render drivers, voice providers, docs and example projects. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/architecture.md](docs/architecture.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

## License

[Apache License 2.0](LICENSE). Copyright 2026 Felix Orinda and the formercial contributors. If you redistribute it, keep the [NOTICE](NOTICE) file with it.

The example project's fonts (Unbounded, IBM Plex Sans, JetBrains Mono) are under the SIL Open Font License 1.1.

