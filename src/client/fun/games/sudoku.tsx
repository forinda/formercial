// Sudoku's board: it draws what the server sends and sends moves. The server
// decides what's right, so a wrong number simply comes back as a note.
import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/client/lib/utils'
import { conflicts } from '@/fun/games/sudoku/engine'
import type { BoardProps } from './index'

type View = {
  mode: 'together' | 'race'
  difficulty: string
  puzzle: number[]
  board: number[]
  notes: Record<number, number[]>
  full: boolean
  canUndo: boolean
  players: { id: string; filled: number; of: number; finished: number | null }[]
  winner: string | null
}

export function SudokuBoard({ room, send, note }: BoardProps<View>) {
  const [selected, setSelected] = useState(-1)
  const [pencil, setPencil] = useState(false)
  const s = room.state
  const clash = conflicts(s.board)
  const names = Object.fromEntries(room.players.map((p) => [p.id, p.name]))
  // A digit places a number, or in pencil mode toggles it in the cell's notes.
  const put = (value: number) => {
    if (selected < 0 || room.done) return
    if (!pencil) return send('place', { cell: selected, value })
    const marks = s.notes[selected] ?? []
    send('note', {
      cell: selected,
      digits: marks.includes(value) ? marks.filter((d) => d !== value) : [...marks, value],
    })
  }
  // Clear empties the cell, or its pencil marks when it has no number.
  const clear = () => {
    if (selected < 0 || room.done) return
    if (s.board[selected] && !s.puzzle[selected]) send('clear', { cell: selected })
    else send('note', { cell: selected, digits: [] })
  }
  const undo = () => !room.done && send('undo', {})
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '9') put(Number(e.key))
    else if (e.key === 'p') setPencil(!pencil)
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') clear()
    else if (e.key === 'u' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) undo()
    else if (e.key.startsWith('Arrow') && selected >= 0) {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key] ?? 0
      setSelected(Math.min(80, Math.max(0, selected + step)))
    } else return
    e.preventDefault()
  }
  return (
    <div className="grid gap-4" onKeyDown={onKey}>
      <p className="text-sm text-muted-foreground">
        {s.mode === 'race' ? 'Race, a board each' : 'Together, one board'} · {s.difficulty}
      </p>
      <div
        role="grid"
        aria-label="Sudoku board"
        className="grid aspect-square w-full max-w-md grid-cols-9 border-2 border-foreground"
      >
        {s.board.map((v, i) => {
          const given = s.puzzle[i] !== 0
          return (
            <button
              key={i}
              type="button"
              aria-label={`row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}, ${v || 'empty'}`}
              disabled={given || room.done}
              onClick={() => setSelected(i)}
              className={cn(
                'aspect-square border border-border text-lg',
                given ? 'font-bold' : 'text-blue-600 dark:text-blue-400',
                clash.has(i) && 'bg-destructive/15 text-destructive',
                i === selected && 'bg-primary/30',
                i % 9 === 2 || i % 9 === 5 ? 'border-r-2 border-r-foreground' : '',
                Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5
                  ? 'border-b-2 border-b-foreground'
                  : '',
              )}
            >
              {v ? (
                v
              ) : s.notes[i]?.length ? (
                <span className="grid grid-cols-3 text-[0.55rem] leading-tight text-muted-foreground">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span key={d}>{s.notes[i].includes(d) ? d : ''}</span>
                  ))}
                </span>
              ) : (
                ''
              )}
            </button>
          )
        })}
      </div>
      <div className="grid w-full max-w-md grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <Button key={n} variant="secondary" onClick={() => put(n)}>
            {n}
          </Button>
        ))}
        <Button
          variant={pencil ? 'default' : 'ghost'}
          aria-pressed={pencil}
          onClick={() => setPencil(!pencil)}
        >
          Pencil
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
        <Button variant="ghost" disabled={!s.canUndo || room.done} onClick={undo}>
          Undo
        </Button>
      </div>
      {s.full && (
        <p className="text-sm font-medium">
          Every cell is filled, but something isn't right yet. Look for a clash, or undo.
        </p>
      )}
      <p role="status" className="min-h-6 text-sm text-destructive">
        {note}
      </p>
      <ul className="grid gap-2">
        {s.players.map((p) => (
          <li key={p.id} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 text-sm">
            <span>
              {names[p.id]}
              {p.id === room.you ? ' (you)' : ''}
            </span>
            <progress max={p.of} value={p.filled} className="w-full" />
            <span className="text-muted-foreground">
              {p.filled}/{p.of} filled
            </span>
          </li>
        ))}
      </ul>
      {s.winner ? (
        <p className="text-lg font-semibold">{names[s.winner]} finished first!</p>
      ) : room.done ? (
        <p className="text-lg font-semibold">Solved together!</p>
      ) : null}
    </div>
  )
}
