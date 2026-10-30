# Making a commercial

A commercial is a list of scenes. Each scene has a picture, a caption and a spoken line, and lasts as long as it needs to.

## The editor

- **Left:** the scene list. Add a scene (**+ Scene** for blocks, **+ Custom** for code), and duplicate, delete or reorder the selected one.
- **Middle:** three tabs.
  - **Scene:** the selected scene's texts, timing, transition, blocks and voice.
  - **Project:** name, formats, colors, fonts, captions, logo, music.
  - **Render:** render drivers, renders in progress, and finished videos.
- **Right:** the live preview, with the format switch, play and seek, and the timeline. Click a scene in the timeline to jump to it.

Changes save on their own a moment after you stop typing. The status in the top bar says **Saved**, **Saving…** or **Changed on disk**.

## A scene

| Field | What it's for |
|---|---|
| Caption | Text on screen, and in the `.srt` subtitles. Written for reading. |
| Spoken line | What the voice says. Written for the ear: spell out what a voice would misread ("KickJS D-B" for `@forinda/kickjs-db`), and use `...` for a pause. Leave it empty for a silent scene. |
| At least (s) | The shortest the scene may be. |
| Transition in | **fade**, **slide** or **cut** into this scene. |

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
| code | Code that types itself, highlighted for TypeScript, SQL or JSON |
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
