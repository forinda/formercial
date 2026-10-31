# Rendering

A render makes an MP4 and an `.srt` subtitle file for each format, under the project's `renders/` folder.

## From the editor

Press **Render** at the top of the editor:

1. Pick a **Driver**. Each one shows **ready**, or what it needs installed.
   Set **Frame rate** to 15 for a quick draft.
2. Press **Render**. It renders every format checked under **Project → Formats to render**.
3. Progress shows as it goes. Finished videos appear underneath, ready to play.

Renders run one at a time. More wait their turn as **queued**.

Stopping or restarting the server stops any render in progress and fails the ones waiting, so start them again afterwards. Under `pnpm dev`, a hot reload from saving or pulling a file in `src/` counts as a restart.

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

Rendering takes roughly 2–3 times the length of the spot at 30 fps. Use `--fps 24` or `--seconds 10` for quick checks. Chromium and ffmpeg run at low priority, so other work on the machine goes first. With an NVIDIA GPU, the `chromium-nvenc` [driver](../reference/drivers) uses about half the CPU.

## Output

```
projects/my-product/renders/
  16x9-20261030-134300.mp4
  9x16-20261030-135512.mp4
  srt/
    16x9-20261030-134300.srt
    9x16-20261030-135512.srt
```

- **Video:** H.264, from x264 or, with `chromium-nvenc`, an NVIDIA GPU.
- **Audio:** AAC at 192 kbps.
- **Captions:** when on, they're drawn into the picture. The `.srt` then goes in `renders/srt/`, ready to upload. It isn't beside the video because players like VLC and mpv load a same-named `.srt` automatically, which would show the captions twice.
- **Subtitles without burned-in captions:** with captions off, the `.srt` sits beside the MP4, so players do load it. Each cue runs while its line is spoken.

Git ignores renders, and everything else in the default `projects/` folder except the example project. To keep your commercials in version control, point [`FORMERCIAL_PROJECTS`](../reference/configuration) at a folder in your own repository.
