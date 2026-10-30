// Small syntax colouring for typed code: comments, strings, keywords, numbers,
// calls. Good enough for an ad, not a parser.
export type Lang = 'ts' | 'js' | 'py' | 'sql' | 'json' | 'plain'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const JS =
  'const|let|var|await|async|return|import|from|export|function|new|true|false|null|undefined|if|else|for|of|in|while|class|this|throw|try|catch'

const LANGS: Record<Exclude<Lang, 'plain'>, { keywords: string; comment: string }> = {
  ts: { keywords: `${JS}|type|interface|enum|implements|readonly`, comment: '\\/\\/[^\\n]*' },
  js: { keywords: JS, comment: '\\/\\/[^\\n]*' },
  py: {
    keywords:
      'def|return|if|elif|else|for|in|while|import|from|as|class|True|False|None|and|or|not|with|try|except|lambda|pass|break|continue|is',
    comment: '#[^\\n]*',
  },
  sql: {
    keywords:
      'CREATE|TABLE|ALTER|ADD|CONSTRAINT|FOREIGN|KEY|REFERENCES|PRIMARY|NOT|NULL|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|INDEX|ON|UNIQUE|DEFAULT',
    comment: '--[^\\n]*',
  },
  json: { keywords: 'true|false|null', comment: '(?!)' },
}

const pattern = (lang: Exclude<Lang, 'plain'>) =>
  new RegExp(
    `(${LANGS[lang].comment})|('[^'\\n]*'?|"[^"\\n]*"?|\`[^\`\\n]*\`?)|\\b(${LANGS[lang].keywords})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|([A-Za-z_]\\w*)(?=\\()`,
    'g',
  )

export function highlight(lang: Lang, src: string): string {
  if (lang === 'plain') return esc(src)
  let html = ''
  let last = 0
  for (const m of src.matchAll(pattern(lang))) {
    const [all, comment, str, kw, num] = m
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
