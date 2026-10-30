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

```bash
pnpm kick formercial new "My Product"
```

Or use **New commercial** on the projects page. Then read [Making a commercial](./making-a-commercial).
