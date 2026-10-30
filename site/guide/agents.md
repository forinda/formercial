# Agents (MCP)

Formercial is an [MCP](https://modelcontextprotocol.io/) server, so an agent can start a commercial from a preset, edit it, voice it and render it. Tool calls run through the same checks as the editor.

## Connect

### While the app is running

Start the app with `pnpm dev`, then point your client at its MCP endpoint:

```bash
claude mcp add --transport http formercial http://localhost:3000/_mcp/messages
```

Other clients take the same address. Use whatever port `pnpm dev` printed.

### Let the client start it (stdio)

```bash
claude mcp add formercial -- pnpm --dir /path/to/formercial exec kick formercial mcp
```

Or in a client's JSON config:

```json
{
  "mcpServers": {
    "formercial": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/formercial", "exec", "kick", "formercial", "mcp"]
    }
  }
}
```

This runs the built app, building it first if there's no `dist/`. **Run `pnpm build` again after you update Formercial**, or the client keeps serving the old build.

## Tools

| Tool | What it does |
|---|---|
| `list_presets` | The 30-second commercials a project can start from |
| `list_projects` | Every commercial in the workspace |
| `project_schema` | The JSON Schema of `project.json`, so an agent can write a valid one |
| `create_project` | A new commercial: `name`, and optionally a `preset` |
| `get_project` | Its `project.json`, the `version` to send back, its voice clips, and whether it's `trusted` |
| `update_project` | Replace `project.json`: `project` and `baseVersion` |
| `voice_project` | Generate missing or changed lines. They're sent to Microsoft's speech service. |
| `list_drivers` | Render drivers, and what each one needs |
| `list_history` | The steps a project has been through |
| `restore_revision` | Put a project back to one of those steps; the rest are kept |
| `render_project` | Queue a render: `format` (`16:9`, `9:16`, `1:1` or `all`), optional `driver` and `fps`. Returns job ids at once. |
| `get_renders` | Job progress, finished files, and the `folder` they're in |

A typical run:

1. `list_presets`, then `create_project` with one.
2. `get_project`, change the text and code, then `update_project` with the `version` you read. If someone else changed it first, the update is refused and returns the `current` version: read again and redo the edit.
3. `render_project`, then poll `get_renders` until the job is `done`. Rendering takes about 2–3 times the length of the spot.

## What agents can't do

- **Trust code.** There's no tool for it. If an agent writes a custom scene, `update_project` answers `trusted: false`, and `render_project` is refused until you read the code and press **Trust and run them** in the editor. An agent's edit to a project you already trusted also needs trusting again if it changes custom scene code.
- **Delete anything, or upload files.** Recordings, music, logos and fonts are added in the editor.

The agent can still spend your time and disk: it can queue renders, overwrite `project.json` and send lines to the speech service. Connect agents you'd trust with those.

## Security

The MCP endpoint follows the app's own rules: it answers only this machine, addressed as `localhost` or `127.x`, and refuses other sites. Requests that send no `Origin` header, which is what MCP clients do, aren't browser requests and are let through. There are no accounts, so any program running on your machine can call it.
