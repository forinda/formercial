// A solo arcade game, full window. The game sizes its canvas to the window and
// draws everything itself; leaving the page (or Esc in most games) ends it.
import { Link, router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { getAllGames } from '@/arcade/registry'
import type { GameInstance } from '@/arcade/shared/GameInterface'

export default function FunPlay({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const game = getAllGames().find((g) => g.id === id)

  useEffect(() => {
    const el = canvas.current
    if (!el || !game) return
    let instance: GameInstance | null = null
    let gone = false
    el.width = window.innerWidth
    el.height = window.innerHeight
    Promise.resolve(game.create(el, () => router.visit('/fun')))
      .then((started) => {
        if (gone) started.destroy()
        else instance = started
      })
      .catch((err: Error) => setError(err.message))
    return () => {
      gone = true
      instance?.destroy()
    }
  }, [game])

  if (!game)
    return (
      <main className="mx-auto grid max-w-xl gap-3 px-4 py-12">
        <p>There's no game called “{id}”.</p>
        <Link href="/fun" className="text-sm underline">
          Back to the Fun Club
        </Link>
      </main>
    )
  return (
    <main className="fixed inset-0 bg-black">
      <h1 className="sr-only">{game.name}</h1>
      <canvas ref={canvas} className="block h-full w-full" />
      <Link
        href="/fun"
        aria-label="Leave the game"
        className="fixed top-2 right-2 rounded-md bg-black/50 px-2 py-1 text-sm text-white/80 hover:text-white"
      >
        ✕
      </Link>
      {error && (
        <p className="fixed inset-x-0 bottom-4 text-center text-sm text-red-300">
          The game couldn't start: {error}
        </p>
      )}
    </main>
  )
}
