// Every game the Fun Club serves. A new game is a folder beside sudoku/ with a
// defineGame(...) and its client script, added to this list.
import type { AnyGame } from '../game'
import { sudoku } from './sudoku/game'

export const GAMES: AnyGame[] = [sudoku]
