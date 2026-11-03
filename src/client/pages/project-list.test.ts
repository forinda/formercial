import { describe, expect, test } from 'vitest'
import { pageNumbers, pageOf, searchProjects } from './project-list'

const list = [
  { slug: '66-from-c-to-python', name: 'You Know C. Python Takes an Afternoon.' },
  { slug: '67-lists-loops-and-sets', name: 'One Line of Python Does What Your C Loop Did' },
  { slug: 'launch', name: 'Product launch' },
]

describe('searchProjects', () => {
  test('every word must match name or slug, in any order and case', () => {
    expect(searchProjects(list, 'python LOOP').map((p) => p.slug)).toEqual([
      '67-lists-loops-and-sets',
    ])
    expect(searchProjects(list, '66').map((p) => p.slug)).toEqual(['66-from-c-to-python'])
    expect(searchProjects(list, '  ')).toHaveLength(3)
    expect(searchProjects(list, 'nothing here')).toEqual([])
  })
})

describe('pageOf', () => {
  const items = Array.from({ length: 45 }, (_, i) => i)
  test('slices a page and counts pages', () => {
    expect(pageOf(items, 2)).toMatchObject({ page: 2, pages: 3 })
    expect(pageOf(items, 3).items).toEqual([40, 41, 42, 43, 44])
  })
  test('a page out of range, or not a number, lands on a real one', () => {
    expect(pageOf(items, 9).page).toBe(3)
    expect(pageOf(items, 0).page).toBe(1)
    expect(pageOf(items, Number('x')).page).toBe(1)
    expect(pageOf([], 1)).toEqual({ items: [], page: 1, pages: 1 })
  })
})

describe('pageNumbers', () => {
  test('first two, last two, the current with its neighbours, gaps as null', () => {
    expect(pageNumbers(1, 1)).toEqual([1])
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageNumbers(1, 10)).toEqual([1, 2, null, 9, 10])
    expect(pageNumbers(6, 12)).toEqual([1, 2, null, 5, 6, 7, null, 11, 12])
    expect(pageNumbers(4, 12)).toEqual([1, 2, 3, 4, 5, null, 11, 12])
  })
})
