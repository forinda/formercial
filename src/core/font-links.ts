// Server only: fonts.ts also runs in the browser, and this needs node:dns and node:net.
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { fontSlug, recordFonts, stalled, UA, type FontKind } from './fonts'
import { FONT_FAMILY as FAMILY } from './project'
import type { Workspace } from './workspace'

// A link to a stylesheet or a font file, from any host. It's downloaded once, like
// a Google font, so the project never depends on that host at render time.
const MAX_CSS_BYTES = 2 * 1024 * 1024
const MAX_FONT_BYTES = 10 * 1024 * 1024
const MAX_FONT_FILES = 24

const PRIVATE = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  PRIVATE.addSubnet(net, bits, 'ipv4')
}
PRIVATE.addAddress('::1', 'ipv6')
PRIVATE.addSubnet('fc00::', 7, 'ipv6')
PRIVATE.addSubnet('fe80::', 10, 'ipv6')

/** Only https, and never this machine or its network: the server does the fetching. */
async function publicUrl(raw: string): Promise<string> {
  const url = URL.parse(raw)
  if (url?.protocol !== 'https:') throw new Error(`"${raw}" isn't an https link`)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  // A name that doesn't resolve fails at the fetch, with a clearer message.
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (found) => found.map((a) => a.address),
        () => [],
      )
  if (addresses.some((a) => PRIVATE.check(a, isIP(a) === 6 ? 'ipv6' : 'ipv4'))) {
    throw new Error(`"${raw}" points at a private address`)
  }
  return url.href
}

async function download(url: string, limit: number, fetchFn: typeof fetch): Promise<Uint8Array> {
  const res = await fetchFn(await publicUrl(url), {
    headers: { 'user-agent': UA },
    // Following a redirect would skip the address check.
    redirect: 'error',
    signal: stalled(),
  })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of res.body ?? []) {
    size += chunk.length
    if (size > limit) throw new Error(`${url} is too large`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** What the file is, from its first bytes: a link's extension can't be trusted. */
function fontKind(data: Uint8Array): FontKind | undefined {
  const head = Buffer.from(data.subarray(0, 4)).toString('latin1')
  if (head === 'wOF2') return 'woff2'
  if (head === 'wOFF') return 'woff'
  if (head === 'OTTO') return 'otf'
  if (head === '\0\x01\0\0' || head === 'true') return 'ttf'
  return undefined
}

const coversLatin = (range: string | undefined) =>
  !range ||
  [...range.matchAll(/U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/gi)].some(([, from, to]) => {
    const start = parseInt(from.replace(/\?/g, '0'), 16)
    const end = parseInt(to ?? from.replace(/\?/g, 'f'), 16)
    return start <= 0x41 && 0x41 <= end
  })

const THEME_WEIGHTS = [400, 500, 600, 700, 800]

function weightsOf(value = '400'): number[] {
  const [from, to] = value
    .replace(/\bnormal\b/i, '400')
    .replace(/\bbold\b/i, '700')
    .trim()
    .split(/\s+/)
    .map(Number)
  if (!Number.isInteger(from) || from < 1 || from > 1000) return []
  // A variable font: one file standing in for every weight it spans.
  if (to) {
    const inside = THEME_WEIGHTS.filter((w) => from <= w && w <= to)
    return inside.length ? inside : [from]
  }
  return [from]
}

/** The upright, latin faces of a stylesheet: one file for each family and weight. */
export function parseFontFaces(
  css: string,
  base: string,
): { family: string; weight: number; src: string }[] {
  const out: { family: string; weight: number; src: string }[] = []
  for (const [, body] of css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const read = (name: string) =>
      new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1].trim()
    const named = /(?:^|;)\s*font-family\s*:\s*(?:'([^']*)'|"([^"]*)"|([^;]+))/i.exec(body)
    const family = (named?.[1] ?? named?.[2] ?? named?.[3])?.trim()
    if (!family || !FAMILY.test(family)) continue
    if (/italic|oblique/i.test(read('font-style') ?? '')) continue
    if (!coversLatin(read('unicode-range'))) continue
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map((m) => m[1])
      .filter((u) => !u.startsWith('data:'))
    // The smallest format the stylesheet offers.
    const src = ['woff2', 'woff', 'ttf', 'otf']
      .map((ext) => urls.find((u) => new RegExp(`\\.${ext}(?:[?#]|$)`, 'i').test(u)))
      .find(Boolean)
    if (!src) continue
    const resolved = URL.parse(src, base)?.href
    if (!resolved) continue
    for (const weight of weightsOf(read('font-weight'))) {
      if (!out.some((f) => f.family === family && f.weight === weight)) {
        out.push({ family, weight, src: resolved })
      }
    }
  }
  return out
}

/**
 * Download what a link holds into the project: every face of a stylesheet, or a
 * single font file, which has no name of its own and so needs `family`.
 */
export async function storeFontFromUrl(
  ws: Workspace,
  slug: string,
  link: { url: string; family?: string; weight?: number },
  fetchFn: typeof fetch = fetch,
): Promise<{ family: string; weight: number; path: string }[]> {
  const first = await download(link.url, Math.max(MAX_CSS_BYTES, MAX_FONT_BYTES), fetchFn)
  const kind = fontKind(first)
  if (kind) {
    if (!link.family) throw new Error('a link to a font file needs a family name')
    const weight = link.weight ?? 400
    const path = `media/fonts/${fontSlug(link.family)}-${weight}.${kind}`
    return recordFonts(ws, slug, [{ family: link.family, weight, path, data: first }])
  }
  if (first.length > MAX_CSS_BYTES) throw new Error(`${link.url} is too large`)
  const faces = parseFontFaces(Buffer.from(first).toString('utf8'), link.url)
  if (faces.length === 0) throw new Error(`${link.url} has no usable @font-face rules`)
  const sources = [...new Set(faces.map((f) => f.src))]
  if (sources.length > MAX_FONT_FILES) throw new Error(`${link.url} lists too many font files`)
  const files = new Map<string, { data: Uint8Array; kind: FontKind }>()
  for (const src of sources) {
    const data = await download(src, MAX_FONT_BYTES, fetchFn)
    const fileKind = fontKind(data)
    if (!fileKind) throw new Error(`${src} isn't a font file`)
    files.set(src, { data, kind: fileKind })
  }
  // A variable font's weights share one file, named after the first of them.
  const named = new Map<string, string>()
  return recordFonts(
    ws,
    slug,
    faces.map(({ family, weight, src }) => {
      const { data, kind: fileKind } = files.get(src)!
      const path = named.get(src) ?? `media/fonts/${fontSlug(family)}-${weight}.${fileKind}`
      named.set(src, path)
      return { family, weight, path, data }
    }),
  )
}
