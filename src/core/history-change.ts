// What changed between two versions of a project, in words. The same two
// projects always give the same answer: history shows this beside each step.
import type { Project } from './project'

export type Change = {
  text: string
  /** Steps with the same key are one edit in progress, and may merge. Empty never merges. */
  key: string
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const PROJECT_FIELDS: [keyof Project, string][] = [
  ['name', 'name'],
  ['formats', 'formats'],
  ['theme', 'theme'],
  ['captions', 'captions'],
  ['voice', 'voice'],
  ['music', 'music'],
]

export function describeChange(before: Project | null, after: Project): Change {
  if (!before) return { text: 'Created', key: '' }
  const was = new Map(before.scenes.map((s) => [s.id, s]))
  const now = new Set(after.scenes.map((s) => s.id))
  const number = (id: string) => after.scenes.findIndex((s) => s.id === id) + 1
  const parts: string[] = []
  const keys: string[] = []

  for (const [i, s] of before.scenes.entries()) {
    if (!now.has(s.id)) parts.push(`Deleted scene ${i + 1}`)
  }
  for (const s of after.scenes) {
    if (!was.has(s.id)) parts.push(`Added scene ${number(s.id)}`)
  }
  const kept = before.scenes.filter((s) => now.has(s.id)).map((s) => s.id)
  const keptNow = after.scenes.filter((s) => was.has(s.id)).map((s) => s.id)
  if (!same(kept, keptNow)) parts.push('Reordered scenes')
  for (const s of after.scenes) {
    const old = was.get(s.id)
    if (old && !same(old, s)) {
      parts.push(`Edited scene ${number(s.id)}`)
      keys.push(`scene:${s.id}`)
    }
  }
  for (const [field, name] of PROJECT_FIELDS) {
    if (!same(before[field], after[field])) {
      parts.push(`Changed ${name}`)
      keys.push(`project:${field}`)
    }
  }
  if (!parts.length) return { text: 'Formatting only', key: '' }
  // Only one thing being edited merges: anything structural is its own step.
  return { text: parts.join(', '), key: parts.length === 1 ? (keys[0] ?? '') : '' }
}
