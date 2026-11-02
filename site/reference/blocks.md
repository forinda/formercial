# Blocks

Every block has a `type` and an optional `at`: the number of seconds into the scene when it appears (default `0`). Each block fades and lifts in over 0.4 seconds from `at`.

Blocks stack top to bottom in the order listed. Sizes follow the format, so a block looks right in all three shapes.

## eyebrow

A small uppercase label, in the accent color.

| Field  |     |
| ------ | --- |
| `text` |     |

## headline

The scene's main line.

| Field    |                                                                                    |
| -------- | ---------------------------------------------------------------------------------- |
| `text`   |                                                                                    |
| `accent` | Optional: the last occurrence of this text in `text` is drawn in the accent color. |

## text

A sentence or two, in the muted color.

| Field  |     |
| ------ | --- |
| `text` |     |

## code

Code that types itself.

| Field    | Default  |                                                                           |
| -------- | -------- | ------------------------------------------------------------------------- |
| `source` | required | Newlines and indentation are kept.                                        |
| `lang`   | `"ts"`   | `"ts"`, `"js"`, `"py"`, `"c"`, `"sql"`, `"json"` or `"plain"`, for highlighting. |
| `label`  | none     | A small title, like a file name.                                          |
| `cps`    | `34`     | Characters typed per second.                                              |

The text shrinks to fit the longest line. Ligatures are off, so `=>` reads as written.

## editor

Code that types itself in a VS Code style window, with line numbers, the current line marked and a status bar. Code longer than the window scrolls as it's typed.

| Field    | Default      |                                                                                  |
| -------- | ------------ | -------------------------------------------------------------------------------- |
| `source` | required     | Newlines and indentation are kept.                                               |
| `file`   | `"untitled"` | The name on the tab.                                                             |
| `lang`   | `"py"`       | `"ts"`, `"js"`, `"py"`, `"c"`, `"sql"`, `"json"` or `"plain"`, for highlighting. |
| `rows`   | `14`         | Lines in view, `3` to `60`.                                                      |
| `cps`    | `34`         | Characters typed per second.                                                     |

The text shrinks to fit the longest line. Ligatures are off, so `>=` reads as written.

## array

A row of values that moves, for showing an algorithm at work. It fills the scene's width, and counts comparisons when there are any.

| Field    | Default  |                                                  |
| -------- | -------- | ------------------------------------------------ |
| `values` | required | Up to 20 numbers or short strings, left to right |
| `steps`  | none     | What happens to them, in order                   |
| `count`  | `true`   | Show how many comparisons have happened so far   |

Each step has `do`, a slot `a` numbered from 0, and for some a slot `b`. Optional: `note`, a line shown under the row from then on; `at`; and `seconds`, default `0.6`.

| `do`      |                                                 |
| --------- | ----------------------------------------------- |
| `compare` | Highlights slot `a`, and `b` if given, and counts one |
| `swap`    | Slots `a` and `b` trade places                  |
| `lift`    | The item in slot `a` rises out of the row       |
| `shift`   | The item in slot `a` slides to the empty slot `b`. Ignored if `b` is taken |
| `drop`    | The lifted item falls into the empty slot `a`. Ignored if `a` is taken |
| `mark`    | Slots `a` to `b` turn green, as finished        |
| `dim`     | Slots `a` to `b` fade, as ruled out             |

Everything is worked out from the time alone, so any frame can be drawn first.

## stack

Function calls piling up and going away, with each frame's variables, for showing what a program holds in memory as it runs.

Each step has `do`: `push` adds a frame (`name`, `vars`), `set` changes a variable (`name`, `value`, and `frame`, counted down from the top), `pop` removes the top frame, and `note` only changes the line under the stack. Any step can also have `note`, `at` and `seconds`, default `0.6`.

## terminal

Commands that type themselves.

| Field    | Default  |                                                                                                                |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `source` | required | One line per line. A line starting `$ ` gets a colored prompt, `✗` is drawn as a failure and `✓` as a success. |
| `label`  | none     |                                                                                                                |
| `cps`    | `34`     |                                                                                                                |

## tree

A file tree; each line appears half a second after the last.

| Field   |                                                                                            |
| ------- | ------------------------------------------------------------------------------------------ |
| `lines` | Array of lines. A line ending in `/` is drawn as a folder. Use `├ ` and `└ ` for branches. |

## stamp

A large rotated word.

| Field   |                                                                    |
| ------- | ------------------------------------------------------------------ |
| `text`  |                                                                    |
| `tone`  | `"good"` or `"bad"`                                                |
| `until` | Optional: the number of seconds into the scene when it disappears. |

## cards

Side-by-side facts; one column on 9:16.

| Field   |                                                   |
| ------- | ------------------------------------------------- |
| `items` | Array of `{ "title", "sub" }`; `sub` is optional. |

## chips

A row of pills.

| Field   |                                |
| ------- | ------------------------------ |
| `items` | Array of strings               |
| `label` | Optional text before the pills |

## icon

A centered row of product or language icons, each with an optional label under it. Find them in the editor, or with the `search_icons` and `add_icon` MCP tools. They're downloaded from [Iconify](https://iconify.design) into `media/icons/`, so a render needs no network, and a missing file fails the render.

| Field   |                                                                                        |
| ------- | -------------------------------------------------------------------------------------- |
| `items` | Array of `{ path, label? }`. `path` is an image under `media/`: SVG, PNG, WebP or JPEG |
| `size`  | Height of each icon, default `8`                                                       |

The icon sets' licences cover the files, not the brands. Check a brand's own rules before using its logo.

## doodle

A whiteboard drawing that draws itself with a pen. It's plain data, so it needs no [trust](../guide/custom-scenes#trust). See [Doodle videos](../guide/doodles).

| Field     |                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `strokes` | What to draw, in order: lines and labels, described below.                                                 |
| `viewBox` | The drawing's coordinates. Default `"0 0 1600 720"`.                                                       |
| `tall`    | Optional: `{ "viewBox", "strokes" }`, a separate drawing for 9:16. `viewBox` defaults to `"0 0 900 1400"`. |
| `pen`     | Show the pen. Default `true`.                                                                              |
| `wobble`  | Hand-drawn wobble on the lines. Default `true`.                                                            |

A line:

| Field         |                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d`           | An SVG path                                                                                                                                                                                                                |
| `tone`        | `"fg"`, `"muted"`, `"accent"`, `"good"` or `"bad"`. Default `"fg"`.                                                                                                                                                        |
| `width`       | Line width. `0` hides the line, which is useful for a fill or moving dots alone. Default `6`.                                                                                                                              |
| `seconds`     | How long it takes to draw. Default `0.8`.                                                                                                                                                                                  |
| `at`          | Seconds into the scene to start. Default: when the one before it ends.                                                                                                                                                     |
| `fill`        | Optional: a tone that fades in inside the shape as it's drawn                                                                                                                                                              |
| `fillOpacity` | How solid that fill ends up, `0` to `1`. Default `1`.                                                                                                                                                                      |
| `flow`        | Optional: dots moving along the path, as `{ "count", "speed", "tone", "size", "at" }`. `speed` is in `viewBox` units a second, and negative runs backwards. They start when the line is drawn, unless `at` says otherwise. |

A label:

| Field                   |                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| `text`, `x`, `y`        | The words, and where their left end sits. Labels don't wrap: split long ones. |
| `size`                  | Default `56`                                                                  |
| `tone`, `seconds`, `at` | As for a line                                                                 |
| `mono`                  | `true` draws it in the theme's mono font with ligatures off, for code and commands learners must read exactly. Default `false`. |

## stage3d

A 3D scene as data: actors, a timeline, a camera and a world. It fills the whole scene, behind any other blocks, and lasts until its last timeline entry ends. See [3D scenes](../guide/3d-scenes).

| Field | Type | Default | |
|---|---|---|---|
| `actors` | array | required | What's in the scene, each with a `kind` and an `id` |
| `timeline` | array | `[]` | What happens: `at`, `actor`, then `move`, `clip`, `open` and so on |
| `camera` | object | isometric | `view`, `position`, `target`, `size`, `fov`, `tallZoom` |
| `world` | object | day | `light`, `background`, `gradient`, `floor`, `exposure`, `shadowReach` |
| `at` | number | `0` | Seconds into the scene that it appears and its timeline starts |

## end

The closing card.

| Field      |                                                                 |
| ---------- | --------------------------------------------------------------- |
| `wordmark` | The product name, large. Slashes are drawn in the accent color. |
| `tagline`  | Optional                                                        |
| `command`  | Optional: shown as `$ <command>`                                |
| `url`      | Optional                                                        |

## How long blocks take

| Block                  | Needs                                               |
| ---------------------- | --------------------------------------------------- |
| code, editor, terminal | `at` + characters ÷ `cps`                           |
| tree                   | `at` + 0.5s per line + 0.4s                         |
| cards, chips, icon     | `at` + 0.3s per item + 0.4s                         |
| end                    | `at` + 2.8s                                         |
| doodle                 | the latest time any item ends, across both drawings |
| others                 | `at` + 0.4s                                         |

The scene gets at least the slowest block's time plus one second.
