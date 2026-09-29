## Why

A new game needs its whole foundation (monorepo, server, lobby, bots, device games, logging, CI and
deploy, instructions) before any rule is written. Labyrinth already has a proven, game-independent
foundation; copying it is far cheaper than building one.

## What Changes

- Import Labyrinth (`Jukkakot/labyrinth@726698c`) and rename it to Palikka (`@palikka/*`).
- Replace the Labyrinth rules and game UI with a minimal placeholder game ("claim a cell": 20×20
  board, one square per turn, five turns each, most squares wins) so lobby → game → end, bots,
  device games, spectators, rematch and the daily puzzle run end to end and deploy.
- Drop Labyrinth-only features: pawn looks, move confirmations, tile and treasure UI, best-route
  replay.
- Theme "Kuura" (light and dark tokens, icon, playful Finnish/English texts, bot names).
- Own dev ports (server 2577, client 5183); CI health checks read the `VITE_SERVER_URL` variable.
- Instructions and knowledge: `.claude/CLAUDE.md`, OpenSpec init, `openspec/context/*` rewritten
  for Palikka, the wiki, and `docs/template.md` listing the generic files.

## Capabilities

### New Capabilities

None as specs: the placeholder game is temporary and is replaced by `rules-engine` and
`game-room`, which write the real specs.

### Modified Capabilities

None.

## Impact

All workspaces (rules, protocol, server, client, e2e), CI workflows, docs and OpenSpec context.
One-time manual setup outside the repo (GitHub repo and Pages, Render service and deploy hook,
Axiom dataset and token): `docs/operations.md` → One-time setup.
