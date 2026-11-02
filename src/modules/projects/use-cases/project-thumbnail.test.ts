import { describe, expect, test } from 'vitest'
import { latestRender } from './project-thumbnail.use-case'

describe('latestRender', () => {
  test('the newest 16:9 render, else the newest of any shape', () => {
    expect(
      latestRender([
        'renders/16x9-20261101-100000.mp4',
        'renders/16x9-20261102-090000.mp4',
        'renders/9x16-20261103-080000.mp4',
        'renders/srt/16x9-20261102-090000.srt',
      ]),
    ).toBe('renders/16x9-20261102-090000.mp4')
    expect(latestRender(['renders/9x16-20261103-080000.mp4'])).toBe(
      'renders/9x16-20261103-080000.mp4',
    )
  })

  test('nothing rendered, or only other files, gives none', () => {
    expect(latestRender([])).toBeNull()
    expect(latestRender(['renders/16x9-x.srt', 'renders/old/16x9-a.mp4'])).toBeNull()
  })
})
