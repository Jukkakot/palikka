# Proposal

## Why

The kit (`Jukkakot/game-kit`) now holds the generic room, lobby, session, device games and bots,
but everything around them (workspaces, screens, docs wiki, OpenSpec and `.claude` setup, CI and
deploy, E2E, tournament) still exists only as Palikka's own files. Starting a new game today means
copying Palikka by hand and stripping it. `connect-four` (roadmap 14) is the first outside user and
needs a one-command start.

## What Changes

All of it lands in the kit repository; Palikka only updates its wiki and roadmap.

- **`template/`** in the kit repo: a complete, runnable game project made from Palikka's generic
  files (`docs/template.md` lists them), with a tiny placeholder game (**Ristinolla**, tic-tac-toe,
  2 seats) implementing the game contract in the right places: rules package, protocol, server
  definition, client definition and board, bot adapter, tournament CLI and strength requirement.
  It includes the docs wiki, OpenSpec (config, context files, generic specs of the kit-provided
  behaviour, a starter roadmap), `.claude` (CLAUDE.md, hooks, settings, OpenSpec skills and
  commands, `parallel-work`), CI/deploy/prod-smoke/tournament workflows, `render.yaml`, Axiom
  tools, E2E smoke, and `tools/kit/` (`kit:use`, the local-spec check).
- A neutral placeholder theme (light and dark tokens); the generated roadmap starts with a `theme`
  change that agrees the real theme with mockups.
- **`create-game`** (`npm run create-game -- <name> ...` in the kit repo): copies the template to
  a new folder, replaces the names (package scope, title, storage prefix, Render service, Axiom
  dataset), the ports (server port given, client port = server + 2606, as in Labyrinth and
  Palikka) and the theme name, pins the kit's current release, runs `npm install`, makes the first
  git commit, and prints the setup checklist (GitHub repo, Render, Axiom, Pages, secrets and
  variables). It creates nothing outside the new folder.
- **Kit CI** generates a game from the template against the kit's own packages and runs its check
  chain, so the template cannot rot. E2E of the generated game runs there too.
- Palikka: `docs/template.md` points to the template and says how generic improvements flow into
  it; roadmap marks the item done.

Non-goals: moving the "as is" client components (ui, settings, screens, motion) into a kit
package — they stay copies for now; syncing existing games from the template (Palikka and
Labyrinth stay as they are); creating any external repository, service or account (that is part
of `connect-four`, with the user's go-ahead); an `npm create` package on a registry.

## Capabilities

### New Capabilities

None — no game behaviour of Palikka changes (`skip_specs: true`). The template's own generic
specs are files inside the template, not Palikka capabilities.

### Modified Capabilities

None.

## Impact

- Workspaces: none of Palikka's (rules, server, client) change.
- Kit repo: new `template/`, `tools/create-game.mjs`, a CI job, README and CLAUDE.md sections; a
  new kit release only if the template needs a kit fix.
- Palikka wiki: `docs/template.md`, `docs/development.md` (game kit section); `roadmap.md`.
