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
| `lang`   | `"ts"`   | `"ts"`, `"js"`, `"py"`, `"c"`, `"java"`, `"sql"`, `"json"` or `"plain"`, for highlighting. |
| `label`  | none     | A small title, like a file name.                                          |
| `cps`    | `34`     | Characters typed per second.                                              |

The text shrinks to fit the longest line. Ligatures are off, so `=>` reads as written.

## editor

Code that types itself in a VS Code style window, with line numbers, the current line marked and a status bar. Code longer than the window scrolls as it's typed.

| Field    | Default      |                                                                                  |
| -------- | ------------ | -------------------------------------------------------------------------------- |
| `source` | required     | Newlines and indentation are kept.                                               |
| `file`   | `"untitled"` | The name on the tab.                                                             |
| `lang`   | `"py"`       | `"ts"`, `"js"`, `"py"`, `"c"`, `"java"`, `"sql"`, `"json"` or `"plain"`, for highlighting. |
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

## revise

Code changing a step at a time, as in a refactoring: each step gives the whole file, and what changed since the step before is marked. A card beside it says what the step does and why.

```json
{
  "type": "revise",
  "file": "Fee.java",
  "lang": "java",
  "chapters": ["Problem", "Refactor"],
  "steps": [
    {
      "source": "double f = t.hours() * 3.0;\nif (t.minutes() <= 15) f = 0;",
      "chapter": 0,
      "card": { "tag": "Before", "title": "The grace period hides at the bottom" },
      "ring": { "line": 2, "text": "t.minutes() <= 15" }
    },
    {
      "source": "if (t.minutes() <= 15) return 0;\ndouble f = t.hours() * 3.0;",
      "chapter": 1,
      "card": { "tag": "Guard Clause", "title": "Check it first", "text": "Short stays leave at once." }
    }
  ]
}
```

| Field      | Default      |                                                                              |
| ---------- | ------------ | ---------------------------------------------------------------------------- |
| `steps`    | required     | The file at each step, in order, from one to 200                             |
| `file`     | `"untitled"` | The name on the tab, beside the file's line count                            |
| `lang`     | `"ts"`       | As for [run](#run)                                                           |
| `rows`     | `18`         | Lines in view, so the panel keeps its size as the code grows or shrinks      |
| `chapters` | `[]`         | Up to eight names along the bottom, each filling as its steps run            |

A step:

| Field             |                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------- |
| `source`          | The whole file at this step. Lines that are new or changed get a red bar and a tint      |
| `chapter`         | Which of `chapters`, from 0. Default: the step before's                                 |
| `card`            | `{ "tag"?, "title", "text"? }`, with the step's number. Default: the last card stays     |
| `ring`            | `{ "line", "text" }`: a hand-drawn loop around that text on that line, from 1            |
| `at`, `seconds`   | When it starts, and how long the change takes. Default: when the last ends, and `0.8`   |

The old version fades out as the new one fades in, and the view scrolls to the ringed line, or else the first changed one. In 9:16 the card sits under the code.

## run

Code running a line at a time, with the call stack, what it prints and any named boxes following along, for showing what a program does rather than telling it. Good for recursion, loops, and queues like an event loop.

```json
{
  "type": "run",
  "file": "fact.c",
  "lang": "c",
  "source": "int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
  "steps": [
    { "line": 1, "push": "fact", "vars": { "n": 3 } },
    { "line": 3, "ring": "fact(n - 1)", "note": "each call gets its own n" },
    { "line": 2, "pop": true, "print": "6", "focus": ["code", "output"] }
  ]
}
```

| Field    | Default                 |                                                                                  |
| -------- | ----------------------- | -------------------------------------------------------------------------------- |
| `source` | required                | The code, shown whole from the start                                             |
| `file`   | `"untitled"`            | The name on the tab                                                              |
| `files`  | `[]`                    | Up to five more tabs, `{ "name", "source" }`, after the first. Steps switch with `file` |
| `lang`   | `"c"`                   | `ts`, `js`, `py`, `c`, `java`, `sql`, `json` or `plain`, for highlighting        |
| `rows`   | `14`                    | Lines in view; the current line is scrolled into view                            |
| `panels` | `["stack", "output"]`   | What shows beside the code                                                       |
| `boxes`  | `[]`                    | Up to six named places, `{ "id", "label" }`, like a task queue or the heap       |
| `values` | none                    | A row of values beside the code, moved by the steps' `array` moves, for sorting and searching |
| `steps`  | `[]`                    | What happens, in order                                                           |

Each step can do several things, applied in this order:

| Field          |                                                                                     |
| -------------- | ----------------------------------------------------------------------------------- |
| `file`         | Switch to the tab with this name; later steps stay on it, and it opens at its top   |
| `line`         | The line running now, from 1, in the tab shown                                      |
| `pop`          | `true` takes the top frame off the stack; it fades out during the step              |
| `push`, `vars` | A new frame on top, with its variables                                              |
| `set`          | Changes variables in the top frame, as `{ "name": value }`. They light up for the step |
| `print`        | A line the program prints                                                           |
| `add`          | `{ "box", "item" }`: an item goes into a box                                        |
| `take`         | `{ "box", "item"? }`: that item leaves the box, or the oldest one with no `item`    |
| `focus`        | Only these stay bright: `"code"`, `"stack"`, `"output"`, `"array"` (with `values`) or a box id. `[]` clears it |
| `array`        | `{ "do", "a", "b"? }`: a move on `values`, any of the [array](#array) block's moves |
| `ring`         | A hand-drawn loop around this text on the current line                              |
| `note`         | A short line under the code from this step on                                       |
| `at`, `seconds`| When it starts, and how long it takes. Default: when the last ends, and `0.6`        |

With `values`, a step's `array` move runs over the step's own time, so the line, the variables and the row move together.

The stack shows its top four frames and counts the rest. In 9:16 the code sits on top and the panels below it. Everything is worked out from the time alone, so any frame can be drawn first.

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
| `reflow`  | With no `tall` drawing, lay the wide one out again for 9:16, stacking its parts. Default `true`. See [Vertical videos](../guide/doodles#vertical-videos). |
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
| `group`       | Optional: a name. Lines and labels with the same name stay together when the drawing is laid out for 9:16. |
| `flow`        | Optional: dots moving along the path, as `{ "count", "speed", "tone", "size", "at" }`. `speed` is in `viewBox` units a second, and negative runs backwards. They start when the line is drawn, unless `at` says otherwise. |

A label:

| Field                   |                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| `text`, `x`, `y`        | The words, and where their left end sits. Labels don't wrap: split long ones. |
| `size`                  | Default `56`                                                                  |
| `tone`, `seconds`, `at` | As for a line                                                                 |
| `group`                 | As for a line |
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
