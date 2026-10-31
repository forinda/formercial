// Product and language icons from Iconify, stored in the project so a render needs no network.
import { download } from './font-links'
import type { Workspace } from '@/core/storage/workspace'

const API = 'https://api.iconify.design'
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$/
// Real logos and language icons: a plain search also returns every generic look-alike.
const SETS = 'logos,vscode-icons,devicon,skill-icons,simple-icons'
const MAX_BYTES = 512 * 1024

export async function searchIcons(query: string, fetchFn: typeof fetch = fetch): Promise<string[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({ query: query.trim(), limit: '48', prefixes: SETS })
  const data = await download(`${API}/search?${params}`, MAX_BYTES, fetchFn)
  const { icons } = JSON.parse(new TextDecoder().decode(data)) as { icons?: string[] }
  return icons ?? []
}

/** Download an icon like `logos:typescript-icon` once, and return its path in the project. */
export async function storeIcon(
  ws: Workspace,
  slug: string,
  name: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  if (!NAME.test(name)) throw new Error(`"${name}" isn't an icon name like logos:typescript-icon`)
  const [set, icon] = name.split(':')
  const path = `media/icons/${set}-${icon}.svg`
  if (await ws.stat(slug, path)) return path
  const data = await download(`${API}/${set}/${icon}.svg`, MAX_BYTES, fetchFn)
  const svg = new TextDecoder().decode(data)
  if (!/^\s*<svg[\s>]/.test(svg) || /<script/i.test(svg)) {
    throw new Error(`${name} didn't come back as a plain SVG`)
  }
  await ws.putFile(slug, path, svg)
  return path
}
