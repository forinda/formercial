# Custom scenes

When blocks aren't enough, a scene can be your own HTML, CSS and a script that draws it frame by frame. Press **+ Custom** in the scene list.

## draw(t, ctx)

The script exports `draw`, which is called for every frame:

```js
export function draw(t, ctx) {
  const title = ctx.root.getElementById('title')
  const p = Math.min(1, t / 0.6)
  title.style.opacity = p
  title.style.transform = `translateY(${(1 - p) * 20}px)`
}
```

| | |
|---|---|
| `t` | Seconds into this scene |
| `ctx.root` | The scene's shadow root, holding its HTML and CSS |
| `ctx.theme` | The project's colors and fonts |
| `ctx.format` | `'16:9'`, `'9:16'` or `'1:1'` |
| `ctx.width`, `ctx.height` | The format's size in pixels (1920×1080 and so on) |
| `ctx.length` | How long the scene lasts, in seconds |
| `ctx.scene` | The scene's own fields from `project.json` |

## Rules

- **Draw everything from `t`.** Don't use timers, `requestAnimationFrame`, `Date.now()`, CSS transitions or CSS animations. The render jumps to each frame's `t`, so anything that depends on the clock comes out wrong or flickers.
- **Size things in `var(--u)`**, like `font-size: calc(5 * var(--u))`. `--u` is about 1% of the width on 16:9 and larger on tall and square formats, so one stylesheet works for all three.
- **Use the theme.** Colors are `var(--bg)`, `var(--panel)`, `var(--line)`, `var(--fg)`, `var(--muted)`, `var(--accent)`, `var(--good)` and `var(--bad)`. Fonts are `var(--display)`, `var(--body)` and `var(--mono)`.
- **No `import`.** A scene script runs on its own. Put what it needs in the script, or in its HTML.

If `draw` throws, the preview shows the error inside that scene and keeps playing the others. A render stops and names the scene.

## Trust

A custom scene is code, and projects get shared. So a project's custom scenes don't run until you trust it on your machine:

- A project you didn't write shows its custom scenes as placeholders, with **Trust and run them** at the top of the editor. Read the scripts first.
- Trust is tied to the code. If it changes from outside the editor (a `git pull`, a script), you're asked again. Your own edits in the editor keep it trusted.
- Trust is stored in `~/.config/formercial/trust.json` ([configurable](../reference/configuration#environment-variables)), never in the project, so a shared folder can't trust itself.
- A render refuses scenes that aren't trusted rather than rendering placeholders.
