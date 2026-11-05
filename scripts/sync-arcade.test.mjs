import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXCLUDED, filterRegistry, lazyGameCalls, rewriteImports } from './sync-arcade.mjs'

const registry = `function lazyGame(
  id: string,
): GameDefinition {
  return { id }
}

export const GAME_REGISTRY = {
  arcade: [
    lazyGame(
      "snake",
      { goal: "Eat (food)" },
      () => import("@games/snake"),
      "SnakeGame",
    ),
    lazyGame("tetris", {}, () => import("@games/tetris"), "TetrisGame"),
    lazyGame(
      "golf",
      () => import("@games/golf"),
      "GolfGame",
    ),
  ],
}
`

test('finds each lazyGame call and its folder, not the helper itself', () => {
  assert.deepEqual(
    lazyGameCalls(registry).map((c) => c.folder),
    ['snake', 'tetris', 'golf'],
  )
})

test('takes out the excluded games whole, leaving the rest as they were', () => {
  const out = filterRegistry(registry, new Set(['tetris']))
  assert.ok(!out.includes('tetris'))
  assert.ok(out.includes('import("@games/snake")') && out.includes('import("@games/golf")'))
  assert.ok(out.includes('{ goal: "Eat (food)" }'))
  assert.equal(out.split('\n').length, registry.split('\n').length - 1)
})

test('excludes the games that recreate specific commercial ones', () => {
  for (const id of ['pacman', 'tetris', 'space-invaders', 'flappy-bird', 'pong', 'breakout'])
    assert.ok(EXCLUDED.has(id))
  assert.ok(!EXCLUDED.has('sudoku') && !EXCLUDED.has('chess'))
})

test('points the arcade aliases at src/arcade', () => {
  assert.equal(
    rewriteImports(`import x from "@shared/GameInterface.ts"\nimport("@games/snake")`),
    `import x from "@/arcade/shared/GameInterface.ts"\nimport("@/arcade/games/snake")`,
  )
})
