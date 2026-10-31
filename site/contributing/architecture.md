# Architecture

Formercial is a KickJS app (Express runtime, Inertia + React pages) plus a kick CLI plugin. Most of the logic sits in framework-free modules that the server and the CLI share.

```
 Browser                          KickJS server                 Disk
┌──────────────────────┐   JSON  ┌──────────────────────┐      ┌───────────┐
│ Editor (src/client)  │ ──────▶ │ API + pages          │      │ projects/ │
│   └ Player (src/     │ ◀────── │ (src/modules)        │      └───────────┘
│        player)       │   SSE   │   └ Core (src/core) ─┼─ Storage ─▲
└──────────────────────┘         └─────────┬────────────┘           │
                                           │ render job             │
 kick formercial (src/cli) ── Core ────────┤                        │
                                           ▼                        │
                         Render driver: Chromium opens the render   │
                         page (same Player) + ffmpeg ─ MP4, SRT ────┘
```

## The pieces

| Folder | What it does |
|---|---|
| `src/core/project/` | The `project.json` schema (zod), which everything loads through with `parseProject`, and each scene's start and length. |
| `src/core/storage/` | Projects over `@forinda/kickjs-storage` (`workspace`), temp folders for tools that need real paths (`workdir`), undo history, and which projects may run custom scenes (`trust`). |
| `src/core/assets/` | Fonts and icons downloaded into a project. |
| `src/core/media/` | ffprobe, the ffmpeg sound mix (voice placed per scene, music ducked under it) and subtitles. |
| `src/core/voice/` | Voice providers (edge-tts built in) and `voiceProject`, which makes missing or changed clips. |
| `src/core/render/` | Render drivers, the Chromium + ffmpeg driver, the DevTools-protocol client, `renderProject`. |
| `src/player/` | Draws a project at any time `t`. Used by the editor's preview and by the render page. |
| `src/modules/projects/controllers/` | The JSON API and MCP tools, grouped by task. A controller only routes to a use case. |
| `src/modules/projects/use-cases/` | One class per task, with `execute()`. Returns plain values and throws `HttpException`. |
| `src/modules/projects/services/` | What use cases share: the render queue, live events, the folder watcher and undo state. The workspace and trust are injected by token (`tokens.ts`). |
| `src/modules/projects/http/` | Helpers that know about requests, including turning core's errors into HTTP answers. |
| `src/adapters/studio.ts` | Starts and stops the projects folder watch and the render queue, and shows the queue in DevTools. |
| `src/modules/pages/` | Inertia pages: projects, editor, render page. |
| `src/client/` | React: the editor, its panels, and the save session. |
| `src/cli/plugin.ts` | `kick formercial`, registered in `kick.config.ts`. |
| `src/middleware/local-only.ts` | Answers only this machine; refuses cross-site writes. |

## The player is the contract

Everything you see comes from `createPlayer(host, project, timeline, format).frame(t)`:

- Each scene renders into its own shadow root.
- Blocks build their DOM once and return `draw(local)`, which sets text, opacity and transforms from the scene's local time.
- Hidden scenes are drawn too, at their nearest moment, so the page at `t` doesn't depend on what played before.
- A busy scene is zoomed down once to fit, measured with real fonts at the scene's end state.

So the same `t` always gives the same frame. The preview plays `t` against the clock, and the render steps it one frame at a time.

## How a render runs

1. `renderProject` makes any missing voice clips, resolves the timeline, and copies the clips and music into a work folder.
2. The driver opens the render page (`/p/<project>/render/<16x9|9x16|1x1>`) in headless Chromium at the format's size. It waits for `window.formercial.ready` (fonts loaded), then for each frame calls `window.formercial.frame(t)`, checks `window.formercial.errors()` and takes a JPEG screenshot.
3. The screenshots go to ffmpeg as they're taken. A second ffmpeg pass places each clip at its scene's start, mixes in the music, and writes the MP4.
4. The MP4 and `.srt` go back into the project's `renders/`.

A custom driver gets the same job (timeline, render URL, music, work folder), so every driver cuts the same way.

## Saving and outside edits

The editor keeps a `ProjectSession`. It saves 600ms after the last edit, sending the version it started from. The server refuses a save made against an older version (409). When `project.json` changes on disk, the file watcher tells open editors over SSE: a clean editor reloads, and one with unsaved edits shows "Changed on disk". The editor waits for its own save to land before judging a change, so its own echo is never a conflict.

## Agents

`McpAdapter` turns the routes marked `@McpTool` into MCP tools. A tool call is a request to that route, through the same middleware as the editor, so there's no second implementation. Tool calls arrive through an in-process server on `127.0.0.1` that doesn't serve page assets, so `renderOrigin` takes the render page's port from `Host`, or the configured port over stdio.

## Trust

Custom scenes are code from the project. The player runs them only with `trusted: true`, and the server decides that per project from a hash of the custom code. A save from the editor (marked `x-formercial-editor`) keeps trust. A change from anywhere else, including an MCP tool, needs trusting again. The render page reports any scene still locked, and the render fails instead of showing a placeholder.
