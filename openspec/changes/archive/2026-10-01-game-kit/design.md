# Design

## Context

See proposal.md → Why. Today the kit is four workspaces in this repo (`packages/kit-protocol`,
`kit-server`, `kit-client`, `packages/bots` = `game-bots`). Every workspace exports a `source`
condition pointing at `src/`, which Vite, Vitest and `tsx` use so no build is needed between
packages; the server's production build uses `dist/` (`customConditions: []`). The kit's boundary is
enforced by an oxlint override and `kit-protocol/test/boundary.test.ts`. Palikka is public; the
budget is 0 EUR. The user wants a light process: agile co-development, no versioning ceremony
(memory: kit-distribution).

## Goals / Non-Goals

**Goals:** the kit builds, tests and releases on its own; Palikka installs exactly one kit version
reproducibly (lockfile) in CI, Render and Pages without tokens; working on kit and game together
stays a short loop.

**Non-Goals:** keeping the kit's git history (see D7); OpenSpec or a wiki inside the kit repo
(`game-template` decides how kit changes are specced; until then they are specced here); changing
any kit API.

## Decisions

### D1 Kit repository layout

`Jukkakot/game-kit`, public, npm workspaces: `packages/protocol` (`@game-kit/protocol`),
`packages/server` (`@game-kit/server`), `packages/client` (`@game-kit/client`), `packages/bots`
(`@game-kit/bots`, was `game-bots`). Root: `package.json` (workspaces, scripts `lint`,
`typecheck`, `test`, `build`, `pack`, `release`), `tsconfig.base.json`, `.oxlintrc.json`,
`.nvmrc`, `.editorconfig`, `.gitattributes`, `.gitignore` — copied from Palikka. Packages keep
their `source` condition inside the kit repo, so the kit's own dev loop is unchanged. A short
`README.md` (what the packages are, the game contract in one paragraph with a pointer to the
Connect Four test game, how to release, how a game uses a version or a local checkout) and a short
`.claude/CLAUDE.md` (check chain, boundary, release command, "talk Finnish") are the kit's only
docs for now.

The boundary rules move with the packages: the kit's oxlint override forbids relative imports
leaving a package (`^(\.\./){3,}`) and any game's names; `boundary.test.ts` keeps checking
relative imports. `@game-kit/bots` must not import the other kit packages (it stays dependency-free).

### D2 Distribution: GitHub Release tarballs (chosen by the user)

A tag `v<version>` triggers `release.yml` in the kit: `npm ci`, the check chain, `npm run pack`,
then `gh release create v<version> .release/*.tgz` (GITHUB_TOKEN, `contents: write`). Palikka's
workspaces depend on URLs like
`https://github.com/Jukkakot/game-kit/releases/download/v0.1.0/game-kit-server-0.1.0.tgz`.

Alternatives: npmjs (needs an account and a token), GitHub Packages (needs a token even for
public packages, also on Render), git submodule (clumsy in CI, worktrees and Render), git
dependency (npm cannot install a subdirectory of a monorepo). The user may revisit this later.

### D3 What a packed package looks like

`tools/pack.mjs` (kit) builds each package, copies it to a staging folder and rewrites its
`package.json` before `npm pack`:
- drops the `source` condition from `exports` (the tarball has no `src/`; a game's Vite/tsx
  `source` condition would otherwise point at missing files) — consumers get `dist/` with
  declarations and source maps;
- rewrites internal `@game-kit/*` dependencies (`"*"` in the repo) to the tarball of the same
  version: the release URL in release mode, `file:<absolute path>` in local mode (D5);
- removes `private: true`.

All four packages share one version (lockstep), set by `npm run release -- <version>`, which
writes the version into every `package.json`, runs the check chain, commits `chore: release
v<version>`, tags and pushes. No changelog; the GitHub Release gets generated notes.

### D4 Shared libraries are peers

Objects of these libraries cross the kit boundary, so a second copy would break things (React
hooks, Colyseus schema decoding, zod schema composition): `react` (already a peer of
`@game-kit/client`), `colyseus` and `@colyseus/schema` (`@game-kit/server`), `@colyseus/sdk`
(`@game-kit/client`), `zod` (`@game-kit/protocol`, `@game-kit/server`). They become
`peerDependencies` with the current ranges and stay `devDependencies` in the kit for its tests.
Palikka's workspaces already declare all of them directly. Other dependencies (pino, express,
human-id, express-rate-limit, @axiomhq/pino) stay regular dependencies.

### D5 Palikka's side: `tools/kit/use.mjs`

- `npm run kit:use -- <version>`: rewrites every `@game-kit/*` spec in Palikka's workspace
  `package.json` files to that version's release URLs and runs `npm install`. Only workspaces that
  import a kit package declare it (as today: `server`, `client`, `rules`, `protocol`,
  `palikka-bots`); npm dedupes identical URLs into the root `node_modules`.
- `npm run kit:use -- local [path]` (default `../game-kit`): runs the kit's `npm run pack -- --local`
  there and points the specs at the produced tarballs with `file:` paths. What runs locally is
  exactly what a release would ship. Loop for a kit edit: edit in the kit → `kit:use local` in
  Palikka (one command, a few seconds) → test. When done: release the kit, then
  `kit:use <version>`.
- `npm run lint` also runs `node tools/kit/check.mjs`, which fails when any workspace
  `package.json` or the lockfile has a `file:` kit spec, so a local setup is never committed.
- Imports `game-bots` / `game-bots/worker` become `@game-kit/bots` / `@game-kit/bots/worker`.
- Palikka's `.oxlintrc.json` drops the `packages/kit-*` override; the root workspace list drops the
  four kit workspaces; `deploy-client.yml` drops `-w game-bots`; `tournament.yml` drops the
  `packages/bots/**` paths (a kit bump shows up in `package-lock.json`, which already triggers it).
  The deploy-server path list already includes `package-lock.json`, so a kit bump deploys the
  server.

### D6 First release and switch-over order

1. Create the repo, copy the four packages (renaming folders and `game-bots`), root files, CI
   and release workflows, README and CLAUDE.md; `npm install`, check chain green; push; CI green.
2. `npm run release -- 0.1.0` → Release `v0.1.0` with four tarballs.
3. In Palikka: remove the kit workspaces, `kit:use 0.1.0`, rename the bot imports, check chain
   and E2E green, commit and push.

If step 2's tarballs turn out wrong, fix in the kit and release `0.1.1` — never re-tag.

### D7 Fresh history

The kit repo starts with one commit "feat: game kit from Palikka@<sha>" instead of a filtered
history (`git filter-repo` would need a Python tool install and path renames for little value;
the history stays readable in Palikka).

### D8 nfr

- Logging: unchanged; the kit's logging code moves as is, event names unchanged.
- Tests: each suite runs where its code lives — the kit's (over Connect Four) in the kit CI,
  Palikka's in Palikka's check chain; no test is duplicated or dropped. Palikka's E2E smoke covers
  the installed tarballs end to end. The kit's CI is its gate for releases.
- Limits: the client bundle now takes the kit as built `dist/` instead of source; the size budget
  stays and is soft (memory: hobby-tradeoffs) — a small change is accepted and noted.
- Versioning (nfr → Versioning): unaffected; the server still reports its own version. The kit
  version shows in Palikka's `package.json`.

## Risks / Trade-offs

- [A kit edit needs a release before Palikka can push it] → `kit:use local` for development;
  releasing is one command. Accepted per the user's light-process wish.
- [Two copies of a peer library sneak in via a range mismatch] → peers (D4); the apply checks
  `npm ls react @colyseus/schema zod colyseus @colyseus/sdk` shows one copy each.
- [GitHub release downloads redirect; Render or `npm ci` fails on them] → check `npm ci` from a
  clean clone in Palikka's CI before deleting anything in step 3; fallback: commit the tarballs
  into Palikka under `vendor/game-kit/` and use `file:` specs (still no token).
- [Vite pre-bundling of linked or new deps behaves differently in dev] → UI check with
  `/?dev=1v3` and the E2E smoke after the switch.

## Migration Plan

D6 above. Rollback: revert Palikka's switch-over commit (the kit workspaces come back from git);
the kit repo can stay.
