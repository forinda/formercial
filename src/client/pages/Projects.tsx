import { Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { api } from '../editor/useProject'

export default function Projects({ projects }: { projects: { slug: string; name: string }[] }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  async function create(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { slug } = await api<{ slug: string }>('/api/v1/projects', {
        method: 'POST',
        json: { name },
      })
      router.visit(`/p/${slug}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <main className="home">
      <h1>Commercials</h1>
      <form onSubmit={create} className="row">
        <label htmlFor="new-name" className="sr-only">
          Name
        </label>
        <input
          id="new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name, e.g. @forinda/kickjs-db"
        />
        <button type="submit" disabled={!name.trim()}>
          New commercial
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {projects.length === 0 ? (
        <p className="muted">
          No commercials yet. Name one above, or run kick cxc new &lt;name&gt;.
        </p>
      ) : (
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link href={`/p/${p.slug}`}>{p.name}</Link>
              <span className="muted">projects/{p.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
