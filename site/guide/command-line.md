# Command line

The `kick formercial` commands make, voice and render commercials without opening the editor, which makes them easy to script. Run them from the repository with `pnpm kick formercial …`.

## Commands

### new

```bash
pnpm kick formercial new "My Product"
```

Creates `projects/my-product/project.json` with one starter scene. The folder name comes from the name: lower case, with anything else turned into `-`.

```bash
pnpm kick formercial new "Learn Python" --preset python-basics
```

`--preset` starts from a 30-second preset instead: `typescript-intro`, `javascript-basics` or `python-basics`.

### voice

```bash
pnpm kick formercial voice my-product
```

Generates every missing or changed line with edge-tts. Scenes using a recording are left alone.

### render

```bash
pnpm kick formercial render my-product [options]
```

| Option | Default | |
|---|---|---|
| `--format <f>` | `all` | `16:9`, `9:16`, `1:1`, or `all` (the project's formats) |
| `--driver <name>` | `FORMERCIAL_DRIVER`, or `chromium-ffmpeg` | A [render driver](../reference/drivers) |
| `--fps <n>` | `FORMERCIAL_FPS`, or `30` | Frames per second: a whole number from 1 to 60 |
| `--seconds <n>` | the whole spot | Render only the first N seconds |
| `--origin <url>` | start one | A running app to render from, like `http://127.0.0.1:3000` |

It voices first (when edge-tts is installed), then renders each format. Without `--origin`, it starts the app on a free port with hot reload off, and stops it when done.

A project with custom scenes must be [trusted](./custom-scenes#trust) first: open it with `preview` and trust it in the editor.

### drivers

```bash
pnpm kick formercial drivers
```

Lists every render driver and whether it can run here, or what's missing.

### preview

```bash
pnpm kick formercial preview my-product
```

Starts the app and prints the editor's address for that project. Stop it with Ctrl+C.

### mcp

```bash
pnpm kick formercial mcp
```

Serves the agent tools over stdio, for MCP clients that start the server themselves. See [Agents](./agents).

## Naming a project

`<project>` is either:

- a name under the projects folder (`my-product`), or
- a path to a project folder (`../elsewhere/promo` or `/work/ads/promo`): the folder holding its `project.json`.

The projects folder is `projects/`, or [`FORMERCIAL_PROJECTS`](../reference/configuration#environment-variables).

## Scripting

A project is plain JSON, so a script can write one and render it:

```bash
node make-launch-spot.mjs > projects/launch/project.json
pnpm kick formercial render launch --format 9:16
```

`project.json` is checked on load, and an error names the field that's wrong. See the [project.json reference](../reference/project-json).

## Your own commands

The `kick formercial` commands come from a kick CLI plugin registered in `kick.config.ts`. Add your own next to it:

```ts
// kick.config.ts
import { defineCliPlugin, defineConfig } from '@forinda/kickjs-cli'
import { formercialCliPlugin } from './src/cli/plugin'
import formercialConfig from './src/formercial.config'

const team = defineCliPlugin({
  name: 'team-commands',
  register(program, ctx) {
    program
      .command('weekly-ads')
      .description('Render this week’s spots')
      .action(async () => {
        ctx.log('rendering…')
      })
  },
})

export default defineConfig({
  // …the rest of your config
  plugins: [formercialCliPlugin(formercialConfig), team],
})
```

Then run `pnpm kick weekly-ads`. The [KickJS CLI plugin guide](https://kickjs.app/guide/cli-plugins) covers the full API.
