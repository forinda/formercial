# Doodle videos

A doodle is a drawing that draws itself, with a pen following each line. It suits short lessons: start from the template, then change the drawings and words.

```bash
pnpm kick formercial new "How a bulb works" --preset doodle-light-bulb
```

Or choose **Doodle lesson: why a light bulb glows** on the projects page. It's a complete lesson on one idea, following the [lesson pattern](./teaching-videos). Reword its scenes to make it yours.

Creating it downloads its fonts into the project, as with every preset. See [Make your own](./getting-started#make-your-own).

## Draw your own

Add a **doodle** block to a scene, then press **Open drawing board**.

- **Draw** with the pen, or drag out a line, arrow, rectangle or ellipse. A tablet or touch screen works too.
- **Add a label:** choose the label tool, click where it goes, type and press Enter.
- **Place a part:** pick one from the left, like a server, database or battery, then click to place it. **Size** scales it first.
- **Import an SVG** from Figma or Inkscape. Its shapes are added as lines. Shapes inside a group with a transform are left out, and the board says how many, so flatten transforms when you export.
- **Move something:** choose **Select and move**, then drag it.
- **Change the order:** the list on the right is the order things get drawn. Drag a row to change it.
- **Fine-tune:** click a row to set how long it takes, when it starts, its fill, or dots that move along it, which is useful for showing current, data or requests.
- **Watch** plays the drawing as it will look in the video.

Everything saves as you go, like any other edit. **Undo** on the board steps back through your drawing.

You can still edit the strokes directly, under **Edit as JSON**, or have an [agent](./agents) write them. The [block reference](../reference/blocks#doodle) lists every option.

## Vertical videos

Wide art looks tiny in a tall frame. So in 9:16, a doodle without a tall drawing lays itself out again: it finds the parts that belong together, stacks them top to bottom in reading order, and makes each as wide as the frame allows. Every line and label keeps its place in the drawing order and its timing, so the voice still lines up.

Parts are found by distance: lines and labels drawn close together count as one part. When that splits something you meant to keep together, or joins two things you meant to keep apart, name the parts with `group`:

```json
{ "text": "input", "x": 100, "y": 300, "group": "before" },
{ "d": "M100 320 H400", "group": "before" },
{ "text": "output", "x": 1100, "y": 300, "group": "after" }
```

Items with the same `group` stay together however far apart they are. A long row, like five boxes side by side, stays one part unless you name its pieces, and a part that wide shrinks to fit. Set `"reflow": false` on the block to shrink the whole wide drawing instead, as before.

For full control, give the block a `tall` drawing, which replaces the wide one in 9:16:

```json
{
  "type": "doodle",
  "strokes": [ ],
  "tall": { "viewBox": "0 0 900 1400", "strokes": [ ] }
}
```

On the drawing board, switch to **Tall (9:16)** to draw it. **Start from the wide drawing** gives you a scaled copy to rearrange. Every format shares one timeline, so keep both drawings about the same length: the slower one sets it. In 9:16, captions sit higher and larger, clear of the buttons those apps put over the bottom of the video.

`kick formercial check` lists labels too small to read in each format, and `render` lists them before it starts. See [Command line](./command-line#check).

## Tips

- **One idea per scene.** It's easy to cut or reorder scenes that each make one point.
- **Time it to the voice.** Generate the voice first, then set `at` on a stroke so it appears as the word is spoken.
- **Keep the same artwork moving.** The template's scenes use short `seconds` to redraw the last scene's picture quickly, then draw only what's new.
- **Planning a lesson?** [Making teaching videos](./teaching-videos) covers how to structure one so that it sticks.
