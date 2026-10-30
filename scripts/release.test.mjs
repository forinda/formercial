import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bumpSemver, groupCommits, parseCommit, renderNotes } from './release.mjs'

const REPO = 'https://github.com/forinda/formercial'

describe('parseCommit', () => {
  it('reads a type, a scope and a description', () => {
    assert.deepEqual(parseCommit('feat(work): an item has a key'), {
      type: 'feat',
      scope: 'work',
      breaking: false,
      description: 'an item has a key',
    })
  })

  it('reads one without a scope', () => {
    assert.equal(parseCommit('fix: a thing')?.scope, undefined)
  })

  it('reads the bang as breaking', () => {
    assert.equal(parseCommit('feat(api)!: drop the old route')?.breaking, true)
  })

  /** A merge, a revert, anything hand-written: skipped, never crashed on. */
  it('gives nothing for a subject that is not conventional', () => {
    assert.equal(parseCommit('Merge branch main'), null)
    assert.equal(parseCommit(''), null)
  })
})

describe('groupCommits', () => {
  const sha = (n) => String(n).repeat(40)
  const records = [
    { sha: sha(1), subject: 'feat(work): a key', body: '' },
    { sha: sha(2), subject: 'fix(web): a card', body: '' },
    { sha: sha(3), subject: 'feat(db)!: rename a column', body: '' },
    { sha: sha(4), subject: 'refactor(api): tidy', body: 'BREAKING CHANGE: the header moved' },
    { sha: sha(5), subject: 'chore(release): v0.9.0', body: '' },
    { sha: sha(6), subject: 'not a commit message', body: '' },
    { sha: sha(7), subject: 'ci: cache the store', body: '' },
  ]
  const buckets = groupCommits(records, REPO)

  it('files each commit under its type', () => {
    assert.match(buckets.feat[0], /\*\*work:\*\* a key/)
    assert.match(buckets.fix[0], /\*\*web:\*\* a card/)
  })

  /**
   * A breaking change is listed once, at the top, whether it was marked with a
   * bang or spelled out in the body — never left in its own type's section
   * where somebody upgrading would scroll past it.
   */
  it('lifts every breaking change out of its type', () => {
    assert.equal(buckets.breaking.length, 2)
    assert.match(buckets.breaking[0], /rename a column/)
    assert.match(buckets.breaking[1], /tidy/)
    assert.equal(buckets.feat.length, 1)
    assert.equal(buckets.refactor.length, 0)
  })

  it('skips the release commits themselves', () => {
    assert.ok(!JSON.stringify(buckets).includes('v0.9.0'))
  })

  it('keeps a subject nobody wrote conventionally, under Other', () => {
    assert.match(buckets.other[0], /not a commit message/)
  })

  it('reads ci as build, where somebody would look for it', () => {
    assert.match(buckets.build[0], /cache the store/)
  })

  it('links every line to its commit', () => {
    assert.match(
      buckets.feat[0],
      /\[`1111111`\]\(https:\/\/github\.com\/forinda\/formercial\/commit\//,
    )
  })
})

describe('bumpSemver', () => {
  it('bumps each part, and zeroes what sits below it', () => {
    assert.equal(bumpSemver('1.2.3', 'patch'), '1.2.4')
    assert.equal(bumpSemver('1.2.3', 'minor'), '1.3.0')
    assert.equal(bumpSemver('1.2.3', 'major'), '2.0.0')
  })

  it('starts from nothing', () => {
    assert.equal(bumpSemver('0.0.0', 'minor'), '0.1.0')
  })
})

describe('renderNotes', () => {
  const notes = renderNotes({
    tag: 'v1.0.0',
    date: '2026-09-27',
    buckets: { feat: ['- **work:** a key'], fix: [] },
    repoUrl: REPO,
    lastTag: 'v0.9.0',
  })

  it('writes a section a person can read', () => {
    assert.match(notes, /^## v1\.0\.0 \(2026-09-27\)/)
    assert.match(notes, /### 🚀 Features\n\n- \*\*work:\*\* a key/)
    assert.match(notes, /compare\/v0\.9\.0\.\.\.v1\.0\.0/)
  })

  it('leaves out a section with nothing in it', () => {
    assert.ok(!notes.includes('Bug Fixes'))
  })

  /** A body over GitHub's limit is refused by the API, so a huge range caps. */
  it('caps a section and says how much it left out', () => {
    const many = Array.from({ length: 10 }, (_, i) => `- item ${i}`)
    const capped = renderNotes({
      tag: 'v1.0.0',
      date: '2026-09-27',
      buckets: { feat: many },
      repoUrl: REPO,
      lastTag: 'v0.9.0',
      maxPerSection: 3,
    })
    assert.match(capped, /- item 2/)
    assert.ok(!capped.includes('- item 3'))
    assert.match(capped, /…and 7 more/)
  })

  it('says so when a release carries nothing worth announcing', () => {
    const empty = renderNotes({ tag: 'v1.0.1', date: '2026-09-27', buckets: {}, repoUrl: REPO })
    assert.match(empty, /No conventional-commit changes/)
  })
})
