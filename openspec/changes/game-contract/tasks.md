# Tasks

## 1. Kit workspaces and the contract

- [ ] 1.1 Before touching the room, capture a fixture: the encoded synced state of a Palikka room in the waiting room and after two moves (a server test writes and compares it). The test passes on the current code.
- [ ] 1.2 Add the workspaces `packages/kit-protocol`, `packages/kit-server` and `packages/kit-client` (`@game-kit/*`, `source` export condition, `sideEffects: false`, build, typecheck, test), and add them to the root `workspaces` before `server` and `client`. Add the boundary lint (D1). A deliberate `@palikka/rules` import in a kit file fails `npm run lint`; remove it afterwards.
- [ ] 1.3 In `@game-kit/protocol`: the contract types (D2), the generic codes, payloads, join options, close codes, `BOT_NAMES`, `BOT_SPEEDS` and the generic log events (D6). `@palikka/protocol` re-exports them, and `GAME_ERROR_CODES` and the event catalogue keep their names and contents (the existing protocol tests pass unchanged).
- [ ] 1.4 Add `@game-kit/protocol/testing` with the Connect Four test game (D9). Rules tests cover the win (row, column, both diagonals), the draw, a full column refused, a turn out of order refused, `removeSeat` (the other seat wins) and the fallback move.
- [ ] 1.5 Add `palikkaRules` in `packages/rules/src/contract.ts` over the match layer (no rule changes). Tests show it gives the same games as the match layer calls on a seeded random game. `npm test -w @palikka/rules` passes.

## 2. Server: the generic room

- [ ] 2.1 Move `LoggedRoom`, `command.ts`, `roomId.ts` and `server/src/logging/*` to `@game-kit/server`. The server imports them from there. `npm test -w @palikka/server` passes unchanged apart from import paths.
- [ ] 2.2 Add `lobbyFields` (D3), and build `GameState` from the lobby fields plus Palikka's fields. The fixture test from 1.1 passes.
- [ ] 2.3 Add `KitGameRoom` in `@game-kit/server` (D4, D5). This is the current `GameRoom` logic, with the rules calls, sync, move schema and log facts coming from the definition. `server/src/rooms/GameRoom.ts` becomes Palikka's room: the definition, `setVariant` through the hooks, and the same class name and room name `game`. Every existing server test passes unchanged apart from import paths, including the log assertions and the fixture.
- [ ] 2.4 Kit room tests over Connect Four: moving `lifecycle`, `lobby`, `rematch`, `spectators`, `autoplay`, `command`, `logger` and the bot-runner and fallback cases of `bots` from `server/test` (D10), together with `test/support`. The server keeps its Palikka wiring tests. `npm test -w @game-kit/server` and `npm test -w @palikka/server` pass, and no generic behaviour is tested in both.

## 3. Client: the generic session and device games

- [ ] 3.1 Move the client logging, `sessionToken`, `resumeRecord`, `nickname`, `serverWake`, `useOpenGames`, `inviteLink` and `localGameStore` (with the save key from the definition) to `@game-kit/client`. The client imports them from there. `npm test -w @palikka/client` passes unchanged apart from import paths.
- [ ] 3.2 Split `toGameView` into the kit's `toLobbyView` and Palikka's `toView`. `GameView` is the intersection (D7). The existing `viewModel` tests pass unchanged.
- [ ] 3.3 Make `LocalRoom` generic in the kit, with seat-based undo history (D8). Palikka's definition supplies the seats per variant, the save format check and `askBot` (the worker's `chooseMove` with the viewpoint for the shared colour). The existing `localRoom` tests pass unchanged apart from construction.
- [ ] 3.4 Move `useBotRunner` and `useGameSession` to the kit as `useKitSession` (D7). `client/src/session/useGameSession.ts` is Palikka's hook and returns today's `GameSession`. The screen tests and `session.test.ts` pass unchanged apart from import paths.
- [ ] 3.5 Kit client tests over Connect Four: move the generic cases of `session`, `lobby`, `localRoom` (undo and saving) and `useBotRunner` to `@game-kit/client`. Palikka keeps the shared colour, the variant bot counts and the save-format cases. Both suites pass, and no case is tested in both.

## 4. Check, docs and roadmap

- [ ] 4.1 Run the full check chain (`npm run lint && npm run typecheck && npm test && npm run build && npm run size -w @palikka/client`). The bundle is within the limit, or the limit is raised under design → Risks with the reason recorded. Run `npm run e2e` (smoke) against the local dev servers (2577/5183). A game against bots and an online game with a bot both play through.
- [ ] 4.2 UI check (mobile portrait, light): the start screen, a device game (a move, undo, the result) and the waiting room look and work as before.
- [ ] 4.3 Docs: `docs/architecture.md` (workspaces table with the kit packages and their "must not"; Server and Client sections name the contract; "Adding a command" split into kit and game commands), `docs/template.md` (the kit packages replace the rows they absorbed; the remaining copy-candidates stay), and `docs/development.md` (new workspaces, the boundary lint). `openspec/context/roadmap.md`: `game-contract` done.
