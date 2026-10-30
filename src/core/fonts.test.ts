import { describe, expect, test, vi } from 'vitest'
import { fetchGoogleFont, fontFaceCss } from './fonts'
import { DEFAULT_THEME } from './project'

const CSS2 = `/* cyrillic */
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/unbounded/v1/cyr-400.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/unbounded/v1/lat-400.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 800;
  src: url(https://fonts.gstatic.com/s/unbounded/v1/lat-800.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`

describe('fonts', () => {
  test('fetchGoogleFont parses css2 woff2 urls, latin only', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.startsWith('https://fonts.googleapis.com/css2')
        ? new Response(CSS2)
        : new Response(new Uint8Array([1, 2, url.length])),
    )
    const files = await fetchGoogleFont('Unbounded', [400, 800], fetchFn as unknown as typeof fetch)
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;800&display=block',
    )
    expect(files.map((f) => [f.file, f.weight])).toEqual([
      ['media/fonts/unbounded-400.woff2', 400],
      ['media/fonts/unbounded-800.woff2', 800],
    ])
    expect(fetchFn.mock.calls.map((c) => c[0])).toContain(
      'https://fonts.gstatic.com/s/unbounded/v1/lat-400.woff2',
    )
    expect(fetchFn.mock.calls.map((c) => c[0])).not.toContain(
      'https://fonts.gstatic.com/s/unbounded/v1/cyr-400.woff2',
    )
  })

  test('fetchGoogleFont refuses a family name that is not plain', async () => {
    await expect(
      fetchGoogleFont('x&family=y', [400], vi.fn() as unknown as typeof fetch),
    ).rejects.toThrow(/family/)
  })

  test('fontFaceCss emits one @font-face per stored file', () => {
    const theme = {
      ...DEFAULT_THEME,
      fonts: {
        ...DEFAULT_THEME.fonts,
        files: [
          { family: 'Unbounded', weight: 400, path: 'media/fonts/unbounded-400.woff2' },
          { family: 'Unbounded', weight: 800, path: 'media/fonts/unbounded-800.woff2' },
        ],
      },
    }
    const css = fontFaceCss(theme, (p) => `/f?path=${p}`)
    expect(css.match(/@font-face/g)).toHaveLength(2)
    expect(css).toContain(
      `font-family: 'Unbounded'; font-weight: 800; src: url('/f?path=media/fonts/unbounded-800.woff2') format('woff2')`,
    )
  })

  test('a variable font served for several weights is stored once', async () => {
    const css = [400, 700]
      .map(
        (w) =>
          `/* latin */\n@font-face { font-weight: ${w}; src: url(https://fonts.gstatic.com/same.woff2) format('woff2'); }`,
      )
      .join('\n')
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('googleapis') ? new Response(css) : new Response(new Uint8Array([1])),
    )
    const files = await fetchGoogleFont('Inter', [400, 700], fetchFn as unknown as typeof fetch)
    expect(files.map((f) => [f.file, f.weight])).toEqual([
      ['media/fonts/inter-400.woff2', 400],
      ['media/fonts/inter-400.woff2', 700],
    ])
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
