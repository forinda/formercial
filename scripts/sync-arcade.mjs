#!/usr/bin/env node
// Copy the Canvas Game Arcade's games into src/arcade/, for the Fun Club's solo
// play. canvas-games stays the one place each game is built: run this again to
// bring its changes over.
//
//   node scripts/sync-arcade.mjs [path to canvas-games]   (default ../canvas-games)
//
// Games that recreate a specific commercial game aren't brought in.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const EXCLUDED = new Set([
  'asteroids',
  'breakout',
  'color-switch',
  'doodle-jump',
  'flappy-bird',
  'frogger',
  'fruit-ninja',
  'pacman',
  'pong',
  'space-invaders',
  'tetris',
])

/** Each `lazyGame(...)` call in the registry: where its line starts, where it stops, its folder. */
export function lazyGameCalls(source) {
  const calls = []
  for (let at = source.indexOf('lazyGame('); at >= 0; at = source.indexOf('lazyGame(', at + 1)) {
    // The helper's own definition is `function lazyGame(`: not a call.
    if (/function\s+$/.test(source.slice(Math.max(0, at - 12), at))) continue
    let depth = 0
    let end = at + 'lazyGame'.length
    for (; end < source.length; end++) {
      const ch = source[end]
      if (ch === '(') depth++
      else if (ch === ')' && --depth === 0) break
    }
    const body = source.slice(at, end + 1)
    const folder = /import\(\s*["']@games\/([\w-]+)["']\s*\)/.exec(body)?.[1]
    if (!folder)
      throw new Error(`a lazyGame call has no import("@games/..."): ${body.slice(0, 80)}`)
    // Take the comma and line end after the call with it, so the list stays tidy.
    let stop = end + 1
    while (/[ \t,]/.test(source[stop] ?? '')) stop++
    if (source[stop] === '\n') stop++
    calls.push({ start: source.lastIndexOf('\n', at) + 1, stop, folder })
  }
  return calls
}

/** The registry with the excluded games' entries taken out. */
export function filterRegistry(source, excluded = EXCLUDED) {
  let out = source
  for (const call of lazyGameCalls(source).reverse())
    if (excluded.has(call.folder)) out = out.slice(0, call.start) + out.slice(call.stop)
  return out
}

/** The arcade's own aliases, pointed at where its files live here. */
export const rewriteImports = (source) =>
  source
    .replaceAll(/(["'])@shared\//g, '$1@/arcade/shared/')
    .replaceAll(/(["'])@games\//g, '$1@/arcade/games/')

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, fn)
    else fn(path)
  }
}

function main() {
  const from = resolve(process.argv[2] ?? '../canvas-games')
  const to = resolve('src/arcade')
  if (!existsSync(join(from, 'src/platform/GameRegistry.ts')))
    throw new Error(`${from} doesn't look like canvas-games`)
  rmSync(join(to, 'games'), { recursive: true, force: true })
  rmSync(join(to, 'shared'), { recursive: true, force: true })
  mkdirSync(join(to, 'games'), { recursive: true })
  cpSync(join(from, 'src/shared'), join(to, 'shared'), { recursive: true })
  const games = readdirSync(join(from, 'src/games')).filter((g) => !EXCLUDED.has(g))
  for (const g of games)
    cpSync(join(from, 'src/games', g), join(to, 'games', g), { recursive: true })
  const registry = filterRegistry(readFileSync(join(from, 'src/platform/GameRegistry.ts'), 'utf8'))
  writeFileSync(
    join(to, 'registry.ts'),
    `// Copied from canvas-games by scripts/sync-arcade.mjs: edit it there, then sync.\n${registry}`,
  )
  cpSync(join(from, 'LICENSE'), join(to, 'LICENSE'))
  walk(to, (path) => {
    if (path.endsWith('.ts')) writeFileSync(path, rewriteImports(readFileSync(path, 'utf8')))
  })
  console.log(`synced ${games.length} games into ${to}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
