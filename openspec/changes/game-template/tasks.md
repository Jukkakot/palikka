# Tasks

Template work happens in the kit checkout `../game-kit` (push to its `main`, same commit
conventions). Copy from Palikka at the current `main`; `docs/template.md` is the map of what is
generic. Run the kit's `npm run check` before each kit commit and the generated game's check chain
where a task says so.

## 1. Template skeleton

- [ ] 1.1 Create `template/` with the root files (`package.json` workspaces, `tsconfig.base.json`, `.oxlintrc.json`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, `.vscode/`), `tools/kit/` (use, check, workspaces), `tools/axiom/`, `render.yaml`, written with the D3 placeholder names and ports; exclude `template/` from the kit's workspaces, lint and typecheck; verify the kit's `npm run check` still passes
- [ ] 1.2 Write `tools/create-game.mjs` and the `create-game` script (D4: argument checks, copy, D3 replacement in contents and paths, `kit:use`, `git init` + first commit, printed checklist); verify on the skeleton that a bad name, a missing `--port` and a non-empty `--dir` are refused with a clear message, and that a run into the scratchpad produces no D3 leftovers

## 2. Placeholder game Ristinolla

- [ ] 2.1 `packages/rules`: Ristinolla rules (board, legal moves, win/draw, `rng.ts` as is) and `contract.ts` implementing the kit's `GameRules` the way Palikka's does; unit tests for win lines, draw, illegal moves and the contract (seats, start, fallback move); verify `npm test -w @starter-game/rules` in a generated game
- [ ] 2.2 `packages/protocol`: game codes, move and options schemas, client log events over `@game-kit/protocol`, with schema tests; `server`: `src/index.ts`, `app.config.ts`, `buildInfo.ts`, `cors.ts`, the game's `GameRoom.ts` definition and synced schema, the copied infra tests; verify the server tests pass and `npm run dev` serves `/health` on the template port
- [ ] 2.3 `packages/starter-game-bots`: adapter over `@game-kit/bots` (game interface, evaluation, `chooseMove`, `playGame`), tournament CLI and `strength.json` with one requirement the bot meets reliably (D2); `tournament.yml`; verify the adapter test and `npm run strength` (or the CLI's equivalent) pass

## 3. Client

- [ ] 3.1 Copy the "as is" client files (`main.tsx`, `config.ts`, `CrashBoundary`, `kit.ts`, `i18n/index.ts`, `settings/*`, `tips/*`, `ui/*`, `motion/*`, the generic `game/*` controls, `copyLine.ts`, `turnClock.ts`, `devShortcut.ts`) and `vite.config.ts`, `pwa-assets.config.ts`, `index.html`, neutral icons; neutral placeholder theme tokens in `ui/tokens.css` with a designed dark variant (D5); verify `npm run typecheck -w @starter-game/client`
- [ ] 3.2 Ristinolla client: client definition, `useGameSession`, view model, a tappable 3×3 board with one deliberate confirm, `StartScreen` (two ways in, nickname, open games, continue; no variants or puzzle), `WaitingRoomScreen`, `GameScreen` shell (player strip, turn line, timer, controls, result); fi + en locales with only generic and Ristinolla keys; logic tests and the key render tests (start, waiting room, a move); verify the client tests and `npm run size`
- [ ] 3.3 UI check of a generated game on its dev server (Playwright mobile portrait, light and dark): start screen, a device game against a bot to the end, `/?dev=1v1`; verify no console errors, tap targets ≥ 44 px, no horizontal scroll

## 4. E2E, CI and deploy files

- [ ] 4.1 `e2e/` (configs, helpers, `smoke.spec.ts`: a bot game on the device and a two-player online game to the end; `prod.spec.ts`), `.github/workflows/ci.yml`, `deploy-client.yml`, `prod-smoke.yml`, all with the placeholder names; verify `npm run e2e` passes in a generated game
- [ ] 4.2 Kit CI job `template` and `npm run template:check` (D6: pack local, generate `ci-game`, check chain, size, E2E, leftover check; skip the local-spec check); push and verify the job is green with `gh run list`; verify the leftover check fails when a `palikka` string is planted, then remove it

## 5. OpenSpec, wiki and `.claude` in the template

- [ ] 5.1 `openspec/config.yaml` (generic `context`, Palikka's `rules` and `operations`), `context/product.md` skeleton, `context/nfr.md`, starter `context/roadmap.md` (D5); verify `openspec list` and `openspec validate --all` pass in a generated game
- [ ] 5.2 Generic specs `start-screen`, `game-room`, `bot-seats`, `device-games` written game-neutrally from Palikka's (D5); verify `openspec validate --specs` passes and `grep -ri "palikka\|kuura\|duo\|variant\|puzzle"` finds nothing in them
- [ ] 5.3 `docs/README.md`, `architecture.md`, `development.md`, `operations.md` (with the D7 checklist) adapted; verify every relative link resolves in a generated game
- [ ] 5.4 `.claude/` (`CLAUDE.md` with autopilot OFF, template ports, hot files and check chain; `settings.json`, `hooks/lint-edited.mjs`, OpenSpec skills and `commands/opsx`, `skills/parallel-work`), `.mcp.json` if Palikka has one; verify the hook runs on an edited file in a generated game (`node .claude/hooks/lint-edited.mjs` with a sample payload)

## 6. Kit docs, Palikka wiki and roadmap

- [ ] 6.1 Kit `README.md` ("Start a new game": the command, arguments, what it does and does not do, the checklist pointer; the later `@game-kit/ui` idea) and `.claude/CLAUDE.md` (upkeep rule D8, template hot spots, `template:check`); push the kit; verify CI green
- [ ] 6.2 Palikka: `docs/template.md` reduced to the upkeep rule and the map of Palikka files to template files, `docs/development.md` game kit section mentions `create-game`, `docs/README.md` link text if needed; roadmap item 13 → done; run Palikka's check chain once, commit and push
