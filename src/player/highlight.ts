// Small syntax colouring for typed code: comments, strings, keywords, numbers,
// calls. Good enough for an ad, not a parser.
export type Lang = 'ts' | 'sql' | 'json' | 'plain'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const KEYWORDS: Record<Exclude<Lang, 'plain'>, string> = {
  ts: 'const|let|await|async|return|import|from|export|function|new|true|false|null|undefined|if|else|type|interface',
  sql: 'CREATE|TABLE|ALTER|ADD|CONSTRAINT|FOREIGN|KEY|REFERENCES|PRIMARY|NOT|NULL|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|INDEX|ON|UNIQUE|DEFAULT',
  json: 'true|false|null',
}

const pattern = (lang: Exclude<Lang, 'plain'>) =>
  new RegExp(
    `(\\/\\/[^\\n]*|--[^\\n]*)|('[^'\\n]*'?|"[^"\\n]*"?|\`[^\`\\n]*\`?)|\\b(${KEYWORDS[lang]})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|([A-Za-z_]\\w*)(?=\\()`,
    'g',
  )

export function highlight(lang: Lang, src: string): string {
  if (lang === 'plain') return esc(src)
  let html = ''
  let last = 0
  for (const m of src.matchAll(pattern(lang))) {
    const [all, comment, str, kw, num] = m
    // `--` is a comment in SQL only; in TS it's the decrement operator.
    if (comment?.startsWith('--') && lang !== 'sql') continue
    html += esc(src.slice(last, m.index))
    const cls = comment ? 'c' : str ? 's' : kw ? 'k' : num ? 'n' : 'f'
    html += `<span class="${cls}">${esc(all)}</span>`
    last = m.index! + all.length
  }
  return html + esc(src.slice(last))
}

/** Terminal text: `$ ` prompts, `✗` failures and `✓` successes coloured per line. */
export function terminal(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      if (line.startsWith('$ ')) return `<span class="prompt">$ </span>${esc(line.slice(2))}`
      if (line.startsWith('✗')) return `<span class="bad">${esc(line)}</span>`
      if (line.startsWith('✓')) return `<span class="ok">${esc(line)}</span>`
      return esc(line)
    })
    .join('\n')
}
