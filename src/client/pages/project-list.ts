// Finding a project in a long list: a search over names and slugs, then a page of it.
export type ProjectEntry = { slug: string; name: string }

export const PAGE_SIZE = 20

/** Projects whose name or slug has every word of the search, in any order and case. */
export function searchProjects<T extends ProjectEntry>(projects: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return projects
  return projects.filter((p) => {
    const text = `${p.name} ${p.slug}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

/** One page of a list, from 1. A page past the end shows the last one. */
export function pageOf<T>(list: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  return { items: list.slice((current - 1) * size, current * size), page: current, pages }
}
