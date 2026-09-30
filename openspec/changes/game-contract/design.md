# Design

## Context

See proposal.md → Why. Current state (2026-09-30):

- `server/src/rooms/GameRoom.ts` (841 lines) is generic apart from these points: the calls into the rules' match layer (`startGame`, `playMove`, `seatOnTurn`, `removeSeat`, `endGame`, `simpleBotMove`, `scores`), `syncGame` into the synced schema, the variant (`setVariant`, `applyVariant`, `resizeBoard`, seat counts from `VARIANTS`), and log facts (`colour`, `scoreFacts`, `placementText`).
- `LoggedRoom`, `command.ts` and `roomId.ts` are generic already. So are `game-bots` and the client logging, stores, `serverWake` and `useOpenGames`.
- On the client, `GameRoomLike` is already the seam between the Colyseus room and `LocalRoom`. `toGameView` mixes lobby fields (players, host, phase, clock, runner, speed, rematch) with the Palikka position, colours and results. `useBotRunner` asks for a Palikka `Position` and colour. `GameSession` mixes generic methods with `place` and `setVariant`.
- The protocol's `game-codes.ts` mixes generic codes and payloads with `PlacePayload`, the variant, board constants and placement error codes. The same mix is in `log-events.ts`.
- The server (Render) and the client (Pages, PWA with auto-update) deploy separately, so for a while an old client can talk to a new server.

## Goals / Non-Goals

**Goals:**

- A game contract small enough that Connect Four fits it in about 150 lines, and general enough for Palikka's variants, shared colour and 2–4 seats.
- Generic code in `@game-kit/*` workspaces with no path back to Palikka, so `game-kit` (step 2) can move them without touching their contents.
- Every existing test still passes. The refactor happens under the current suites, and they are only moved afterwards.

**Non-Goals:**

- Screens and components (`StartScreen`, `WaitingRoomScreen`, `game/*` controls, `ui/`, `motion/`, `settings/`, `tips/`, i18n). They stay in the client, and `game-template` decides how they are shared.
- HTTP routes and app setup (`/watch`, `/health`, `/client-logs`, CORS, `index.ts`, `app.config.ts`), CI, the tools, `.claude` and OpenSpec files. These move in `game-kit`.
- Hidden information, multi-step turns and non-seat turn owners (Labyrinth). The contract only avoids ruling these out.
- Renaming `game-bots` or changing the bots, and any rule change (`RULES_VERSION` stays 1.1.0).

## Decisions

### D1. Three kit workspaces now, not folders

Add `packages/kit-protocol` (`@game-kit/protocol`), `packages/kit-server` (`@game-kit/server`) and `packages/kit-client` (`@game-kit/client`). They work like the other packages: the `source` export condition, `tsconfig.build.json`, and their own `test`, `typecheck` and `build` scripts. Lint enforces the boundary. An `.oxlintrc.json` override for `packages/kit-*/**` turns on `no-restricted-imports` for `@palikka/*` and for relative paths that leave the package. If oxlint cannot express the relative-path part, a kit test scans `src/` imports instead.
*Implemented:* oxlint forbids `@palikka/*`, `game-bots` and relative paths three or more levels up; `packages/kit-protocol/test/boundary.test.ts` checks that every relative import of every kit package stays inside it (oxlint's regex has no look-ahead, so `../../src` versus `../../server` cannot be told apart there). The turn rules (`kickRejection`, the clock and hold limits, `MIN_SEATS`) moved to `@game-kit/protocol`; `@palikka/rules` re-exports them.
*Alternative:* folders inside `server/` and `client/`. They are cheaper today, but the boundary would not be enforced, and `game-kit` would still have to untangle dependencies.

### D2. The contract: one rules object, plus a server part and a client part

In `@game-kit/protocol`, types only:

```ts
interface GameRules<G, M, O> {          // shared by server and device games; pure
  seatRange(options: O): { min: number; max: number };
  start(seed: number, seats: Seat[], options: O): G;
  seatOnTurn(game: G): number;          // 0 = nobody (over)
  turnFacts(game: G): LogFields;        // e.g. { colour } for turn.changed / bot.fallback
  play(game: G, seat: number, move: M): { ok: true; game: G } | { ok: false; code: string; facts?: LogFields };
  removeSeat(game: G, seat: number): G; // leaving: the game decides what happens to the seat's things
  isOver(game: G): boolean;
  winners(game: G): readonly number[];  // seats
  end(game: G): G;                      // nobody left: freeze
  fallbackMove(game: G): M | undefined; // the server's simple bot, seeded from the game
  finishFacts(game: G): LogFields;      // e.g. { scores }
  moveText(move: M): string;            // audit facts of a refused move
}
```

The server part (`@game-kit/server`, `GameServerDefinition`) adds the zod schemas for the move and the extra join options, the game child schema with `sync(game, child)` / `reset(options, child)`, and `optionsChange` (D5). The client part (`@game-kit/client`, `GameClientDefinition`) adds `toView(state, lobby)`, `askBot(view, budget, seed)`, the device-game setup (seats for `playBots` / `watchBots` from the options), and the save key and format check.
Palikka's `GameRules` is `palikkaRules` in `packages/rules/src/contract.ts`, a thin wrapper over the match layer. The room and `LocalRoom` already use that same engine.
*Alternative:* one object with everything. Rejected because the client bundle must not pull in zod or Colyseus schema (an architecture rule).

### D3. Synced state: the kit's lobby state with a game child

The kit owns `LobbyState` (players, phase, hostSeat, turnSeat, turn, winners, turnDeadline, turnExpired, botRunnerSeat, spectators, botSpeed, rematchRoomId), plus `game`, a child schema that the game defines. For Palikka that child holds variant, cells, colours and turnColour. The kit room creates the child from the definition and never reads inside it.
*Alternative:* spreading the game's fields flat into one schema. It keeps the wire identical, but the user accepts brief client/server mismatches in this hobby project (2026-09-30), and the nested form keeps the boundary clean.

### D4. The generic room is a base class with hooks, and Palikka's room extends it

`KitGameRoom<G, M, O>` holds the messages `start`, `addBot`, `removeBot`, `setAutoplay`, `setSpeed`, `rematch`, `kick`, the move and the bot move. It also holds the lifecycle, seats, runner, fallback, clock, removal and finish (the current code, with the rules calls going through `GameRules`). It also holds `setOptions` (D5). Palikka's room only passes its definition. A game that needs its own commands adds them to `messages` and uses the protected helpers (`requireSeated`, `requireHostInWaitingRoom`, `options()`, `game()`). `MAX_OPEN_GAMES`, `MAX_SPECTATORS`, `BOT_DELAY_MS`, the grace time and the clock limits stay the same values, set through the kit's config. Room tests still override them per instance.
*Implemented:* the kit room also does the TOO_MANY_PLAYERS check of `setOptions` itself (from `seatRange`), so Palikka needs no `optionsChange` hook; the hook stays optional for other checks. `GameServerDefinition` adds `turnLogFacts` (Palikka: `out` on `turn.changed`) and `stateFacts` (Palikka: `turnColour` on rejected commands). `rules.turnFacts` identifies the turn: a removal that changes it or the seat on turn starts a new turn. The test hook `chooseStartSeat` became `adjustStart(game)`. `game.started` carries the turn facts (`colour`) in place of `startColour`, and the game's options spread in (`variant`). Open games are counted per room class.

### D5. Generic wire names; the game's options in one field

- **Move commands:** every game uses `move { move }` and `botMove { seat, move }`, validated by the game's move schema. Palikka's `place` and `botPlace` go away.
- **Game options:** join options are `{ nickname, pool?, watch?, botSeats?, options? }`, where the game's schema validates `options` (Palikka: `{ variant }`). The listing metadata carries `options` too. A rematch copies them.
- **Setting options:** the host's `setOptions { options }` in the waiting room is generic. The game's `optionsChange(state, from, to)` hook checks the change and can refuse it (Palikka: `TOO_MANY_PLAYERS`). The kit then drops bots above the new seat range, resets the game child and resyncs seats. Palikka's `setVariant` goes away, and so does the log event `variant.changed`, replaced by `options.changed { from, to }`. Palikka has no other game-specific command, so its room needs no messages of its own.
- Close codes and join error codes are unchanged.

A client and a server from different commits do not understand each other while one of them is still being deployed. That is accepted, and the PWA auto-update fixes the client on the next load. No version check is added now.

### D6. Protocol and log catalogue split into kit and game lists

`@game-kit/protocol` holds the generic error codes (NOT_SEATED, NOT_YOUR_TURN, WRONG_PHASE, NOT_BOT_RUNNER, NOT_BOT_SEAT, NOT_KICKABLE, TURN_NOT_EXPIRED, NOT_HOST, NOT_ENOUGH_PLAYERS, TOO_MANY_PLAYERS, SEAT_TAKEN, NOT_A_BOT, NOT_SPECTATOR, PEOPLE_PLAYING, AUTOPLAYING, SERVER_FULL) and the generic log events. `@palikka/protocol` re-exports them and adds its own (placement codes, board constants, `PlacePayload` as the move type, `VARIANT_IDS`). `GAME_ERROR_CODES` and the event catalogue stay exported under their current names as the union, so i18n keys and the log schema test keep working. Event names stay as they are apart from D5's `options.changed`. `tools/axiom` filters and `docs/operations.md` are updated to match. `BOT_NAMES` stays generic (in the kit protocol), because the names are language-neutral and every game can override them later.

### D7. Client: a generic session, and a Palikka hook on top

`@game-kit/client` holds `useKitSession(definition, connector)` with every current generic method (create, join, joinById, joinInvite, watch, resume, retry, start, addBot, removeBot, kick, leave, rematch, setAutoplay, setSpeed, undo, playBots and watchBots with game options) and `command(name, payload)` for game commands. `client/src/session/useGameSession.ts` becomes `useGameSession()`: the kit hook with Palikka's definition, plus `place(move)` (sends `move`) and `setVariant(variant)` (sends `setOptions`). It keeps today's `GameSession` shape, so screens and their tests change at most in test fixtures. `GameView` = `LobbyView & PalikkaView`, an intersection, so components keep reading `view.position`, `view.seats[].colours` and so on.

### D8. The device-game room is generic, and so is undo

`LocalRoom<G, M, O>` takes `GameRules` and the client definition. History entries record the seat that made each move. Undo restores the game before the last entry by the player's seat, which covers the shared colour because it is played by a seat (as today). The kit owns the save envelope `{ version, roomId, game, history, … }` under a key from the definition (`palikka.localGame`). A save whose version is not the current one is dropped. The new envelope gets a new version, so a game left open on a device from before this change is dropped once (accepted). Watched games are still never saved.

### D9. The test game lives in the kit protocol

`@game-kit/protocol/testing` exports a minimal Connect Four (7×6, two seats, a column as the move, a draw when full, the first free column as the fallback) as `GameRules`, plus its server and client parts in the kit packages' test support. It proves the contract with a second game and stays the kit's own test fixture. It is kept minimal on purpose: the real Connect Four is its own project (roadmap `connect-four`), the kit's first outside user. It is not in the published entry, so it is never bundled.
*Implemented (2026-09-30):* the test game takes 2–4 seats (option `seats`, default 4), so the moved room tests that seat three or four players, and `setOptions` dropping bots above the new range, run over it unchanged. Two seats remain its normal game.

### D10. Order: refactor under the old tests, then move the tests

Tasks first extract with the current server and client suites kept as they are, apart from import paths and the wire renames of D3 and D5 (command names, the `state.game.*` paths, `options`). Those suites are the proof that gameplay did not change. Only then do the generic suites (`lifecycle`, `lobby`, `rematch`, `spectators`, `autoplay`, the bot-runner parts of `bots`, `command`, `logger`, and the client's `session`, `lobby`, `localRoom` and `useBotRunner` tests) move to the kit, rewritten over the test game. Palikka keeps its wiring tests (`GameRoom`, `game`, `variants`, `turnRules`, `errors`, and the view model with local-room parts that test Palikka specifics such as the shared colour and variant bot counts). Each behaviour is still tested once.

## How it meets the NFRs

- **Logging and audit:** the same events and fields and the same one audit line per command (the command names follow D5, and `variant.changed` becomes `options.changed`). `turnFacts`, `finishFacts` and `moveText` supply the game-specific fields (`colour`, `scores`, `move`). The existing `captureLogs` assertions in the Palikka room tests guard it.
- **Tests:** D10. Coverage does not drop, and the check chain runs once before each commit.
- **Limits and abuse protection:** the caps are unchanged. The join options stay `.strict()`, and so do the game's `options` and move schemas.
- **Versioning:** the wire changes (D3, D5). A brief mismatch while deploying is accepted (user, 2026-09-30); no reload check is added.
- **Performance:** the rules calls are the same, with only one indirection per call. Mobile load speed matters more than the exact kB figure (below).

## Risks / Trade-offs

- [The bundle grows] → the kit client has `sideEffects: false` and named exports, and the Palikka hook imports only what it uses. The 200 kB limit is not sacred (user, 2026-09-30): raise it as needed and record the new figure here. Anything beyond about 230 kB means finding the cause first, so that mobile loading stays fast.
- [Hooks leak Palikka concepts into the kit] → the kit must build and pass its tests with only the Connect Four test game. That is its whole test suite.
- [Large change on every hot file] → no parallel work while it runs, and one commit per task group so a failure can be bisected.

## Migration Plan

Deploy as usual. Clients opened before the deploy fail commands until they reload (the PWA updates on the next load). A device game saved before the change is dropped once (D8). Any Axiom saved query or monitor that filters on `variant.changed` or the `place` command is updated with the tools in `tools/axiom`. Rollback is a revert.
