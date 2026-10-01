# Proposal

## Why

`game-contract` made the room, lobby, bot runner, session and device games generic, but they still
live inside Palikka's repo, so no other game can use them. Moving the kit and the bot library to
their own repository, with their own CI and releases, is the step before `game-template` and
`connect-four` (the kit's first outside user).

## What Changes

- New public GitHub repository `Jukkakot/game-kit` (npm workspaces, TypeScript) holding
  `@game-kit/protocol`, `@game-kit/server`, `@game-kit/client` and the bot library, renamed
  **`game-bots` → `@game-kit/bots`**. Its suites keep running over the Connect Four test game.
- The kit gets its own CI (lint, typecheck, test, build on every push) and a release workflow: a
  pushed tag `v<version>` builds the packages and attaches `npm pack` tarballs to a GitHub Release.
  One version for all four packages; releasing is one command.
- Palikka drops `packages/kit-*` and `packages/bots` and depends on the release tarballs of one
  kit version. A script switches that version (`kit:use <version>`) or points Palikka at a local
  kit checkout for working on both at once (`kit:use local`); a check keeps local paths out of
  commits.
- Libraries whose objects cross the kit boundary (React, Colyseus and its schema and SDK, zod)
  become peer dependencies of the kit, so the game and the kit always share one copy.
- Palikka's lint boundary rule, CI paths and wiki follow the move. Gameplay, the wire and the UI
  are unchanged.

Non-goals: the copy-template files (CI/deploy workflows, docs wiki, `.claude`, OpenSpec, generic
client components, tournament CLI) — that is `game-template`. Publishing to npmjs or GitHub
Packages, a changelog or strict semver process. Labyrinth is not touched.

## Capabilities

### New Capabilities

None — no observable game behaviour changes (`skip_specs: true`).

### Modified Capabilities

None.

## Impact

- Workspaces: `server`, `client`, `packages/rules`, `packages/protocol`, `packages/palikka-bots`
  change their dependency declarations and the `game-bots` imports; `packages/kit-*` and
  `packages/bots` leave the repo.
- New external repository and GitHub Releases (the user approved creating it, public).
- Root `package.json`, `package-lock.json`, `.oxlintrc.json`, `.github/workflows/`
  (`deploy-client.yml`, `tournament.yml`), new `tools/kit/`.
- Wiki: `docs/architecture.md`, `docs/development.md`, `docs/operations.md`, `docs/template.md`;
  `roadmap.md`.
