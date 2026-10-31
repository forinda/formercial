// The ffmpeg filter graph for the soundtrack. Input 0 is the picture, inputs
// 1..n are the scene clips in `inputs` order, and the music (if any) is at
// `music.input`. The graph ends in [aout].
import type { Timeline } from '@/core/project/timeline'

export function audioGraph(
  timeline: Timeline,
  music?: { input: number; volume: number; duck: number },
): { filter: string; inputs: string[] } {
  const voiced = timeline.scenes.filter((s) => s.clip)
  const inputs = voiced.map((s) => s.clip!.path)
  const parts = voiced.map(
    (s, i) => `[${i + 1}:a]adelay=${Math.round(s.start * 1000)}:all=1[v${i}]`,
  )
  const voice = voiced.length
    ? `${voiced.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voiced.length}:normalize=0`
    : ''

  if (!music) {
    if (!voice) return { filter: '', inputs }
    return { filter: `${[...parts, `${voice}[aout]`].join(';')}`, inputs }
  }
  const bed = `[${music.input}:a]volume=${music.volume}`
  if (!voice) return { filter: `${bed}[aout]`, inputs }
  // While the voice is louder than the threshold, the music is pressed down by
  // about `duck` (ratio ≈ 1/duck); it comes back over `release` ms.
  const ratio = Math.min(20, Math.max(1, 1 / Math.max(music.duck, 0.05))).toFixed(2)
  return {
    filter: [
      ...parts,
      `${voice}[vo]`,
      `[vo]asplit=2[vmix][vkey]`,
      `${bed}[bed]`,
      `[bed][vkey]sidechaincompress=threshold=0.03:ratio=${ratio}:attack=20:release=300[ducked]`,
      `[vmix][ducked]amix=inputs=2:normalize=0:duration=longest[aout]`,
    ].join(';'),
    inputs,
  }
}
