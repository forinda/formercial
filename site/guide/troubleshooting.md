# Troubleshooting

## `chromium-ffmpeg … missing: …`

`pnpm kick formercial drivers` names what's missing:

- **ffmpeg / ffprobe:** install ffmpeg; it includes both.
- **chromium:** run `npx playwright install chromium-headless-shell`, or set `CHROME=/path/to/chrome`.

## "edge-tts can't run here"

Install it with `pipx install edge-tts` (or `uv tool install edge-tts`), and check that `edge-tts --help` works in the same terminal. Until then you can record lines in the editor, and renders use the clips you already have.

## "history is off"

SQLite couldn't start, usually because `better-sqlite3` didn't build during install. Run `pnpm rebuild better-sqlite3` and read its error: it needs a C++ compiler if there's no prebuilt binary for your machine. Until then your projects still save, but undo and [history](./history) aren't available.

## A render fails with "chromium didn't answer … within 30s"

The render page stopped responding. This usually means:

- **The machine is very busy.** Renders run at low priority, so heavy work or a full swap can starve them. Close other heavy work and try again.
- **The page reloaded mid-render.** That happens when you edit files while rendering from your own `pnpm dev` server. Renders started with `kick formercial render` turn hot reload off.

## A render fails with "scene …: …"

A custom scene threw an error, or isn't trusted. The message names the scene. Open it in the editor: the preview shows the same error inside the scene.

## Captions show twice

Your video player is showing a same-named `.srt` on top of the captions in the picture. New renders with captions on keep the `.srt` in `renders/srt/` so this doesn't happen. For an older render, delete the `.srt` beside the MP4, or turn subtitles off in the player.

## "Changed on disk"

`project.json` changed outside the editor (a script, `git pull`, another editor) while you had unsaved edits.

- **Reload from disk** drops your edits.
- **Keep mine** saves your version over the file.

## Custom scenes show "isn't run until you trust this project"

The project's custom scene code isn't trusted on this machine. Read the scripts, then press **Trust and run them**. See [Trust](./custom-scenes#trust).

## Code runs off the edge, or a scene looks small

- Code and terminal blocks shrink their text to fit the longest line.
- Scenes with too much content zoom down, to no smaller than 55%.

If a scene looks cramped, split it into two scenes, or shorten its longest line. Check every format in the preview: 9:16 is the narrowest.

## The app says "this app only answers requests from itself, on this machine"

The app accepts only requests from this machine, addressed as `localhost` or `127.x`, and refuses writes that other websites start. Open it at `http://localhost:<port>`, not by your machine's network name.
