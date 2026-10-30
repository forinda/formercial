# Releasing

One command, run from `main`:

```bash
pnpm release 0.1.0            # an exact version
pnpm release --bump minor     # or bump the current one
pnpm release:dry 0.1.0        # print the plan and the notes, write nothing
pnpm release --help
```

## Versioning

SemVer, with tags as `v<version>`. Formercial isn't published to a registry: people clone it, so a release is a tag, a changelog entry and a GitHub release.

## If it breaks part-way

Re-run the same command. Each step checks whether it's already done, so a lost connection, a rejected push or a crash can't double-tag or double-bump, and a finished release does nothing:

```bash
pnpm release 0.2.0            # fails while creating the GitHub release
pnpm release 0.2.0            # finds the rest done, and creates only that
```

`pnpm release --bump minor` is just as safe: it finishes an unfinished release before starting a new one. Use `pnpm release:dry` to see which steps are left.

It stops before writing anything if your branch is behind origin. Run `git pull`, then re-run. It also stops if a tag on origin points somewhere other than the one here, because that needs a person to decide.

## What the command does

1. Refuses to run unless you're on `main`, the tree is clean, `gh` is signed in and the tag is free. `--allow-branch`, `--allow-dirty` and `--no-push` each lift one of those.
2. Reads the conventional commits since the last `v*` tag and groups them. A breaking change, written `feat(x)!:` or with `BREAKING CHANGE:` in the body, goes to the top. `chore(release)` commits are skipped.
3. Writes `CHANGELOG.md`, sets the version in `package.json`, and commits as `chore(release): v<version>`.
4. Makes an annotated tag with the release notes as its message, so `git show v0.1.0` tells the whole story without GitHub.
5. Pushes the branch and the tag, then opens the GitHub release with the same notes.

## Notes

- **A long range needs `--max-per-section 25`.** GitHub refuses a release body over about 125 KB. Capped sections show the first 25 and link the full comparison, and so does the matching `CHANGELOG.md` entry.
- **Commit messages are the changelog.** `feat: scene clips can be dragged` is a line someone can read in the release. `wip` lands under Other, word for word.
- **The parsing is tested** with `pnpm test:scripts`. The grouping, bumping and rendering are plain functions. The git and `gh` calls around them aren't tested, which is why `--dry-run` exists.
