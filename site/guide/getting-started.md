# Getting started

Formercial runs on your own machine: a small web app for editing, and a command line for scripting and rendering. There are no accounts and no cloud services to set up.

## What you need

| Tool | Why | Install |
|---|---|---|
| Node 22+ and pnpm | Runs the app | [nodejs.org](https://nodejs.org), then `npm i -g pnpm` |
| ffmpeg and ffprobe | Encodes the video, reads clip lengths | `apt install ffmpeg`, `brew install ffmpeg`, or [ffmpeg.org](https://ffmpeg.org) |
| Chromium | Draws each frame of a render | `npx playwright install chromium-headless-shell`, or set [`CHROME`](../reference/configuration#environment-variables) |
| edge-tts (optional) | Generated voice | `pipx install edge-tts` |

Without edge-tts you can still record your own voice in the editor. Generated voice sends the spoken lines to Microsoft's speech service.

## Run it

```bash
git clone https://github.com/forinda/formercial.git
cd formercial
pnpm install
pnpm dev
```

Open the address it prints (`http://localhost:3000` by default). Then check what can render on this machine:

```bash
pnpm kick formercial drivers
```

```
chromium-ffmpeg      ready
```

If something's missing, the line says what to install.

## Open the example

The repository includes `projects/kickjs-db`, a two-minute spot. Open it from the projects page, press **Play**, then switch the preview between **16:9**, **9:16** and **1:1**.

To render it from the command line:

```bash
pnpm kick formercial render kickjs-db --format 16:9 --seconds 10
```

That renders the first 10 seconds to `projects/kickjs-db/renders/`. Leave out `--seconds` for the whole spot, and use `--format all` for all three shapes.

## Make your own

Start blank, or from one of the 30-second presets:

| Preset | What it shows |
|---|---|
| `typescript-intro` | Types on variables, a mistake `tsc` catches before the code runs, an interface |
| `javascript-basics` | `const` and `let`, `console.log` and its output, what happens when you change a `const` |
| `python-basics` | Hello world, then a dictionary: create, read, add and loop over it |

```bash
pnpm kick formercial new "My Product"
pnpm kick formercial new "Learn TypeScript" --preset typescript-intro
```

Or use **New commercial** on the projects page, with **Start from** set to a preset. Each preset is five 6-second scenes, ready to render as-is. Change the text, code and colors to make it yours, then press **Download** next to each font under **Project** so renders look the same everywhere.

Then read [Making a commercial](./making-a-commercial).
