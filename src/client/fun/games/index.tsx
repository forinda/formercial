// Each Fun Club game's board, by game id. A new game adds its server side in
// src/fun/games/ and its board here.
import type { ComponentType } from 'react'
import type { RoomView } from '../session'
import { SudokuBoard } from './sudoku'

export type BoardProps<S = unknown> = {
  room: RoomView<S>
  /** Send one of this game's own events, like send('place', { cell, value }) for sudoku:place. */
  send(event: string, data: unknown): void
  /** The server's answer to this player's last event, when it said no. */
  note: string
}

export const BOARDS: Record<string, ComponentType<BoardProps<never>>> = {
  sudoku: SudokuBoard as ComponentType<BoardProps<never>>,
}
