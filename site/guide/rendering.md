# Rendering

A render makes an MP4 and an `.srt` subtitle file for each format, in the project's `renders/` folder.

## From the editor

Open the **Render** tab:

1. Pick a **Driver**. Each one shows **ready**, or what it needs installed.
2. Press **Render**. It renders every format checked under **Project → Formats to render**.
3. Progress shows as it goes. Finished videos appear underneath, ready to play.

Renders run one at a time. More wait their turn as **queued**.

## From the command line

```bash
pnpm kick formercial render my-product --format all
```

See [Command line](./command-line) for every option.

## What happens

1. Missing or changed voice lines are generated (when edge-tts is installed).
2. Each scene's start and length are worked out from its blocks and voice.
3. Headless Chromium opens the render page at the format's size and steps through every frame, taking a screenshot of each.
4. ffmpeg encodes the frames, places each voice clip at its scene's start, and mixes in the music.

Rendering takes roughly 2–3 times the length of the spot at 30 fps. Use `--fps 24` or `--seconds 10` for quick checks.

## Output

```
projects/my-product/renders/
  16x9-20261030-134300.mp4
  16x9-20261030-134300.srt
  9x16-20261030-135512.mp4
  ...
```

- **Video:** H.264.
- **Audio:** AAC at 192 kbps.
- **Subtitles:** each `.srt` cue runs while its line is spoken.
- **Captions:** with captions on, they're also drawn into the picture.

Git ignores renders.
