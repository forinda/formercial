# Configuration

Formercial is configured in three places:

- **Environment variables** (or `.env`): where things are, and how the app runs.
- **`src/formercial.config.ts`:** extra render drivers and voice providers.
- **Each project's `project.json`:** everything about one commercial. See [project.json](./project-json).

## Environment variables

Put them in `.env` at the repository root (copy `.env.example`), or set them in your shell. A bad value stops startup, and the error names the variable.

### Formercial

| Variable | Default | |
|---|---|---|
| `FORMERCIAL_PROJECTS` | `projects` | The projects folder, relative to the repository or absolute. |
| `FORMERCIAL_TRUST_FILE` | `~/.config/formercial/trust.json` | Where [trust](../guide/custom-scenes#trust) for custom scenes is kept. Keep it outside the projects folder. |
| `FORMERCIAL_VOICE` | `en-US-AvaNeural` | Voice for new projects. Each project then keeps its own in `project.json`. |
| `FORMERCIAL_FPS` | `30` | Render frame rate unless a render asks for another: a whole number from 1 to 60. |
| `XDG_CONFIG_HOME` | `~/.config` | Moves the default trust file to `$XDG_CONFIG_HOME/formercial/trust.json`. |
| `CHROME` | the newest Playwright headless shell | The Chromium (or Chrome) binary renders use. |
| `FORMERCIAL_RENDER` | unset | Set by `kick formercial render` on the server it starts: turns hot reload off. You don't normally set it yourself. |

### The app

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | Port for `pnpm dev` and `pnpm start`. |
| `NODE_ENV` | `development` | `development`, `production` or `test`. |
| `LOG_LEVEL` | `info` | Server log level. |
| `SESSION_SECRET` | a public dev-only value | Required (32+ characters) when `NODE_ENV` isn't `development` or `test`. |
| `APP_URL` | `http://localhost:3000` | Required when `NODE_ENV` isn't `development` or `test`. |

Formercial is a local tool. Run it with `pnpm dev`. If you build it (`pnpm build`, `pnpm start`), set `SESSION_SECRET` and `APP_URL`, and still keep it on your own machine: see [Security](../contributing/security).

### Keeping projects in a bucket (experimental)

Projects are read and written through [`@forinda/kickjs-storage`](https://kickjs.app/guide/file-storage). Setting `S3_BUCKET` moves them into an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO):

| Variable | |
|---|---|
| `S3_BUCKET` | Bucket name. Setting it switches storage to the bucket. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials (or neither, for an IAM role). |
| `S3_REGION` | Default `us-east-1`; `auto` for R2. |
| `S3_ENDPOINT` | For R2 or MinIO; unset for AWS. |
| `S3_SESSION_TOKEN`, `S3_FORCE_PATH_STYLE` | As your provider needs. |

With a bucket, the editor doesn't notice outside changes to `project.json`, and the command line still reads projects from a folder. Local folders are the supported setup.

## src/formercial.config.ts

Adds render drivers and voice providers next to the built-in ones (`chromium-ffmpeg` and `edge-tts`). The editor and the command line both read it.

```ts
import { defineConfig } from './core/render/registry'
import { gpuDriver } from './drivers/gpu'

export default defineConfig({
  drivers: [gpuDriver],
  voices: [],
})
```

Names must be unique, and a duplicate stops startup. See [Render drivers and voice providers](./drivers) for how to write one.

## kick.config.ts

The `kick formercial` commands are registered here as a kick CLI plugin:

```ts
plugins: [formercialCliPlugin(formercialConfig)],
```

Add your own commands with another plugin. See [Command line → Your own commands](../guide/command-line#your-own-commands).

## Files and folders

| Path | In git | |
|---|---|---|
| `projects/<name>/project.json` | yes | The commercial |
| `projects/<name>/media/` | yes | Logo, music, fonts |
| `projects/<name>/voice/*.rec.webm` | yes | Your recordings |
| `projects/<name>/voice/*.tts.mp3`, `voice/.made.json` | no | Generated lines; remade when needed |
| `projects/<name>/renders/` | no | Rendered MP4s and `.srt` files |
| `~/.config/formercial/trust.json` | (outside the repo) | Which projects' custom scenes may run here |
