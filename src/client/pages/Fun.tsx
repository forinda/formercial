import { Sections } from '@/client/components/sections'

// The games room. Nothing to play yet: this says what's coming, honestly.
export default function Fun() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Sections current="fun" />
      <h1 className="sr-only">Fun Club</h1>
      <section className="grid gap-2 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Coming first: Sudoku, together</h2>
        <p className="text-muted-foreground">
          Race or solve as a team, with friends joining your room by a code. You host the game
          server yourself, on your own machine or server, so nobody else holds your games.
        </p>
      </section>
    </main>
  )
}
