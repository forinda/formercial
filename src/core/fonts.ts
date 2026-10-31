// Theme fonts live in the project (media/fonts/), so a render looks the same
// offline and on any machine. Picking a Google Fonts family downloads its
// latin files once.
import { FONT_FAMILY as FAMILY, type Theme } from './project'
import type { Workspace } from './workspace'

// A modern browser agent: the css2 API answers it with woff2.
export const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/** A stalled download fails, so it can't hold up creating a project from a preset. */
export const stalled = () => AbortSignal.timeout(15_000)

export const fontSlug = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export async function fetchGoogleFont(
  family: string,
  weights: number[],
  fetchFn: typeof fetch = fetch,
): Promise<{ file: string; weight: number; data: Uint8Array }[]> {
  if (!FAMILY.test(family)) throw new Error(`"${family}" isn't a font family name`)
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}&display=block`
  const res = await fetchFn(url, { headers: { 'user-agent': UA }, signal: stalled() })
  if (!res.ok) throw new Error(`Google Fonts has no "${family}" in those weights (${res.status})`)
  const css = await res.text()
  const out: { file: string; weight: number; data: Uint8Array }[] = []
  const seen = new Map<string, (typeof out)[number]>()
  // One block per subset; keep the latin one for each weight.
  for (const m of css.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const weight = Number(/font-weight:\s*(\d+)/.exec(m[1])?.[1])
    const src = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(m[1])?.[1]
    if (!weight || !src || out.some((o) => o.weight === weight)) continue
    // A variable font comes back as one file for every weight: keep it once.
    const same = seen.get(src)
    if (same) {
      out.push({ ...same, weight })
      continue
    }
    const file = await fetchFn(src, { signal: stalled() })
    if (!file.ok) throw new Error(`couldn't download ${family} ${weight}`)
    const entry = {
      file: `media/fonts/${fontSlug(family)}-${weight}.woff2`,
      weight,
      data: new Uint8Array(await file.arrayBuffer()),
    }
    seen.set(src, entry)
    out.push(entry)
  }
  if (out.length === 0) throw new Error(`Google Fonts returned no latin files for "${family}"`)
  return out
}

export type FontKind = 'woff2' | 'woff' | 'ttf' | 'otf'
const FORMATS: Record<FontKind, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
}

/** @font-face rules for the fonts stored in the project. */
export function fontFaceCss(theme: Theme, fileUrl: (path: string) => string): string {
  // The schema already keeps these plain; skip anything else rather than trust it.
  return (theme.fonts.files ?? [])
    .filter(
      (f) =>
        FAMILY.test(f.family) &&
        Number.isInteger(f.weight) &&
        /^media\/fonts\/[\w.-]+$/.test(f.path),
    )
    .map(
      (f) =>
        `@font-face { font-family: '${f.family.replace(/'/g, '')}'; font-weight: ${f.weight}; src: url('${fileUrl(f.path).replace(/'/g, '%27')}') format('${FORMATS[f.path.split('.').pop() as FontKind] ?? 'woff2'}'); font-display: block }`,
    )
    .join('\n')
}

/**
 * Download a Google Fonts family into the project and record it in the theme.
 * Weights the family lacks are dropped (css2 refuses a request naming one).
 */
export async function storeGoogleFont(
  ws: Workspace,
  slug: string,
  family: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ family: string; weight: number; path: string }[]> {
  let files: Awaited<ReturnType<typeof fetchGoogleFont>> | undefined
  let lastError: unknown
  for (const weights of [[400, 500, 600, 700, 800], [400, 700], [400]]) {
    try {
      files = await fetchGoogleFont(family, weights, fetchFn)
      break
    } catch (err) {
      lastError = err
    }
  }
  if (!files) throw lastError
  return recordFonts(
    ws,
    slug,
    files.map((f) => ({ family, weight: f.weight, path: f.file, data: f.data })),
  )
}

/** Keep the files in media/fonts/ and list them in the theme. A re-added weight replaces the old one. */
export async function recordFonts(
  ws: Workspace,
  slug: string,
  fonts: { family: string; weight: number; path: string; data: Uint8Array }[],
) {
  for (const path of new Set(fonts.map((f) => f.path))) {
    await ws.putFile(slug, path, fonts.find((f) => f.path === path)!.data)
  }
  const entries = fonts.map(({ family, weight, path }) => ({ family, weight, path }))
  const { project, version } = await ws.read(slug)
  const kept = (project.theme.fonts.files ?? []).filter(
    (f) => !entries.some((e) => e.family === f.family && e.weight === f.weight),
  )
  await ws.write(
    slug,
    {
      ...project,
      theme: { ...project.theme, fonts: { ...project.theme.fonts, files: [...kept, ...entries] } },
    },
    version,
  )
  return entries
}
