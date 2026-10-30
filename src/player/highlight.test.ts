import { describe, expect, test } from 'vitest'
import { highlight } from './highlight'

describe('highlight', () => {
  test('python: keywords, strings and # comments', () => {
    const html = highlight('py', 'for key in person:  # every key\n    print("hi")')
    expect(html).toContain('<span class="k">for</span>')
    expect(html).toContain('<span class="k">in</span>')
    expect(html).toContain('<span class="c"># every key</span>')
    expect(html).toContain('<span class="s">"hi"</span>')
    expect(html).toContain('<span class="f">print</span>')
  })

  test('javascript: let, const and calls', () => {
    const html = highlight('js', "const name = 'Ada'\nconsole.log(name)")
    expect(html).toContain('<span class="k">const</span>')
    expect(html).toContain('<span class="s">\'Ada\'</span>')
    expect(html).toContain('<span class="f">log</span>')
  })

  test('# is not a comment in TypeScript', () => {
    expect(highlight('ts', 'this.#secret')).not.toContain('class="c"')
  })
})
