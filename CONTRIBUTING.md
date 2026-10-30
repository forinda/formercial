# Contributing

Thanks for helping. Bug reports, fixes, new blocks, render drivers, voice providers, docs and example projects are all welcome.

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](LICENSE), as section 5 of the license says. You keep the copyright to what you write. No separate agreement is needed.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **A bug:** open an issue with steps to reproduce. Attach a `project.json` that shows it, if you can.
- **A security problem:** don't open an issue. See [SECURITY.md](SECURITY.md).
- **Something bigger** (a new block type, a change to `project.json`, a new driver API): open an issue first, so we can agree on the shape before you write it. Changes to `project.json` affect every project people already have.

## Setting up

You need Node 22+, pnpm, ffmpeg and ffprobe. For render tests you also need a Chromium (`npx playwright install chromium-headless-shell`, or set `CHROME`). edge-tts is only needed to try generated voice by hand.

```bash
git clone https://github.com/forinda/formercial.git
cd formercial
pnpm install
pnpm dev                 # the editor
pnpm test                # all tests (render tests skip without Chromium/ffmpeg)
pnpm exec tsc --noEmit
pnpm exec oxlint src
pnpm exec oxfmt src      # format; CI checks with --check
```

Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Making a change

1. Branch from `main`.
2. Write the test first, watch it fail, then make it pass. Every behavior change comes with a test that fails without it.
3. Keep the player deterministic: anything it draws must follow from `t` alone, with no timers, clocks or CSS transitions. The test `same t gives the same DOM` guards this.
4. Run `pnpm test`, `tsc --noEmit`, `oxlint src` and `oxfmt --check src`. CI runs the same.
5. Commit with a [conventional](https://www.conventionalcommits.org/) message: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
6. Open a pull request and fill in the template. Say what changed for a person using the app, and how you checked it.

If your change affects what a render looks like, attach a frame or a short clip to the pull request.

## Code style

- TypeScript, formatted by oxfmt (no semicolons, single quotes, 100 columns).
- Import across folders through the `@/` alias (`@/core/project`). Use `./` inside a folder.
- `src/core` has no framework code, so the server and the CLI can share it. `src/player` runs in the browser only.
- Comments say why, not what. Name things by what people recognise ("recording", "caption"), not how they're built.
- Prefer the platform and what's already here over a new dependency.

## Common contributions

### A new block

1. Add its fields to `BlockSchema` in `src/core/project.ts`.
2. Add `needs()` and `mount()` to `BLOCKS` in `src/player/blocks.ts`. `mount` builds the DOM once and returns `draw(local)`, which sets everything from the scene's local time.
3. Add its styles to `src/player/styles.ts`, sized in `var(--u)` so they work in all three formats.
4. Add its form to `BlockForm` in `src/client/editor/scenes.tsx`.
5. Add tests in `src/player/player.test.ts`: at least what it shows at a given `t`.

### A render driver or voice provider

Write it against `RenderDriver` (`src/core/render/driver.ts`) or `VoiceProvider` (`src/core/voice/provider.ts`). A driver should:

- report missing tools from `check()`;
- use the timeline it's given rather than working out its own;
- write its files under the work folder it's handed.

It's usually best to publish a driver as its own package that people add in `src/formercial.config.ts`. Open an issue if you think it belongs here.

### An example project

Add it under `projects/<name>/`. Use fonts with a license that allows redistribution (Google Fonts are fine), and only media you have the right to share.

## Reviews

A maintainer reviews every pull request. Expect questions: they're about the change, not about you. Small pull requests get reviewed sooner.
