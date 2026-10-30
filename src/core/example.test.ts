import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseProject } from './project'

test('example project parses and covers every block type', () => {
  const project = parseProject(JSON.parse(readFileSync('projects/kickjs-db/project.json', 'utf8')))
  const used = new Set(
    project.scenes.flatMap((s) => (s.kind === 'blocks' ? s.blocks.map((b) => b.type) : [])),
  )
  expect([...used].sort()).toEqual([
    'cards',
    'chips',
    'code',
    'end',
    'eyebrow',
    'headline',
    'stamp',
    'terminal',
    'text',
    'tree',
  ])
  expect(project.formats).toEqual(['16:9', '9:16', '1:1'])
  // Named in full on screen; "kick/db" alone can be misread.
  expect(JSON.stringify(project.scenes.map((s) => s.caption))).not.toMatch(/kick\/db/)
  expect(project.scenes.some((s) => s.caption.includes('@forinda/kickjs-db'))).toBe(true)
})
