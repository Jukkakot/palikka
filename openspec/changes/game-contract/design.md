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

The server part (`@game-kit/server`, `GameServerDefinition`) adds the zod schemas for the move and the extra join options, the synced schema fields and `sync(game, state)` / `reset(options, state)`, the commands' wire names (D5), and the listing metadata extras. The client part (`@game-kit/client`, `GameClientDefinition`) adds `toView(state, lobby)`, `askBot(view, budget, seed)`, the device-game setup (seats for `playBots` / `watchBots` from the options), and the save key and format check.
Palikka's `GameRules` is `palikkaRules` in `packages/rules/src/contract.ts`, a thin wrapper over the match layer. The room and `LocalRoom` already use that same engine.
*Alternative:* one object with everything. Rejected because the client bundle must not pull in zod or Colyseus schema (an architecture rule).

### D3. The synced state stays flat and identical

The kit exports `lobbyFields` (players, phase, hostSeat, turnSeat, turn, winners, turnDeadline, turnExpired, botRunnerSeat, spectators, botSpeed, rematchRoomId). The game builds `GameState = schema({ ...lobbyFields, ...gameFields })`. For Palikka the game fields are variant, cells, colours and turnColour. The kit room types its state as the lobby part only.
*Alternative:* a nested `state.game` child. It is cleaner, but it changes the wire, so old clients break during the deploy window.
*Verification step:* with Colyseus 0.18 `schema()`, spreading field definitions must give the same encoding. A server test compares an encoded state from before the change (a fixture captured in task 1.1) with one from after.

### D4. The generic room is a base class with hooks, and Palikka's room extends it

`KitGameRoom<G, M, O>` holds the messages `start`, `addBot`, `removeBot`, `setAutoplay`, `setSpeed`, `rematch`, `kick`, the move and the bot move. It also holds the lifecycle, seats, runner, fallback, clock, removal and finish (the current code, with the rules calls going through `GameRules`). `PalikkaRoom` passes its definition and adds `setVariant` in its own `messages`, using protected hooks: `options()`, `setOptions(o)` (resync seats, maxClients and metadata, remove bots on seats above the range), `seatRange()`. `MAX_OPEN_GAMES`, `MAX_SPECTATORS`, `BOT_DELAY_MS`, the grace time and the clock limits stay the same values, set through the kit's config. Room tests still override them per instance.

### D5. Wire names are the game's choice

The definition names the move commands. Palikka keeps `place` and `botPlace`, and the kit's defaults for new games are `move` and `botMove`. The bot move payload stays `{ seat, ...move }`, so the kit requires a move to be a plain object. Join options: the kit's schema (nickname, pool, watch, botSeats) is extended by the game's options schema (Palikka: `variant`), and the metadata by the game's extras (`variant`). Close codes and join error codes are generic and unchanged.

### D6. Protocol and log catalogue split into kit and game lists

`@game-kit/protocol` holds the generic error codes (NOT_SEATED, NOT_YOUR_TURN, WRONG_PHASE, NOT_BOT_RUNNER, NOT_BOT_SEAT, NOT_KICKABLE, TURN_NOT_EXPIRED, NOT_HOST, NOT_ENOUGH_PLAYERS, TOO_MANY_PLAYERS, SEAT_TAKEN, NOT_A_BOT, NOT_SPECTATOR, PEOPLE_PLAYING, AUTOPLAYING, SERVER_FULL) and the generic log events. `@palikka/protocol` re-exports them and adds its own (placement codes, `variant.changed`, board constants, `PlacePayload`, `VARIANT_IDS`). `GAME_ERROR_CODES` and the event catalogue stay exported under their current names as the union, so i18n keys, the log schema test and Axiom queries do not change. `BOT_NAMES` stays generic (in the kit protocol), because the names are language-neutral and every game can override them later.

### D7. Client: a generic session, and a Palikka hook on top

`@game-kit/client` holds `useKitSession(definition, connector)` with every current generic method (create, join, joinById, joinInvite, watch, resume, retry, start, addBot, removeBot, kick, leave, rematch, setAutoplay, setSpeed, undo, playBots and watchBots with game options) and `command(name, payload)` for game commands. `client/src/session/useGameSession.ts` becomes `useGameSession()`: the kit hook with Palikka's definition, plus `place` and `setVariant`. It returns exactly today's `GameSession`, so screens and their tests do not change. `GameView` = `LobbyView & PalikkaView`, an intersection, so components keep reading `view.position`, `view.seats[].colours` and so on.

### D8. The device-game room is generic, and so is undo

`LocalRoom<G, M, O>` takes `GameRules` and the client definition. History entries record the seat that made each move. Undo restores the game before the last entry by the player's seat, which covers the shared colour because it is played by a seat (as today). The save key (`palikka.localGame`), its format and the drop of older formats stay Palikka's, through the definition. Watched games are still never saved.

### D9. The test game lives in the kit protocol

`@game-kit/protocol/testing` exports a minimal Connect Four (7×6, two seats, a column as the move, a draw when full, the first free column as the fallback) as `GameRules`, plus its server and client parts in the kit packages' test support. It proves the contract with a second game. `game-template` later grows it into the real example. It is not in the published entry, so it is never bundled.

### D10. Order: refactor under the old tests, then move the tests

Tasks first extract with the current server and client suites untouched, apart from import paths. Those suites are the proof of "no behaviour change". Only then do the generic suites (`lifecycle`, `lobby`, `rematch`, `spectators`, `autoplay`, the bot-runner parts of `bots`, `command`, `logger`, and the client's `session`, `lobby`, `localRoom` and `useBotRunner` tests) move to the kit, rewritten over the test game. Palikka keeps its wiring tests (`GameRoom`, `game`, `variants`, `turnRules`, `errors`, and the view model with local-room parts that test Palikka specifics such as the shared colour and variant bot counts). Each behaviour is still tested once.

## How it meets the NFRs

- **Logging and audit:** the same events, the same fields and the same one audit line per command. `turnFacts`, `finishFacts` and `moveText` supply the game-specific fields (`colour`, `scores`, `move`). A captured-log comparison in the Palikka room tests (the existing `captureLogs` assertions) guards it.
- **Tests:** D10. Coverage does not drop, and the check chain runs once before each commit.
- **Limits and abuse protection:** caps and schemas are unchanged, and the zod strictness of join options holds (the kit schema is extended with `.extend`, still `.strict()`).
- **Versioning:** no protocol change (D3, D5), so no reload notice is needed.
- **Performance:** the rules calls are the same, with only one indirection per call. The client bundle is checked by `npm run size`.

## Risks / Trade-offs

- [Schema spreading encodes differently] → D3's fixture test. If it fails, fall back to one full `GameState` defined in Palikka that the kit only types structurally (the kit reads only lobby fields).
- [Bundle over 200 kB] → the kit client has `sideEffects: false` and named exports. The Palikka hook imports only what it uses. If it is still over by 1–2 kB, raise the limit to 205 kB and record it here. Anything more means investigating first.
- [Hooks leak Palikka concepts into the kit] → the kit must build and pass its tests with only the Connect Four test game. That is its whole test suite.
- [Large change on every hot file] → no parallel work while it runs, and one commit per task group so a failure can be bisected.

## Migration Plan

Nothing to migrate: the wire, saves and logs are unchanged. The server and the client deploy as usual in either order. Rollback is a revert.
