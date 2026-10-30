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
 * The pure parts — parseCommit, groupCommits, bumpSemver, renderNotes — are
 * exported and tested in release.test.mjs (`pnpm test:scripts`).
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

function main() {
  const { opts, version: versionArg } = cli(process.argv)

  const dry = opts.dryRun
  const noPush = !opts.push // commander sets push=false for --no-push
  const maxPerSection = opts.maxPerSection
  const wantBranchOpt = opts.allowBranch
  const trailers = opts.trailer ?? []

  // ---- 1. is this a safe place to release from ----
  const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const wantBranch = wantBranchOpt ?? 'main'
  if (branch !== wantBranch && !dry) {
    die(
      `On branch '${branch}', expected '${wantBranch}'. Pass --allow-branch ${branch} to override.`,
    )
  }
  if (sh('git', ['status', '--porcelain']) && !opts.allowDirty && !dry) {
    die('Working tree is dirty. Commit or stash first, or pass --allow-dirty.')
  }
  if (!noPush && !dry) {
    try {
      sh('gh', ['auth', 'status'])
    } catch {
      die('`gh` is not authenticated. Run `gh auth login`, or release with --no-push.')
    }
  }

  const remote = sh('git', ['remote', 'get-url', 'origin'])
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/.exec(remote)
  if (!match) die(`Cannot read a GitHub owner and repo from the remote '${remote}'.`)
  const [, owner, repo] = match
  const repoUrl = `https://github.com/${owner}/${repo}`

  // ---- 2. which version ----
  const pkgPath = resolve(ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  let lastTag = ''
  try {
    lastTag = sh('git', ['describe', '--tags', '--match', 'v*', '--abbrev=0'])
  } catch {
    lastTag = '' // no tag yet: this is the first release, so the whole history
  }
  const version = versionArg ?? bumpSemver(pkg.version ?? '0.0.0', opts.bump)
  const tag = `v${version}`
  if (sh('git', ['tag', '--list', tag])) die(`Tag ${tag} already exists.`)

  // ---- 3. what changed ----
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
  const raw = sh('git', ['log', range, '--no-merges', '--pretty=format:%H%x1f%s%x1f%b%x1e'])
  const records = (raw ? raw.split('\x1e') : [])
    .filter((record) => record.trim())
    .map((record) => {
      const [sha, subject, body] = record.split('\x1f')
      return { sha: sha.trim(), subject, body }
    })

  const date = new Date().toISOString().slice(0, 10)
  const buckets = groupCommits(records, repoUrl)
  const notes = renderNotes({ tag, date, buckets, repoUrl, lastTag, maxPerSection })

  // ---- 4. the plan, before anything is written ----
  console.warn(
    `\nRelease plan:\n  repo:    ${owner}/${repo}\n  branch:  ${branch}\n  from:    ${lastTag || '(first release)'}\n  version: ${pkg.version ?? '0.0.0'} → ${version}\n  tag:     ${tag}\n  commits: ${records.length}`,
  )
  console.warn('\n──────── release notes ────────')
  console.warn(notes)
  console.warn('───────────────────────────────\n')

  if (dry) {
    console.warn('--dry-run: nothing written. Re-run without it to cut the release.')
    return
  }

  // ---- 5. write ----
  pkg.version = version
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  const changelogPath = resolve(ROOT, 'CHANGELOG.md')
  const header = '# Changelog\n'
  const previous = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : header
  const rest = previous.startsWith(header)
    ? previous.slice(header.length).replace(/^\n+/, '')
    : previous
  writeFileSync(changelogPath, `${header}\n${notes}\n${rest}`)

  // Written before the tag so the annotation can carry the notes: `git show
  // <tag>` then tells the whole story without GitHub.
  const tmp = resolve(ROOT, '.tmp')
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true })
  const notesFile = resolve(tmp, `release-notes-${tag}.md`)
  writeFileSync(notesFile, notes)

  // ---- 6. commit and tag ----
  const message = [`chore(release): ${tag}`, '', ...trailers].join('\n')
  sh('git', ['add', 'package.json', 'CHANGELOG.md'])
  sh('git', ['commit', '-m', message], { capture: false })
  sh('git', ['tag', '-a', tag, '-F', notesFile], { capture: false })
  console.warn(`✔ Committed and tagged ${tag}; the notes are on the tag.`)

  if (noPush) {
    console.warn(
      `\n--no-push: stopped here. To finish:\n  git push origin ${branch} ${tag}\n  gh release create ${tag} --title ${tag} --notes-file ${relative(ROOT, notesFile)}\n`,
    )
    return
  }

  // ---- 7. push and announce ----
  // Pushed as two refs: --follow-tags skips the tag when the commit is already
  // upstream, which is exactly the case a release re-run hits.
  sh('git', ['push', 'origin', branch], { capture: false })
  sh('git', ['push', 'origin', tag], { capture: false })

  const args = [
    'release',
    'create',
    tag,
    '--title',
    tag,
    '--notes-file',
    notesFile,
    '--target',
    branch,
  ]
  if (opts.prerelease) args.push('--prerelease')
  sh('gh', args, { capture: false })
  console.warn(`\n✔ Released ${tag} → ${repoUrl}/releases/tag/${tag}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
