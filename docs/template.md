# Generic parts (template candidates)

Palikka was bootstrapped from Labyrinth (`Jukkakot/labyrinth@726698c`). The files below are
game-independent and could later move to a shared template repository or packages. Nothing is
extracted yet; keep these free of Palikka-specific names where it costs nothing, and add new
generic files here.

"As is" = copied unchanged apart from the project name. "Adapted" = copied, then changed in
Palikka-specific places (listed).

## Repository and tooling

| Path | Status | Palikka-specific parts |
|---|---|---|
| `package.json` (root), `tsconfig.base.json`, `.oxlintrc.json`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc` | as is | workspace names |
| `.vscode/` (launch, tasks, extensions) | adapted | client port 5183 |
| `.github/workflows/ci.yml`, `deploy-client.yml`, `prod-smoke.yml` | as is | workspace names; health URL from `vars.VITE_SERVER_URL` |
| `render.yaml` | as is | service name, dataset name |
| `tools/axiom/axiom.ps1`, `tools/axiom/dashboard.py` | as is | dataset name, event names in the filters |
| `.claude/hooks/lint-edited.mjs`, `.claude/settings.json`, `.mcp.json`, `.claude/skills/parallel-work/` | as is | workspace names, worktree path prefix |
| `.claude/CLAUDE.md` | adapted | names, ports, hot files, check chain |
| `openspec/config.yaml` | adapted | `context` block only; `rules` and `operations` as is |
| `openspec/context/nfr.md` | adapted | legal section, performance targets |
| `docs/README.md`, `development.md`, `operations.md` | adapted | URLs, ports, setup |

## Server (`server/`)

| Path | Status | Notes |
|---|---|---|
| `src/index.ts`, `app.config.ts`, `buildInfo.ts`, `cors.ts`, `watch.ts` | as is | port default, room registration |
| `src/logging/*` (pino + Axiom, client log intake, HTTP audit, framework logger, process handlers) | as is | event catalogue in `events.ts` |
| `src/rooms/LoggedRoom.ts`, `command.ts`, `roomId.ts` | as is | the room base, command wrapper and audit, readable room ids |
| `src/rooms/GameRoom.ts` | adapted | lobby/seats/host/bots/autoplay/kick/spectators/rematch are generic; the game engine calls (`startGame`, `applyPlace`, the bot turn) and the synced board are game-specific |
| `test/support/*`, `test/{lifecycle,lobby,rematch,spectators,errors,cors,logger,httpAudit,clientLogs,buildInfo,command}.test.ts` | as is | generic room and infra tests |

## Protocol (`packages/protocol/`)

| Path | Status | Notes |
|---|---|---|
| `log-events.ts`, `log-schema.ts`, `command.ts` | as is | |
| `game-codes.ts`, `game-schema.ts` | adapted | join options, nickname rule, close codes, lobby/bot/kick/speed/rematch payloads are generic; `PlacePayload`, `BOARD_CELLS_PER_SIDE`, `CELL_TAKEN`, `TURN_PHASES` are game-specific |

## Rules (`packages/rules/`)

| Path | Status | Notes |
|---|---|---|
| `rng.ts`, `turns.ts` | as is | seeded rng, next seat, kick rule, clock limits |
| everything else | game-specific | |

## Bots (`packages/bots`, `packages/palikka-bots`)

| Path | Status | Notes |
|---|---|---|
| `packages/bots/` (`game-bots`) | generic (new) | game interface, budget, greedy and random players, tournament core (schedule, pairwise results, Elo, Markdown report, requirement check); no game names, no dependencies; meant to become a shared package for all the browser games |
| `packages/palikka-bots/` | game-specific | the adapter pattern (`Game` over the rules, evaluation, `chooseMove`, `playGame`) is the part to copy |
| `packages/palikka-bots/cli/`, `strength.json` | adapted | tournament CLI (worker pool, tsx worker entry, report, JSON) and strength requirements: generic apart from the bot registry and formats they import |
| `.github/workflows/tournament.yml` | adapted | strength check on bot changes, tournament by hand; package name and paths are game-specific |

## Client (`client/`)

| Path | Status | Notes |
|---|---|---|
| `vite.config.ts`, `pwa-assets.config.ts`, `index.html` | adapted | name, colours, ports |
| `src/logging/*`, `src/i18n/index.ts`, `src/config.ts`, `src/CrashBoundary.tsx`, `src/main.tsx` | as is | |
| `src/session/*` (useGameSession, LocalRoom pattern, stores, serverWake, nickname, inviteLink, resume, useOpenGames, devShortcut) | adapted | the session, connector and resume logic are generic; `LocalRoom` command handling and `viewModel` are game-specific |
| `src/settings/*`, `src/tips/*` (mechanism), `src/ui/*` | as is | `ui/tokens.css` holds the game's theme |
| `src/screens/StartScreen.tsx`, `WaitingRoomScreen.tsx` | as is | |
| `src/game/{AutoplayControls,GameIdBadge,GameOverControls,KickControl,LeaveControls,SpectatorControls,TurnTimer,HintButton,UndoButton}.tsx`, `copyLine.ts`, `turnClock.ts` | as is | |
| `src/i18n/locales/*.json` | adapted | generic keys (start, waiting, errors, settings …) plus game texts |

## E2E (`e2e/`)

`playwright.config.ts`, `playwright.prod.config.ts`, `tests/helpers.ts`: as is (ports).
`tests/smoke.spec.ts`, `tests/prod.spec.ts`: adapted to the game's board.
