# Blocks

Every block has a `type` and an optional `at`: the number of seconds into the scene when it appears (default `0`). Each block fades and lifts in over 0.4 seconds from `at`.

Blocks stack top to bottom in the order listed. Sizes follow the format, so a block looks right in all three shapes.

## eyebrow

A small uppercase label, in the accent color.

| Field | |
|---|---|
| `text` | |

## headline

The scene's main line.

| Field | |
|---|---|
| `text` | |
| `accent` | Optional: the last occurrence of this text in `text` is drawn in the accent color. |

## text

A sentence or two, in the muted color.

| Field | |
|---|---|
| `text` | |

## code

Code that types itself.

| Field | Default | |
|---|---|---|
| `source` | required | Newlines and indentation are kept. |
| `lang` | `"ts"` | `"ts"`, `"js"`, `"py"`, `"sql"`, `"json"` or `"plain"`, for highlighting. |
| `label` | none | A small title, like a file name. |
| `cps` | `34` | Characters typed per second. |

The text shrinks to fit the longest line. Ligatures are off, so `=>` reads as written.

## terminal

Commands that type themselves.

| Field | Default | |
|---|---|---|
| `source` | required | One line per line. A line starting `$ ` gets a colored prompt, `✗` is drawn as a failure and `✓` as a success. |
| `label` | none | |
| `cps` | `34` | |

## tree

A file tree; each line appears half a second after the last.

| Field | |
|---|---|
| `lines` | Array of lines. A line ending in `/` is drawn as a folder. Use `├ ` and `└ ` for branches. |

## stamp

A large rotated word.

| Field | |
|---|---|
| `text` | |
| `tone` | `"good"` or `"bad"` |
| `until` | Optional: the number of seconds into the scene when it disappears. |

## cards

Side-by-side facts; one column on 9:16.

| Field | |
|---|---|
| `items` | Array of `{ "title", "sub" }`; `sub` is optional. |

## chips

A row of pills.

| Field | |
|---|---|
| `items` | Array of strings |
| `label` | Optional text before the pills |

## end

The closing card.

| Field | |
|---|---|
| `wordmark` | The product name, large. Slashes are drawn in the accent color. |
| `tagline` | Optional |
| `command` | Optional: shown as `$ <command>` |
| `url` | Optional |

## How long blocks take

| Block | Needs |
|---|---|
| code, terminal | `at` + characters ÷ `cps` |
| tree | `at` + 0.5s per line + 0.4s |
| cards, chips | `at` + 0.3s per item + 0.4s |
| end | `at` + 2.8s |
| others | `at` + 0.4s |

The scene gets at least the slowest block's time plus one second.
