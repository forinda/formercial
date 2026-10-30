// Voiceover: one clip per line of lines.txt (vo/1.mp3, vo/2.mp3, …), spoken by a
// Microsoft neural voice through the edge-tts CLI. A clip is made again only when
// its line, voice or rate changed.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const DEFAULT_VOICE = 'en-US-AvaNeural'

export function voice(dir, { voice = DEFAULT_VOICE, rate = '-4%' } = {}) {
  const lines = readFileSync(join(dir, 'lines.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  const vo = join(dir, 'vo')
  mkdirSync(vo, { recursive: true })
  const stampFile = join(vo, '.made.json')
  const made = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : {}

  lines.forEach((line, i) => {
    const clip = join(vo, `${i + 1}.mp3`)
    const stamp = `${voice}|${rate}|${line}`
    if (existsSync(clip) && made[i + 1] === stamp) return
    const run = spawnSync('edge-tts', ['--voice', voice, `--rate=${rate}`, '--text', line, '--write-media', clip], { stdio: 'inherit' })
    if (run.error?.code === 'ENOENT') {
      throw new Error('edge-tts is not installed: pipx install edge-tts (or: uv tool install edge-tts)')
    }
    if (run.status !== 0) throw new Error(`edge-tts failed on line ${i + 1}`)
    made[i + 1] = stamp
    writeFileSync(stampFile, JSON.stringify(made, null, 2))
    console.log(`voice ${i + 1}/${lines.length}`)
  })
  return lines.length
}
