import { describe, expect, test } from 'vitest'
import { getAllGames } from './registry'

// Games that recreate a specific commercial game: scripts/sync-arcade.mjs leaves them out.
const EXCLUDED = new Set([
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

describe('the solo arcade', () => {
  const games = getAllGames()

  test('has the 41 games brought over, and none of the excluded ones', () => {
    expect(games).toHaveLength(41)
    for (const g of games) expect(EXCLUDED.has(g.id)).toBe(false)
  })

  test('each game has a unique id that is safe in a URL', () => {
    const ids = games.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/)
  })

  test('the list loads without running any game', () => {
    for (const g of games) expect(typeof g.create).toBe('function')
  })
})
