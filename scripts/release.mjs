#!/usr/bin/env node
/**
 * Cut a release: conventional-commit changelog, version stamp, tag, GitHub release.
 *
 * Nothing heavier than `git`, `gh` and commander, which carries the CLI surface
 * so a new flag is one declaration rather than hand-rolled argument parsing.
 *
 * Usage:
 *   pnpm release 1.0.0              # an exact version
 *   pnpm release --bump minor       # or bump the last one
 *   pnpm release:dry 1.0.0          # print the plan and the notes, write nothing
 *   pnpm release 1.0.0 --no-push    # commit and tag here, push it yourself
 *   pnpm release 1.0.0 --trailer "Reviewed-By: …"   # extra commit trailers
 *
 * Safe to run again. Each step checks whether it's already done, so if anything
 * breaks part-way (no network, a rejected push, a crash), fix it and re-run the
 * same command to finish. A release that's complete does nothing.
 *
 * The pure parts (parseCommit, groupCommits, bumpSemver, renderNotes, planSteps
 * and the changelog helpers) are exported, and the whole flow is tested against a
 * real git remote, in release.test.mjs (`pnpm test:scripts`).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, InvalidArgumentError, Option } from 'commander'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------- pure parts

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s(.+)$/

/** A conventional-commit subject, or null for anything else. */
export function parseCommit(subject) {
  const m = CONVENTIONAL.exec(subject ?? '')
  if (!m) return null
  return { type: m[1], scope: m[2], breaking: Boolean(m[3]), description: m[4] }
}

/** The sections a release is read in, in the order somebody reads them. */
export const GROUPS = [
  { key: 'breaking', title: '⚠ Breaking Changes' },
  { key: 'feat', title: '🚀 Features' },
  { key: 'fix', title: '🐛 Bug Fixes' },
  { key: 'perf', title: '⚡ Performance' },
  { key: 'refactor', title: '♻ Refactors' },
  { key: 'docs', title: '📝 Documentation' },
  { key: 'test', title: '✅ Tests' },
  { key: 'build', title: '📦 Build & CI' },
  { key: 'chore', title: '🔧 Chores' },
  { key: 'other', title: '📌 Other' },
]

/**
 * Sort commits into those sections.
 *
 * A breaking change leaves its own type and goes to the top, marked either way
 * it can be marked — nobody upgrading should have to find it under Refactors.
 * A release commit is skipped: it describes the last release, not this one.
 */
export function groupCommits(records, repoUrl) {
  const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]))

  for (const { sha, subject, body = '' } of records) {
    if (!subject || subject.startsWith('chore(release)')) continue
    const parsed = parseCommit(subject)
    const breaking = Boolean(parsed?.breaking) || /BREAKING[ -]CHANGE/.test(body)

    let type = parsed?.type ?? 'other'
    if (type === 'ci') type = 'build'
    if (!buckets[type]) type = 'other'

    const pr = /\(#(\d+)\)/.exec(subject)
    const description = (parsed?.description ?? subject).replace(/\s*\(#\d+\)\s*$/, '').trim()
    const prLink = pr ? ` [#${pr[1]}](${repoUrl}/pull/${pr[1]})` : ''
    const shaLink = sha ? ` [\`${sha.slice(0, 7)}\`](${repoUrl}/commit/${sha})` : ''
    const scope = parsed?.scope ? `**${parsed.scope}:** ` : ''

    buckets[breaking ? 'breaking' : type].push(`- ${scope}${description}${prLink}${shaLink}`)
  }

  return buckets
}

/** `1.2.3` → the next patch, minor or major, zeroing everything below it. */
export function bumpSemver(version, kind) {
  const [major = 0, minor = 0, patch = 0] = version
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/**
 * The release body, which is also the tag's annotation and the changelog entry.
 *
 * `maxPerSection` exists because GitHub refuses a body over ~125KB, and a first
 * release covering the whole history is well past it.
 */
export function renderNotes({ tag, date, buckets, repoUrl, lastTag, maxPerSection = 0 }) {
  let notes = `## ${tag} (${date})\n`
  if (lastTag) notes += `\n[Full changelog](${repoUrl}/compare/${lastTag}...${tag})\n`

  let any = false
  for (const group of GROUPS) {
    let lines = buckets[group.key] ?? []
    if (lines.length === 0) continue
    any = true
    let overflow = ''
    if (maxPerSection > 0 && lines.length > maxPerSection) {
      const hidden = lines.length - maxPerSection
      lines = lines.slice(0, maxPerSection)
      const where = lastTag
        ? ` — see the [full changelog](${repoUrl}/compare/${lastTag}...${tag})`
        : ''
      overflow = `\n- …and ${hidden} more${where}\n`
    }
    notes += `\n### ${group.title}\n\n${lines.join('\n')}\n${overflow}`
  }
  if (!any) notes += `\n_No conventional-commit changes since ${lastTag || 'the beginning'}._\n`
  return notes
}

/** This release's entry in a changelog, or null. */
export function changelogEntry(changelog, tag) {
  const escaped = tag.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')
  const start = new RegExp(`^## ${escaped} \\(`, 'm').exec(changelog)
  if (!start) return null
  const rest = changelog.slice(start.index)
  const next = rest.slice(1).search(/^## /m)
  return (next < 0 ? rest : rest.slice(0, next + 1)).trimEnd() + '\n'
}

const CHANGELOG_HEADER = '# Changelog\n'

/** A changelog with this entry at the top. */
export function addToChangelog(changelog, notes) {
  const previous = changelog || CHANGELOG_HEADER
  const rest = previous.startsWith(CHANGELOG_HEADER)
    ? previous.slice(CHANGELOG_HEADER.length).replace(/^\n+/, '')
    : previous
  return `${CHANGELOG_HEADER}\n${notes}\n${rest}`
}

/** What's left to do, in order, given what's already been done. */
export function planSteps(done) {
  const steps = []
  if (!done.changelog) steps.push('changelog')
  if (!done.version) steps.push('version')
  if (!done.committed) steps.push('commit')
  if (!done.tagged) steps.push('tag')
  if (done.noPush) return steps
  if (!done.branchPushed) steps.push('push-branch')
  if (!done.tagPushed) steps.push('push-tag')
  if (!done.released) steps.push('github-release')
  return steps
}

// ------------------------------------------------------------------ the flow

const sh = (cmd, args, { capture = true } = {}) =>
  execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })?.trim()

const die = (message) => {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function cli(argv) {
  const program = new Command()
  program
    .name('release')
    .description(
      'Cut a release: conventional-commit changelog, version stamp, tag, GitHub release.',
    )
    .argument('[version]', 'exact version to release, e.g. 1.0.0 (omit to use --bump)', (value) => {
      if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(value)) {
        throw new InvalidArgumentError(`'${value}' is not a semver version (x.y.z).`)
      }
      return value
    })
    .addOption(
      new Option('-b, --bump <kind>', 'bump the last version instead of naming one')
        .choices(['patch', 'minor', 'major'])
        .default('patch'),
    )
    .option('-n, --dry-run', 'print the plan and the notes, write nothing', false)
    .option('--no-push', 'commit and tag here; push and announce it yourself')
    .option('--prerelease', 'mark the GitHub release as a pre-release', false)
    .option('--allow-dirty', 'skip the clean-working-tree check', false)
    .option('--allow-branch <name>', 'release from a branch other than main')
    .addOption(
      new Option(
        '--max-per-section <n>',
        "cap items per section (0 = every one; keeps a first release under GitHub's ~125KB body limit)",
      )
        .default(0)
        .argParser((value) => {
          const n = Number.parseInt(value, 10)
          if (Number.isNaN(n) || n < 0) throw new InvalidArgumentError('must be zero or more.')
          return n
        }),
    )
    .option('--trailer <line...>', 'extra trailers for the release commit message', [])
    .showHelpAfterError()
    .parse(argv)

  return { opts: program.opts(), version: program.processedArgs[0] }
}

const attempt = (cmd, args) => {
  try {
    return sh(cmd, args)
  } catch {
    return null
  }
}

function main() {
  const { opts, version: versionArg } = cli(process.argv)
  const dry = opts.dryRun
  const noPush = !opts.push // commander sets push=false for --no-push
  const trailers = opts.trailer ?? []

  // ---- 1. where are we ----
  const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const wantBranch = opts.allowBranch ?? 'main'
  if (branch !== wantBranch && !dry) {
    die(
      `On branch '${branch}', expected '${wantBranch}'. Pass --allow-branch ${branch} to override.`,
    )
  }
  if (!noPush && !dry && attempt('gh', ['auth', 'status']) === null) {
    die('`gh` is not authenticated. Run `gh auth login`, or release with --no-push.')
  }
  // The address as configured: rewrites like insteadOf aren't the repo's name.
  const remote = sh('git', ['config', '--get', 'remote.origin.url'])
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/.exec(remote)
  if (!match) die(`Cannot read a GitHub owner and repo from the remote '${remote}'.`)
  const [, owner, repo] = match
  const repoUrl = `https://github.com/${owner}/${repo}`

  // Before anything is written: a push that's going to be rejected should stop here.
  if (attempt('git', ['fetch', '--quiet', 'origin', branch]) === null && !noPush && !dry) {
    die(`Can't reach origin to check '${branch}'. Fix that and re-run.`)
  }
  const upstream = `refs/remotes/origin/${branch}`
  const hasUpstream = attempt('git', ['rev-parse', '--verify', '--quiet', upstream]) !== null
  const count = (range) => Number(sh('git', ['rev-list', '--count', range]))
  if (hasUpstream && count(`HEAD..${upstream}`) > 0 && !dry) {
    die(`'${branch}' is behind origin. Run \`git pull\`, then re-run this command.`)
  }

  // ---- 2. which version: an unfinished release comes before a new one ----
  const pkgPath = resolve(ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const changelogPath = resolve(ROOT, 'CHANGELOG.md')
  const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : ''
  const released = (t) => !noPush && attempt('gh', ['release', 'view', t, '--json', 'tagName']) !== null
  const localTag = (t) => attempt('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${t}^{commit}`])
  const releaseCommit = (t) =>
    sh('git', ['log', '-1', '--format=%H', '--fixed-strings', `--grep=chore(release): ${t}`])

  const current = `v${pkg.version ?? '0.0.0'}`
  const startedCurrent =
    !!changelogEntry(changelog, current) || !!localTag(current) || !!releaseCommit(current)
  const version =
    versionArg ??
    (startedCurrent && !released(current)
      ? pkg.version
      : bumpSemver(pkg.version ?? '0.0.0', opts.bump))
  const tag = `v${version}`

  // ---- 3. what's already done ----
  const existing = localTag(tag)
  const commit = releaseCommit(tag)
  const remoteTags = attempt('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`])
  const remoteTag = (remoteTags ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0]
  if (remoteTag && existing && remoteTag !== existing) {
    die(`Tag ${tag} on origin is a different commit from the one here. Sort that out by hand.`)
  }
  const entry = changelogEntry(changelog, tag)
  const done = {
    changelog: !!entry,
    version: pkg.version === version,
    committed: !!commit,
    tagged: !!existing,
    noPush,
    tagPushed: !!remoteTag,
    released: released(tag),
  }
  const started = done.changelog || done.committed || done.tagged || done.tagPushed

  // Only what a release writes may be uncommitted, and only part-way through one.
  const dirty = sh('git', ['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .filter((line) => !(started && /^\S{1,2} +(package\.json|CHANGELOG\.md)$/.test(line)))
  if (dirty.length && !opts.allowDirty && !dry) {
    die(`Working tree is dirty. Commit or stash first, or pass --allow-dirty.\n${dirty.join('\n')}`)
  }

  // ---- 4. what changed: once written, the changelog is the record ----
  let lastTag = ''
  try {
    lastTag = sh('git', ['describe', '--tags', '--match', 'v*', '--exclude', tag, '--abbrev=0'])
  } catch {
    lastTag = '' // no tag yet: this is the first release, so the whole history
  }
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
  const raw = sh('git', ['log', range, '--no-merges', '--pretty=format:%H%x1f%s%x1f%b%x1e'])
  const records = (raw ? raw.split('\x1e') : [])
    .filter((record) => record.trim())
    .map((record) => {
      const [sha, subject, body] = record.split('\x1f')
      return { sha: sha.trim(), subject, body }
    })
  const date = new Date().toISOString().slice(0, 10)
  const notes =
    entry ??
    renderNotes({
      tag,
      date,
      buckets: groupCommits(records, repoUrl),
      repoUrl,
      lastTag,
      maxPerSection: opts.maxPerSection,
    })

  // Whether the branch is pushed depends on the commit, which may not exist yet.
  const plan = () =>
    planSteps({
      ...done,
      branchPushed: done.committed && hasUpstream && count(`${upstream}..HEAD`) === 0,
    })
  const steps = plan()
  if (!steps.length) {
    console.warn(`\n✔ ${tag} is already released. Nothing to do.\n`)
    return
  }

  console.warn(
    `\nRelease plan${started ? ' (resuming)' : ''}:\n  repo:    ${owner}/${repo}\n  branch:  ${branch}\n  from:    ${lastTag || '(first release)'}\n  version: ${pkg.version ?? '0.0.0'} → ${version}\n  tag:     ${tag}\n  commits: ${records.length}\n  steps:   ${steps.join(', ')}`,
  )
  console.warn('\n──────── release notes ────────')
  console.warn(notes)
  console.warn('───────────────────────────────\n')
  if (dry) {
    console.warn('--dry-run: nothing written. Re-run without it to cut the release.')
    return
  }

  // ---- 5. write. The changelog goes first: if this stops before the version is
  // written, a re-run with --bump works out the same next version. ----
  if (!done.changelog) writeFileSync(changelogPath, addToChangelog(changelog, notes))
  if (!done.version) {
    pkg.version = version
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  }

  // Written before the tag so the annotation can carry the notes: `git show
  // <tag>` then tells the whole story without GitHub.
  const tmp = resolve(ROOT, '.tmp')
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
  const notesFile = resolve(tmp, `release-notes-${tag}.md`)
  writeFileSync(notesFile, notes)

  // ---- 6. commit and tag ----
  let target = commit
  if (!done.committed) {
    const message = [`chore(release): ${tag}`, '', ...trailers].join('\n')
    sh('git', ['add', 'package.json', 'CHANGELOG.md'])
    sh('git', ['commit', '--allow-empty', '-m', message], { capture: false })
    target = sh('git', ['rev-parse', 'HEAD'])
    done.committed = true
  }
  if (!done.tagged) {
    sh('git', ['tag', '-a', tag, '-F', notesFile, target], { capture: false })
    done.tagged = true
    console.warn(`✔ Committed and tagged ${tag}; the notes are on the tag.`)
  }

  if (noPush) {
    console.warn(
      `\n--no-push: stopped here. To finish, re-run without it, or:\n  git push origin ${branch} ${tag}\n  gh release create ${tag} --title ${tag} --notes-file ${relative(ROOT, notesFile)}\n`,
    )
    return
  }

  // ---- 7. push and announce ----
  const stopped = (what) =>
    die(`${what} failed. Everything before it is kept: fix it and re-run this command.`)
  // Pushed as two refs: --follow-tags skips the tag when the commit is already upstream.
  if (plan().includes('push-branch')) {
    try {
      sh('git', ['push', 'origin', branch], { capture: false })
    } catch {
      stopped(`Pushing '${branch}'`)
    }
  }
  if (!done.tagPushed) {
    try {
      sh('git', ['push', 'origin', tag], { capture: false })
    } catch {
      stopped(`Pushing ${tag}`)
    }
  }
  if (!done.released) {
    const args = ['release', 'create', tag, '--title', tag, '--notes-file', notesFile, '--verify-tag']
    if (opts.prerelease) args.push('--prerelease')
    try {
      sh('gh', args, { capture: false })
    } catch {
      stopped('Creating the GitHub release')
    }
  }
  console.warn(`\n✔ Released ${tag} → ${repoUrl}/releases/tag/${tag}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
