# Doodle videos

A doodle is a drawing that draws itself, with a pen following each line. It suits short lessons: start from the template, then change the drawings and words.

```bash
pnpm kick formercial new "How a bulb works" --preset doodle-light-bulb
```

Or choose **Doodle lesson: how a light bulb works** on the projects page. It's a complete lesson of about two minutes on current, resistance and why a filament glows. Delete scenes or reword them to make it yours.

Creating it downloads two handwriting fonts from Google Fonts into the project. If that fails, the project is still made, and you can press **Download** under **Project → Fonts** later.

## Draw your own

Add a **doodle** block to a scene and edit its strokes:

```json
[
  { "d": "M250 400 H1350", "seconds": 1.5 },
  { "text": "a wire", "x": 650, "y": 340, "size": 80, "tone": "accent" },
  {
    "d": "M250 400 H1350",
    "width": 0,
    "seconds": 0,
    "flow": { "count": 8, "speed": 200, "tone": "good" }
  }
]
```

Each item starts when the one before it ends, so a drawing tells its story in order. The [block reference](../reference/blocks#doodle) lists every option.

A line's `d` is an ordinary SVG path, so you can export one from Figma or Inkscape, or ask an [agent](./agents) to write the strokes and add them to your project.

## Vertical videos

Wide art looks tiny in a tall frame, and it can't rearrange itself. For TikTok, Reels and Shorts, give the block a `tall` drawing, which replaces the wide one in 9:16:

```json
{
  "type": "doodle",
  "strokes": [ ],
  "tall": { "viewBox": "0 0 900 1400", "strokes": [ ] }
}
```

Every format shares one timeline, so keep both drawings about the same length: the slower one sets it. In 9:16, captions sit higher and larger, clear of the buttons those apps put over the bottom of the video.

## Tips

- **One idea per scene.** It's easy to cut or reorder scenes that each make one point.
- **Time it to the voice.** Generate the voice first, then set `at` on a stroke so it appears as the word is spoken.
- **Keep the same artwork moving.** The template's scenes use short `seconds` to redraw the last scene's picture quickly, then draw only what's new.
