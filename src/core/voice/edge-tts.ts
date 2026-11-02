// Microsoft's neural voices through edge-tts. The spoken text is sent to
// Microsoft's speech service.
import { constants } from 'node:fs'
import { access, open } from 'node:fs/promises'
import { delimiter, join } from 'node:path'
import { hasCommand, run } from '@/core/media/media'
import type { Word } from '@/core/project/timeline'
import type { VoiceProvider } from './provider'

// The CLI can't report word timings, so this asks edge-tts's own Python for them.
// Arguments come in through argv, never pasted into the code.
const SPEAK = `
import asyncio, json, sys, edge_tts
text, voice, rate, out = sys.argv[1:5]
async def main():
    words = []
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(out, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                start = ch["offset"] / 1e7
                words.append({"text": ch["text"], "start": start, "end": start + ch["duration"] / 1e7})
    print(json.dumps(words))
asyncio.run(main())
`

/** The Python edge-tts runs under, from its launcher's first line, as pipx and pip install it. */
async function edgePython(): Promise<string | null> {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const launcher = join(dir, 'edge-tts')
    try {
      await access(launcher, constants.X_OK)
      const file = await open(launcher)
      const { bytesRead, buffer } = await file.read(Buffer.alloc(300), 0, 300, 0)
      await file.close()
      const first = buffer.subarray(0, bytesRead).toString().split('\n')[0]
      const python = /^#!\s*(\S*python[\d.]*)\s*$/.exec(first)?.[1]
      return python ?? null
    } catch {
      continue
    }
  }
  return null
}

/** Word timings from the script's output, or none if it isn't what was expected. */
export function parseWords(out: string): Word[] | undefined {
  try {
    const list: unknown = JSON.parse(out.trim().split('\n').at(-1) ?? '')
    if (!Array.isArray(list)) return undefined
    const words = list.filter(
      (w): w is Word =>
        typeof w?.text === 'string' && Number.isFinite(w?.start) && Number.isFinite(w?.end),
    )
    return words.length ? words : undefined
  } catch {
    return undefined
  }
}

export const edgeTts: VoiceProvider = {
  name: 'edge-tts',
  async check() {
    const ok = await hasCommand('edge-tts', ['--help'])
    return { ok, missing: ok ? [] : ['edge-tts (pipx install edge-tts)'] }
  },
  async speak(text, { voice, rate }, outFile) {
    const python = await edgePython()
    if (python) {
      try {
        return { words: parseWords(await run(python, ['-c', SPEAK, text, voice, rate, outFile])) }
      } catch {
        // An older edge-tts without word timings: the CLI still makes the audio.
      }
    }
    // Arguments, never a shell: the line can hold quotes or anything else.
    await run('edge-tts', [
      '--voice',
      voice,
      `--rate=${rate}`,
      '--text',
      text,
      '--write-media',
      outFile,
    ])
    return {}
  },
}
