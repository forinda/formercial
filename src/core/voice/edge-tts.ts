// Microsoft's neural voices through the edge-tts CLI. The spoken text is sent
// to Microsoft's speech service.
import { hasCommand, run } from '@/core/media/media'
import type { VoiceProvider } from './provider'

export const edgeTts: VoiceProvider = {
  name: 'edge-tts',
  async check() {
    const ok = await hasCommand('edge-tts', ['--help'])
    return { ok, missing: ok ? [] : ['edge-tts (pipx install edge-tts)'] }
  },
  async speak(text, { voice, rate }, outFile) {
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
  },
}
