# project.json

Everything about a commercial lives in its folder's `project.json`. The editor writes it, and you can write it by hand or from a script. It's checked every time it loads, and an error names the field that's wrong. The schema is `ProjectSchema` in `src/core/project.ts`.

## Example

```json
{
  "version": 1,
  "name": "@forinda/kickjs-db",
  "formats": ["16:9", "9:16", "1:1"],
  "theme": {
    "colors": {
      "bg": "#0d2226", "panel": "#13313a", "line": "#24505a", "fg": "#efe9da",
      "muted": "#9db4b3", "accent": "#f2c14e", "good": "#7fd1b9", "bad": "#e3735e"
    },
    "fonts": { "display": "Unbounded", "body": "IBM Plex Sans", "mono": "JetBrains Mono" }
  },
  "voice": { "tts": "en-US-AvaNeural", "rate": "-4%" },
  "captions": true,
  "scenes": [
    {
      "id": "one-schema",
      "kind": "blocks",
      "minSeconds": 8,
      "transition": "slide",
      "caption": "@forinda/kickjs-db puts it in one place.",
      "spoken": "KickJS D-B puts it in one place.",
      "blocks": [
        { "type": "headline", "text": "One schema. In TypeScript.", "accent": "In TypeScript." },
        { "type": "code", "at": 1.2, "lang": "ts", "label": "schema.ts", "source": "const users = table('users', {})" }
      ]
    }
  ]
}
```

## Top level

| Field | Type | Default | |
|---|---|---|---|
| `version` | `1` | required | The format version. |
| `name` | string | required | Shown in the editor and page titles. |
| `formats` | array of `"16:9"`, `"9:16"`, `"1:1"` | required, at least one | What **Render** and `--format all` make. |
| `theme` | object | required | [Theme](#theme) |
| `voice` | `{ tts, rate }` | required | Generated voice: an edge-tts voice name and rate, like `"-4%"`. |
| `music` | `{ file, volume, duck }` | none | [Music](#music) |
| `captions` | boolean | `true` | Draw captions into the picture. |
| `scenes` | array | required, at least one | [Scenes](#scenes), in order. Ids must be unique. |

## Theme

| Field | |
|---|---|
| `colors.bg`, `panel`, `line`, `fg`, `muted`, `accent`, `good`, `bad` | Hex colors (`#f2c14e`, `#fff`). They're written into CSS, so other forms are refused. |
| `fonts.display`, `body`, `mono` | Font family names: letters, digits and spaces. |
| `fonts.files` | Font files kept in the project, written when you press **Download**: `[{ "family", "weight", "path" }]`, with `path` under `media/fonts/`. |
| `logo` | Optional path under `media/`. |

A font family without files in the project falls back to what's installed on the machine.

## Music

| Field | Default | |
|---|---|---|
| `file` | required | Path in the project, like `media/music.mp3`. Loops under the whole spot. |
| `volume` | `0.25` | 0–1 |
| `duck` | `0.35` | 0–1: roughly how loud the music stays while someone speaks. |

## Scenes

Every scene has:

| Field | Type | Default | |
|---|---|---|---|
| `id` | string | required | Letters, digits, `-` and `_`, starting with a letter or digit. Used in file names. |
| `kind` | `"blocks"` or `"custom"` | required | |
| `caption` | string | required | On screen and in the `.srt`. |
| `spoken` | string | the caption | What the voice says. Whitespace only makes a silent scene. |
| `minSeconds` | number | `4` | The shortest the scene may be. |
| `transition` | `"fade"`, `"cut"`, `"slide"`, `"wipe"`, `"zoom"`, `"iris"`, `"flip"`, `"blinds"`, `"break"`, `"shatter"` or `"crumble"` | `"fade"` | Into this scene. |
| `transitionSeconds` | number, up to 5 | a length that suits the kind | How long the transition takes. It's part of this scene's time. |
| `voice` | `"tts"` or `"recording"` | `"tts"` | `"recording"` uses `voice/<id>.rec.webm` when it exists. |

A `blocks` scene adds `blocks`: an array of [blocks](./blocks).

A `custom` scene adds `html`, `css` (both default `""`) and `script`, which must export `draw(t, ctx)`. See [Custom scenes](../guide/custom-scenes).

## Scene length

A scene lasts the longest of `minSeconds`, the time its blocks need plus one second, and its voice clip plus 1.3 seconds. The result is rounded up to a tenth of a second.
