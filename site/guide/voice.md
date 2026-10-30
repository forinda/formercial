# Voice

Each scene gets one clip: a generated line, or a recording you make in the browser. A scene lasts at least as long as its clip plus a short pause, 1.3 seconds unless you change **Pause after each spoken line** under **Project**. For shorts, try `0.3`, and set each scene's **At least** low too, since a scene never ends before that.

## Generated voice

**Generate this line** or **Generate all lines** (Voice tab), or from the command line:

```bash
pnpm kick formercial voice my-product
```

Generation uses [edge-tts](https://github.com/rany2/edge-tts), which speaks with Microsoft's neural voices. It sends the spoken lines to Microsoft's speech service. Install it with `pipx install edge-tts`.

A clip is made again only when its spoken line, the voice or the rate changes. Generated clips are `voice/<scene>.tts.mp3`, and git ignores them; anyone can remake them.

### Choosing a voice

Set the voice name under **Project → Voice**, or `voice.tts` in [`project.json`](../reference/project-json). The default is `en-US-AvaNeural`. List the others with:

```bash
edge-tts --list-voices
```

Natural-sounding female voices include `en-US-AvaNeural`, `en-US-EmmaNeural` and `en-GB-SoniaNeural`. The rate is `voice.rate` in `project.json`, like `-4%` or `+10%`.

### Writing lines for the ear

The **spoken line** is separate from the caption so you can write it the way it should sound:

| On screen | Spoken line |
|---|---|
| `@forinda/kickjs-db` | KickJS D-B |
| SQLite | S-Q-Lite |
| TypeORM | Type O-R-M |
| The database, the migrations, and the types | The database... the migrations... and the types |

Listen to each line in the voice panel before rendering.

## Recording your own voice

Under **Record it yourself**:

1. **Record**: the browser asks for your microphone the first time.
2. **Stop**, then listen.
3. **Retake** until it's right, then **Use this recording**.

The recording is stored as `voice/<scene>.rec.webm` and used for that scene from then on. To go back, press **Use generated voice**. Recordings are kept in the project (git includes them), up to 50 MB each.

Record in a quiet room, close to the microphone, and leave half a second of silence at each end.
