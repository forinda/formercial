# Making a commercial

A commercial is a list of scenes. Each scene has a picture, a caption and a spoken line, and lasts as long as it needs to.

## The editor

- **Preview:** the picture, with the format switch.
- **Timeline, along the bottom:** each scene as a clip as long as it runs, with a bar under it showing how much the voice fills. Click a clip to jump to it, and drag it to reorder. Beside the play button, add a scene (**Scene** for blocks, **Custom scene** for code), or move, duplicate or delete the selected one.
- **Panel on the right:** five tabs.
  - **Scene:** the selected scene's caption, timing, transition and blocks. Drag a block by its handle to reorder it, or focus the handle and use the arrow keys.
  - **Voice:** the spoken line, generating it, and recording it.
  - **Project:** name, formats, colors, fonts, captions, logo, music.
  - **Render:** render drivers, renders in progress, and finished videos.
  - **History:** every change so far. See [History](./history).

Drag the lines between the panes to resize them, or hide the panel and the timeline with the buttons above the picture. The sun and moon button in the top bar switches between system, light and dark themes. The theme is only for the app: it doesn't change your video.

Changes save on their own a moment after you stop typing. The status in the top bar says **Saved**, **Saving…** or **Changed on disk**.

## A scene

| Field | What it's for |
|---|---|
| Caption | Text on screen, and in the `.srt` subtitles. Written for reading. |
| Spoken line | What the voice says. Written for the ear: spell out what a voice would misread ("KickJS D-B" for `@forinda/kickjs-db`), and use `...` for a pause. Leave it empty for a silent scene. |
| At least (s) | The shortest the scene may be. |
| Transition in | How the last scene gives way to this one: see below. |
| Lasting | How long the transition takes, in seconds. It's part of this scene's time. |

A scene lasts the **longest** of:

- its minimum;
- the time its blocks take to finish appearing, plus a second to read;
- its voice clip, plus 1.3 seconds.

So a line is never cut off, and typed code always finishes before the scene ends.

## Blocks

Blocks stack from top to bottom. Each has an **Appears at** time in seconds into the scene, so you can bring them in one after another. Code and terminal blocks type themselves at **Characters / s**.

| Block | Use it for |
|---|---|
| eyebrow | A small label above the headline |
| headline | The main line; **Accent words** are drawn in the accent color |
| text | A sentence or two |
| code | Code that types itself, highlighted for TypeScript, JavaScript, Python, SQL or JSON |
| terminal | Commands: lines starting `$ ` get a prompt, `✗` fails, `✓` succeeds |
| tree | A file tree; end a folder with `/` |
| stamp | A big rotated word (**good** or **bad**), with an optional **Gone at** |
| cards | Two or three side-by-side facts: `Title \| detail` per line |
| chips | A row of pills, with an optional label |
| end | The closing card: wordmark, tagline, command and address |

The [Blocks reference](../reference/blocks) lists every field.

A scene with more than fits is zoomed down to fit, never below 55%. If a scene looks small, split it in two.

## Formats

Pick the shapes to render under **Project → Formats to render**. The same scenes re-flow for each one: type is larger on 9:16 and 1:1, and cards stack on 9:16. Check each shape in the preview before rendering.

## Look and sound

Under **Project**:

- **Colors:** eight theme colors used by every block.
- **Fonts:** display, body and mono. Type a Google Fonts family and press **Download** to keep its files in the project, so renders look the same everywhere.
- **Captions:** draws each caption in a band at the bottom while its line plays. Scenes keep clear of that band.
- **Logo** and **Background music:** uploaded into `media/`. Music plays under the whole spot and dips while someone speaks. **Level while someone speaks** sets how far.

## Next

- [Voice](./voice): generate or record each line.
- [Custom scenes](./custom-scenes): when blocks aren't enough.
- [Rendering](./rendering): getting the MP4s out.

## Transitions

| Transition | What it does |
|---|---|
| **fade** | The new scene fades in. |
| **cut** | The new scene appears at once. |
| **slide** | The new scene fades in, sliding a little. |
| **wipe** | The new scene sweeps across the old one. |
| **zoom** | The old scene pushes toward you as the new one arrives. |
| **iris** | The new scene opens from the center. |
| **flip** | The picture turns over like a card. |
| **blinds** | Strips open across the screen. |
| **break** | The old scene cracks down the middle, and the halves pull apart. |
| **shatter** | The old scene breaks like glass. |
| **crumble** | The old scene falls away in pieces, from the bottom up. |

In **break**, **shatter** and **crumble**, the old scene is cut away to show the new one. The picture stays where it is inside each piece, which keeps them fast to render, and the pieces' edges are drawn so they show even when two scenes share a background. On the very first scene there's nothing to break from, so those and **flip** just show it. The `showcase` preset has a scene for each.

