import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  addToChangelog,
  bumpSemver,
  changelogEntry,
  groupCommits,
  parseCommit,
  planSteps,
  renderNotes,
} from './release.mjs'

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

describe('changelog helpers', () => {
  const log = addToChangelog(addToChangelog('', '## v1.0.0 (d)\n\nfirst\n'), '## v1.1.0 (d)\n\nsecond\n')

  it('adds new entries at the top', () => {
    assert.ok(log.indexOf('v1.1.0') < log.indexOf('v1.0.0'))
    assert.ok(log.startsWith('# Changelog\n'))
  })

  it('reads one entry back, exactly', () => {
    assert.equal(changelogEntry(log, 'v1.1.0'), '## v1.1.0 (d)\n\nsecond\n')
    assert.equal(changelogEntry(log, 'v1.0.0'), '## v1.0.0 (d)\n\nfirst\n')
    assert.equal(changelogEntry(log, 'v1.2.0'), null)
  })

  it("doesn't confuse v1.1.0 with v1x1.0 or v1.1.01", () => {
    assert.equal(changelogEntry('## v1x1x0 (d)\n', 'v1.1.0'), null)
    assert.equal(changelogEntry('## v1.1.01 (d)\n', 'v1.1.0'), null)
  })
})

describe('planSteps', () => {
  const all = {
    changelog: true,
    version: true,
    committed: true,
    tagged: true,
    branchPushed: true,
    tagPushed: true,
    released: true,
  }

  it('has nothing to do once everything is done', () => {
    assert.deepEqual(planSteps(all), [])
  })

  it('does only what is left', () => {
    assert.deepEqual(planSteps({ ...all, released: false }), ['github-release'])
    assert.deepEqual(planSteps({ ...all, tagPushed: false, released: false }), [
      'push-tag',
      'github-release',
    ])
  })

  it('stops at the tag without pushing', () => {
    assert.deepEqual(planSteps({ noPush: true }), ['changelog', 'version', 'commit', 'tag'])
  })
})

// The whole script against a real git remote, with a stand-in for gh that can be
// told to fail, so a release can really break part-way and be re-run.
describe('release flow', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

  function setup() {
    const root = mkdtempSync(join(tmpdir(), 'formercial-release-'))
    const bare = join(root, 'origin.git')
    const work = join(root, 'work')
    const bin = join(root, 'bin')
    mkdirSync(bin)
    git(root, 'init', '--quiet', '--bare', '--initial-branch=main', bare)
    git(root, 'init', '--quiet', '--initial-branch=main', work)
    git(work, 'config', 'user.name', 'T')
    git(work, 'config', 'user.email', 't@example.com')
    // The script reads the GitHub name; git really talks to the bare repo.
    git(work, 'remote', 'add', 'origin', 'https://github.com/acme/app.git')
    git(work, 'config', `url.${bare}.insteadOf`, 'https://github.com/acme/app.git')
    mkdirSync(join(work, 'scripts'))
    copyFileSync(join(here, 'release.mjs'), join(work, 'scripts/release.mjs'))
    symlinkSync(join(here, '../node_modules'), join(work, 'node_modules'))
    writeFileSync(join(work, '.gitignore'), 'node_modules\n.tmp\n')
    writeFileSync(join(work, 'package.json'), '{\n  "version": "1.0.0"\n}\n')
    git(work, 'add', '.')
    git(work, 'commit', '--quiet', '-m', 'feat: first')
    git(work, 'push', '--quiet', 'origin', 'main')
    const state = join(root, 'gh-state')
    mkdirSync(state)
    writeFileSync(
      join(bin, 'gh'),
      `#!/bin/sh
if [ "$1" = auth ]; then exit 0; fi
tag="$3"
if [ "$2" = view ]; then [ -e "${state}/$tag" ]; exit $?; fi
if [ "$2" = create ]; then
  [ -e "${state}/fail" ] && { echo "gh: down" >&2; exit 1; }
  touch "${state}/$tag"; echo "$tag" >> "${state}/created"; exit 0
fi
exit 1
`,
    )
    chmodSync(join(bin, 'gh'), 0o755)
    const run = (...args) =>
      spawnSync(process.execPath, ['scripts/release.mjs', ...args], {
        cwd: work,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      })
    return {
      root,
      work,
      bare,
      state,
      run,
      version: () => JSON.parse(readFileSync(join(work, 'package.json'), 'utf8')).version,
      changelog: () => readFileSync(join(work, 'CHANGELOG.md'), 'utf8'),
      created: () =>
        existsSync(join(state, 'created'))
          ? readFileSync(join(state, 'created'), 'utf8').trim().split('\n')
          : [],
      tagOnOrigin: (tag) => git(bare, 'tag', '--list', tag),
      done: () => rmSync(root, { recursive: true, force: true }),
    }
  }
  const entries = (text, tag) => text.split(`## ${tag} (`).length - 1
  const expectOk = (r) => assert.equal(r.status, 0, r.stderr)

  it('releases everything in one go', () => {
    const t = setup()
    expectOk(t.run('1.1.0'))
    assert.equal(t.version(), '1.1.0')
    assert.equal(t.tagOnOrigin('v1.1.0'), 'v1.1.0')
    assert.deepEqual(t.created(), ['v1.1.0'])
    assert.equal(git(t.bare, 'log', '-1', '--format=%s', 'main'), 'chore(release): v1.1.0')
    t.done()
  })

  it('running a finished release again changes nothing', () => {
    const t = setup()
    expectOk(t.run('1.1.0'))
    const head = git(t.work, 'rev-parse', 'HEAD')
    const again = t.run('1.1.0')
    expectOk(again)
    assert.match(again.stderr, /already released/)
    assert.equal(git(t.work, 'rev-parse', 'HEAD'), head)
    assert.deepEqual(t.created(), ['v1.1.0'])
    assert.equal(entries(t.changelog(), 'v1.1.0'), 1)
    t.done()
  })

  it('finishes after the GitHub release fails, without repeating anything', () => {
    const t = setup()
    writeFileSync(join(t.state, 'fail'), '')
    const broken = t.run('1.1.0')
    assert.equal(broken.status, 1)
    assert.match(broken.stderr, /re-run/)
    assert.equal(t.tagOnOrigin('v1.1.0'), 'v1.1.0')
    assert.deepEqual(t.created(), [])
    const head = git(t.work, 'rev-parse', 'HEAD')
    rmSync(join(t.state, 'fail'))
    expectOk(t.run('1.1.0'))
    assert.deepEqual(t.created(), ['v1.1.0'])
    assert.equal(git(t.work, 'rev-parse', 'HEAD'), head)
    assert.equal(entries(t.changelog(), 'v1.1.0'), 1)
    t.done()
  })

  it('--bump finishes the unfinished release instead of bumping again', () => {
    const t = setup()
    writeFileSync(join(t.state, 'fail'), '')
    assert.equal(t.run('--bump', 'minor').status, 1)
    assert.equal(t.version(), '1.1.0')
    rmSync(join(t.state, 'fail'))
    expectOk(t.run('--bump', 'minor'))
    assert.equal(t.version(), '1.1.0')
    assert.deepEqual(t.created(), ['v1.1.0'])
    expectOk(t.run('--bump', 'minor'))
    assert.equal(t.version(), '1.2.0')
    t.done()
  })

  it('stops before writing anything when the branch is behind', () => {
    const t = setup()
    const other = join(t.root, 'other')
    git(t.root, 'clone', '--quiet', t.bare, other)
    git(other, 'config', 'user.name', 'T')
    git(other, 'config', 'user.email', 't@example.com')
    git(other, 'commit', '--quiet', '--allow-empty', '-m', 'fix: elsewhere')
    git(other, 'push', '--quiet', 'origin', 'main')
    const r = t.run('1.1.0')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /behind origin/)
    assert.equal(t.version(), '1.0.0')
    assert.equal(existsSync(join(t.work, 'CHANGELOG.md')), false)
    assert.equal(git(t.work, 'tag', '--list'), '')
    t.done()
  })

  it('finishes a release that got ahead of a pull, like a rejected push', () => {
    const t = setup()
    expectOk(t.run('1.1.0', '--no-push'))
    const other = join(t.root, 'other')
    git(t.root, 'clone', '--quiet', t.bare, other)
    git(other, 'config', 'user.name', 'T')
    git(other, 'config', 'user.email', 't@example.com')
    git(other, 'commit', '--quiet', '--allow-empty', '-m', 'fix: elsewhere')
    git(other, 'push', '--quiet', 'origin', 'main')
    assert.match(t.run('1.1.0').stderr, /behind origin/)
    git(t.work, 'pull', '--quiet', '--no-rebase', '--no-edit', 'origin', 'main')
    expectOk(t.run('1.1.0'))
    assert.deepEqual(t.created(), ['v1.1.0'])
    assert.equal(git(t.bare, 'tag', '--list', 'v1.1.0'), 'v1.1.0')
    assert.equal(entries(t.changelog(), 'v1.1.0'), 1)
    assert.equal(git(t.work, 'rev-list', '--count', 'origin/main..HEAD'), '0')
    t.done()
  })

  it('finishes after a crash that left its files uncommitted', () => {
    const t = setup()
    writeFileSync(join(t.work, 'CHANGELOG.md'), addToChangelog('', '## v1.1.0 (2026-01-01)\n\nkept\n'))
    writeFileSync(join(t.work, 'package.json'), '{\n  "version": "1.1.0"\n}\n')
    expectOk(t.run('1.1.0'))
    assert.equal(git(t.bare, 'log', '-1', '--format=%s', 'main'), 'chore(release): v1.1.0')
    assert.match(t.changelog(), /kept/)
    assert.equal(git(t.work, 'status', '--porcelain'), '')
    t.done()
  })

  it('still refuses other uncommitted work, even when resuming', () => {
    const t = setup()
    writeFileSync(join(t.work, 'CHANGELOG.md'), addToChangelog('', '## v1.1.0 (d)\n\nx\n'))
    writeFileSync(join(t.work, 'notes.txt'), 'mine')
    const r = t.run('1.1.0')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /dirty/)
    t.done()
  })

  it('a dry run writes nothing', () => {
    const t = setup()
    const r = t.run('1.1.0', '--dry-run')
    expectOk(r)
    assert.match(r.stderr, /steps: {3}changelog, version, commit, tag, push-branch, push-tag, github-release/)
    assert.equal(t.version(), '1.0.0')
    assert.equal(git(t.work, 'status', '--porcelain'), '')
    t.done()
  })

  it('refuses a tag that differs from the one on origin', () => {
    const t = setup()
    git(t.work, 'commit', '--quiet', '--allow-empty', '-m', 'feat: a')
    git(t.work, 'tag', '-a', 'v1.1.0', '-m', 'one')
    git(t.work, 'push', '--quiet', 'origin', 'main', 'v1.1.0')
    git(t.work, 'tag', '-d', 'v1.1.0')
    git(t.work, 'commit', '--quiet', '--allow-empty', '-m', 'feat: b')
    git(t.work, 'tag', '-a', 'v1.1.0', '-m', 'two')
    const r = t.run('1.1.0')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /different commit/)
    t.done()
  })
})

