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

Start blank, or from a preset. Presets are full commercials that use every block and transition, so you can keep what suits you and delete the rest:

| Preset | What it shows |
|---|---|
| `showcase` | Everything: every block, every code language, stamps that come and go, a silent scene, a scene with no caption, and a custom scene. Each caption says what the scene shows. |
| `doodle-light-bulb` | A hand-drawn lesson on current and resistance, and why a bulb glows. See [Doodle videos](./doodles). |
| `typescript-intro` | Types on variables, a mistake `tsc` catches and its fix, an interface, what to learn next |
| `javascript-basics` | `const` and `let`, `console.log` and its output, changing a `const` and fixing it |
| `python-basics` | Hello world, then a dictionary: create, read, add and loop over it, and handle a missing key |

```bash
pnpm kick formercial new "My Product"
pnpm kick formercial new "Learn TypeScript" --preset typescript-intro
```

Or use **New commercial** on the projects page, with **Start from** set to a preset. The language and doodle presets are ready to render as-is. `showcase` has a custom scene, so [trust](./custom-scenes#trust) it first or delete that scene. Change the text, code and colors to make it yours, then press **Download** next to each font under **Project** so renders look the same everywhere.

Then read [Making a commercial](./making-a-commercial).
