# Generic parts (template candidates)

Palikka was bootstrapped from Labyrinth (`Jukkakot/labyrinth@726698c`). The generic room,
session, device-game and bot logic is now the game kit in its own repository
(`Jukkakot/game-kit`, see [development.md](development.md#game-kit--implemented)); `game-template`
adds the copy template there. The files below are the remaining copy candidates; keep them free of
Palikka-specific names where it costs nothing, and add new generic files here.

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
| `src/index.ts`, `app.config.ts`, `buildInfo.ts`, `cors.ts` | as is | port default, room registration |
| `src/rooms/GameRoom.ts`, `schema/GameState.ts` | game-specific | the game's server definition and synced child on the kit's room |
| `test/support/*`, `test/{errors,cors,httpAudit,clientLogs,buildInfo}.test.ts` | as is | infra tests; the room suites run in the kit repo |
| In the kit now | — | `LoggedRoom`, `command.ts`, `roomId.ts`, `logging/*`, `watch.ts`, the generic room (`@game-kit/server`) |

## Protocol (`packages/protocol/`)

| Path | Status | Notes |
|---|---|---|
| `log-events.ts`, `log-schema.ts`, `game-codes.ts`, `game-schema.ts` | game-specific | re-export `@game-kit/protocol` and add the game's codes, move and options schemas and client events |

## Rules (`packages/rules/`)

| Path | Status | Notes |
|---|---|---|
| `rng.ts` | as is | seeded rng |
| `turns.ts` | game-specific | re-exports the kit's turn rules (`@game-kit/protocol`) |
| `contract.ts` | adapted | the contract's rules part: the pattern to copy, the calls are game-specific |
| everything else | game-specific | |

## Bots (`packages/palikka-bots`)

| Path | Status | Notes |
|---|---|---|
| In the kit now | — | `@game-kit/bots`: game interface, budget, players, the Web Worker harness, tournament core |
| `packages/palikka-bots/` | game-specific | the adapter pattern (`Game` over the rules, evaluation, `chooseMove`, `playGame`) is the part to copy |
| `packages/palikka-bots/cli/`, `strength.json` | adapted | tournament CLI (worker pool, tsx worker entry, report, JSON) and strength requirements: generic apart from the bot registry and formats they import |
| `.github/workflows/tournament.yml` | adapted | strength check on bot changes, tournament by hand; package name and paths are game-specific |

## Client (`client/`)

| Path | Status | Notes |
|---|---|---|
| `vite.config.ts`, `pwa-assets.config.ts`, `index.html` | adapted | name, colours, ports |
| `src/i18n/index.ts`, `src/config.ts`, `src/CrashBoundary.tsx`, `src/main.tsx`, `src/kit.ts` | as is | `kit.ts`: storage prefix and key events |
| `src/session/useGameSession.ts`, `palikkaClient.ts`, `viewModel.ts` | game-specific | the game's hook over `useKitSession`, client definition and view; `devShortcut.ts` as is |
| In the kit now | — | client logging, the stores, serverWake, nickname, inviteLink, resume, useOpenGames, `LocalRoom`, the bot runner, the session (`@game-kit/client`) |
| `src/settings/*`, `src/tips/*` (mechanism), `src/ui/*` | as is | `ui/tokens.css` holds the game's theme |
| `src/screens/StartScreen.tsx`, `WaitingRoomScreen.tsx` | as is | |
| `src/game/{AutoplayControls,GameIdBadge,GameOverControls,KickControl,LeaveControls,SpectatorControls,TurnTimer,HintButton,UndoButton}.tsx`, `copyLine.ts`, `turnClock.ts` | as is | |
| `src/motion/*` (board diff, `useLastMove`, `useEnded`, `useCountUp`, `useBlip`, `usePrevious`, `prefersReducedMotion`, `Snowfall`) | as is | no game names; `Snowfall` uses the `--snow` token |
| `src/i18n/locales/*.json` | adapted | generic keys (start, waiting, errors, settings …) plus game texts |

## E2E (`e2e/`)

`playwright.config.ts`, `playwright.prod.config.ts`, `tests/helpers.ts`: as is (ports).
`tests/smoke.spec.ts`, `tests/prod.spec.ts`: adapted to the game's board.
