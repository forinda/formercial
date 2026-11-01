# 3D scenes

A `stage3d` block is a 3D scene written as data: things to place, and a timeline of what they do. There are no model files to find and no code to trust, so it's easy to reword, and easy for an [agent](./agents) to write. It suits explainers, stories and stylised product shots.

Add a **Stage3d** block to a scene. It fills the whole picture, and any other blocks in the scene sit on top of it.

## A first scene

Someone walks across the street, then dances:

```json
{
  "type": "stage3d",
  "world": { "light": "day", "background": "#9cc488", "floor": "#93c07a" },
  "camera": { "view": "isometric", "target": [0, 1, 0], "size": 14 },
  "actors": [
    { "kind": "road", "id": "road", "position": [0, 0, 3] },
    { "kind": "tree", "id": "tree", "position": [5, 0, -3] },
    { "kind": "person", "id": "amina", "position": [-6, 0, 3], "scale": 1.3 }
  ],
  "timeline": [
    { "at": 0, "actor": "amina", "seconds": 4, "ease": "linear", "move": [1, 0, -1] },
    { "at": 4, "actor": "amina", "clip": "dance" }
  ]
}
```

Everything happens on the timeline, and each entry says when, to what, and what changes. A person walks to wherever you `move` them, faces the way they're going, and stands when they arrive.

The scene lasts until its last entry ends, or longer if its voice line is longer. To hold a pose or a dance, give the camera or an actor an entry that ends later.

## Actors

| Kind | What it is | Its own fields |
|---|---|---|
| `box`, `cylinder`, `cone`, `sphere`, `disc` | Plain shapes | `size` or `radius` and `height`, plus a surface |
| `lathe` | A shape spun around its axis: bottles, cans, vases | `profile`, optional `label`, plus a surface |
| `person` | A person with real bones | `shirt`, `trousers`, `skin`, `hair` |
| `car` | A car whose wheels turn and door opens | `color` |
| `building` | A building with columns and a door. Its origin is on the ground at the door | `label`, `color`, `roof` |
| `road`, `tree`, `lamp` | Scenery | `road` has `length` and `width` |
| `model` | A `.glb` file in the project's `media/` folder | `path` |

A surface is `color`, `rough`, `metal`, `coat` for a glossy top coat, and `glow`. Every actor also has an `id`, `position`, `rotate` in degrees, `scale` and `hidden`.

Heights use `y`, so `[x, y, z]` with `y` going up. A `box` or `cylinder` is centered on its position.

### A product

A `lathe` spins a list of `[radius, height]` points into a shape. Its `label` wraps around it, and it's drawn with the project's fonts:

```json
{
  "kind": "lathe",
  "id": "bottle",
  "color": "#4a1d07",
  "rough": 0.07,
  "coat": 1,
  "profile": [[0, 0], [0.92, 0], [1, 0.1], [1, 2.5], [0.56, 3.55], [0.4, 3.85], [0.4, 4.4], [0, 4.4]],
  "label": { "text": "SAMPLE", "sub": "A line about it", "y": 1.45, "height": 1.6 }
}
```

Use `"light": "studio"` for product shots. It's what gives glossy surfaces something to reflect.

For a product people need to recognise, use a real model file. A shape from a list of points shows the idea, not the exact product.

## Timeline

| Field | What it does |
|---|---|
| `at` | When it starts, in seconds |
| `actor` | An actor's `id`, or `camera` |
| `seconds` | How long it takes. Leave it out for an instant change |
| `ease` | `linear`, `in`, `out` or `inout` |
| `move` | Go to this position |
| `rotate`, `scale` | Turn to this many degrees, or grow to this size |
| `open` | A building's or car's door: `0` is shut, `1` is open |
| `show` | `true` or `false` |
| `clip` | Play an animation |
| `speed` | Clip speed: `0.5` is half speed |
| `face` | `false` keeps a moving actor facing the way it was |
| `target`, `size`, `fov` | For the camera: what it looks at, and how much fits |

A person's clips are `walk`, `stand` and `dance`. A walk's speed matches the move, so the feet keep pace with the ground. A clip with `seconds` stops when they're up, and one without keeps playing. A model's clips are whatever its file holds, and if you ask for one it doesn't have, the error lists the ones it does.

## Camera

| Field | Default | What it does |
|---|---|---|
| `view` | `isometric` | `isometric` keeps lines parallel, for that clean, nearly 2D look. `perspective` is like a real lens |
| `position`, `target` | `[21, 21, 25]`, `[0, 1, 0]` | Where it is, and what it looks at |
| `size` | `15` | Isometric: how many world units tall the 16:9 picture is. Smaller is closer |
| `fov` | `30` | Perspective: the lens angle at 16:9 |
| `tallZoom` | `1` | How much closer to get in 9:16 |

Other shapes keep the width of the 16:9 picture, so nothing is cut off the sides of a tall frame. That leaves subjects small, so set `tallZoom` to about `2` for TikTok, Reels and Shorts, then check that what matters is still in the picture.

## World

| Field | Default | What it does |
|---|---|---|
| `light` | `day` | `day`, `night` or `studio` |
| `background` | `#9cc488` | The color behind everything |
| `gradient` | | `[top, bottom]` colors, in place of the background |
| `floor` | | A floor color; leave it out for no floor |
| `exposure` | `1` | Overall brightness |
| `shadowReach` | `24` | How far from the target shadows reach. Keep it near the size of your scene, for sharper shadows |

## Real models

Upload a `.glb` to `media/`, and use it as a `model` actor. Models with their own animations can play them with `clip`.

Check a model's licence before you publish. Some, like Mixamo's, can be used in your videos, but community answers say the raw files can't be shared, so don't commit them to a public repository.

## Good to know

- **It's plain data.** A `stage3d` block runs no project code, so unlike a [custom scene](./custom-scenes) there's nothing to trust.
- **Renders need WebGL.** That's normally your GPU. A render fails with a message if it can't start, or if a model can't load.
- **Every frame comes from the time alone,** so the same moment always draws the same picture, in preview and in the render.
- **The look is stylised.** For photoreal shots, render in a tool like Blender. Formercial doesn't have a video block yet to bring that footage in.
