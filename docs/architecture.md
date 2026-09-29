# Architecture

How the solution is built: structure, flows and contracts. Details (function lists, UI texts,
component behaviour) live in the code and in [`openspec/specs/`](../openspec/specs/); this page
only points to them. Status markers: **Implemented** = on `main`; **Planned (`change`)** = agreed,
delivered by that roadmap change.

> Server and device games run the **real rules** (`packages/rules`). The move control is still an
> interim one (tap a free corner square: the largest piece that fits goes there) until `basic-ui`
> brings the piece tray; the daily puzzle is out until `daily-puzzle`.

## Overview — Implemented

```
 Browser (mobile first)                          Render (free, Frankfurt)
┌──────────────────────────────┐   WebSocket   ┌─────────────────────────────┐
│ client  React 19 + Vite      │◀────────────▶│ server  Colyseus 0.18        │
│  i18next (fi default, en)    │   + HTTP      │  one Room per game + lobby  │
│  games vs bots run here      │               │  authoritative: validates   │
│  (LocalRoom)                 │               │  every command              │
└──────────────┬───────────────┘               └──────────────┬──────────────┘
               │ imports                                       │ imports
               ├────────────▶ packages/rules ◀─────────────────┤
               │              pure, deterministic game logic   │
               └────────────▶ packages/protocol ◀──────────────┘
                              shared contract: codes, schemas, log events
```

- **Monorepo**, npm workspaces, TypeScript everywhere. Hosting: client on GitHub Pages, server on
  Render ([operations.md](operations.md)).
- **No database.** Server games live in memory and are lost on restart, deploy or sleep.
- **Games with bots from the start screen run on the device** (Client → Local play), played or
  watched; online games, watching them and the waiting room use the server.
- **Bots** are computed in a browser's Web Worker ([Bots](#bots--implemented)): on the device for
  games against bots, by the host's browser (the bot runner) for online games, where the server
  only validates their moves and plays a simple move itself only as a fallback.

## Workspaces — Implemented

| Workspace | Responsibility | Must not |
|---|---|---|
| `packages/rules` | Game rules as pure functions on plain data. Randomness only from an injected seed. | Depend on React, Colyseus or any I/O. |
| `packages/protocol` | What client and server agree on: command codes, payload and join-option schemas, close codes, log event catalogue. zod schemas sit in `*-schema.ts` modules; rules the client needs are plain functions, so the client bundle has no zod. | Contain game logic. |
| `packages/bots` (`game-bots`) | Game-independent bot brains: a game interface, budgets, players (greedy now; search and MCTS later). | Know any game; carry Palikka names. |
| `packages/palikka-bots` (`@palikka/bots`) | Palikka's adapter to `game-bots`, its evaluation and the worker entry point `chooseMove`. | Do I/O or hold state. |
| `server` | Rooms, matchmaking, command validation (via rules), state sync, bot runner and fallback. Source of truth. | Trust the client; compute bots (beyond the fallback). |
| `client` | Rendering, input, games on the device, i18n, settings. | Hold authoritative state of server games. |

**No build step between packages:** the `packages/*` workspaces export a `source` condition pointing at
`src/index.ts`; Vite, Vitest and `tsx` resolve it. The server production build uses `dist/`.

## Server — Implemented

- Entry `server/src/index.ts` (port `PORT`, default 2577); rooms and routes in `app.config.ts`.
- Every room extends `LoggedRoom`: readable room id (`brave-otters-sing`, also the `room` field of
  every log line), lifecycle logging, `this.command()` for commands, `holdSeat()` for drops.
- Rooms: `game` → `GameRoom` (one game; `filterBy(["pool"])`, realtime listing on) and `lobby` →
  Colyseus' built-in `LobbyRoom` (pushes the game listing to start screens).
- HTTP: `POST /watch` (a seat reservation for a spectator), `GET /health` (`{ status,
  rulesVersion, version, builtAt }`; Render's health check and the client's wake-up request),
  `POST /client-logs`. Development only: `/monitor`, `/playground`. CORS: `ALLOWED_ORIGINS`.
- Graceful shutdown: Colyseus' own shutdown on SIGTERM, logged as `server.shutdown`.

### Commands and rejection contract — Implemented

- Clients send `room.request(name, payload)` and always get `CommandResult`: `{ ok: true }` or
  `{ ok: false, code }`.
- `LoggedRoom.command(name, schema, handler)` validates with zod (→ `INVALID_COMMAND`), runs the
  handler and writes exactly one audit line (`cmd.accepted` / `cmd.rejected` / `cmd.failed`); an
  unexpected exception becomes `INTERNAL_ERROR` and the room keeps running.
- A handler rejects by throwing `CommandRejection(code, facts)` **before changing state**; state
  facts (phase, turn, host …) come from `commandStateFacts()`.
- Handlers take an `Actor { sessionId, bot? }`. A bot calls the same wrapped handler, so its
  commands get the same checks and audit line, marked `bot: true`.
- **Adding a command:** (1) codes/types in `protocol/src/game-codes.ts`, payload schema in
  `game-schema.ts`; (2) `GameRoom.messages` entry: phase and turn checks, then the rules engine,
  then write state; (3) a `useGameSession` method and `errors.<CODE>` strings in fi/en; (4) the
  same command in `LocalRoom` when games on the device need it.

## Game flow — Implemented

```
 create/join ──▶ waiting ──start──▶ play (turn → next seat …) ──▶ finished
 (nickname)     host = 1st joiner   └─ 120 s turn clock ─┘  end: no colour can move, or last player standing
```

- **Joining:** join options `{ nickname, pool?, watch?, botSeats? }` (strict) are validated in
  `onCreate` and `onAuth`; refusals are a `ServerError` whose message is the code
  (`INVALID_NICKNAME`, `INVALID_OPTIONS`, `SERVER_FULL`). Seats: lowest free 1–4, taken only in the
  waiting room; the seat is also the player's colour. `MAX_OPEN_GAMES` caps the rooms.
- **Waiting room:** the first joiner hosts. A guest leaving frees the seat; the host leaving closes
  the room (`HOST_LEFT` 4101). Every room is public; friends come in by the invite link. Metadata
  `{ host, open, pool, seated, watchable }` feeds the start screen lists.
- **Game engine:** the room holds the game as the rules' match layer `Game`
  (`packages/rules/src/game.ts`: seats, colours that left, the engine's `Position`, winners; the
  same as the device's games) and every rule goes through it: `startGame` (lowest seat first),
  `playMove` (`place { piece, orientation, row, col }`; refusals `PIECE_USED`, `OFF_BOARD`,
  `OVERLAP`, `EDGE_CONTACT`, `NOT_ON_START`, `NO_CORNER_CONTACT` …), `removeSeat`, `endGame`.
  Stuck colours are passed by the engine. The synced schema mirrors the engine after each change;
  the room keeps only what is not a rule (seats and connections, clock, bot timers, logs).
- **Turn clock:** 120 s per turn; expiry only sets `turnExpired`, which lets the others `kick` the
  slow player (`KICKED` 4100).
- **Removal** (left, kicked, or a 5-minute drop hold ran out) is the single way out; the leaver's
  squares stay and its colour is out and cannot win; the last player standing wins, or the turn
  passes.
- **Bots:** the host's `addBot` / `removeBot { seat }` in the waiting room; a bot is a `Player`
  with `bot = true`, keyed `bot:<seat>`, named Kettu, Ilves, Pöllö, Näätä. The **bot runner**
  (`botRunnerSeat`: the host while connected, else the lowest connected person, else 0; logged as
  `bot.runner`) computes the moves of bot-played seats (bots and auto-played people) and sends
  `botPlace { seat, … }` after the 1 s pause (divided by `botSpeed`); the server accepts it only
  from the runner (`NOT_BOT_RUNNER`), for a bot-played seat (`NOT_BOT_SEAT`) on turn, legal.
  **Fallback:** with no runner after the pause, or with a silent runner 10 s after it, the room
  plays the rules' `simpleBotMove` itself through `place` (audit `bot: true`, `bot.fallback`
  with `reason` `noRunner` / `runnerSilent`).
- **Autoplay:** `setAutoplay { on }` hands a person's seat to the bot; a dropped player is
  auto-played during the seat hold; a reconnect ends only a drop's autoplay.
- **Nobody left:** no person seated and nobody watching → the game finishes with no winner.
- **Spectators:** `POST /watch` reserves a seat in a running, watchable room (≤ 8 spectators);
  `setSpeed` works while only bots play.
- **Rematch:** `rematch` (seated, finished) creates one new room with the same pool and bots; its id
  is synced as `rematchRoomId` and clients `joinById` it.

## State sync — Implemented

- Synced (`server/src/rooms/schema/GameState.ts`): players (seat, nickname, `bot`, `autoplay`,
  connected), `cells` (owner colour per square, row-major), `colours` (per colour: placed
  `pieces` in order, `out`, `left`), `phase`, `turnSeat`, `turn` (turns started), `hostSeat`,
  `winners`, `turnDeadline`, `turnExpired`, `botRunnerSeat`, `spectators`, `botSpeed`,
  `rematchRoomId`. No hidden information: everything a player may know is public.
- The client rebuilds the engine's `Position` from it (`GameView.position`), so hints, the interim
  control and the bot runner use the same rules as the server.
- UI-only state (the hint) never crosses the network.

## Rules package — Implemented

`packages/rules/src/`: `pieces` (the 21 pieces `I1 … Z5`, 91 orientations generated at load, stable
indexes pinned by a golden snapshot), `config` (`BoardConfig`, `CLASSIC` 20×20), `bitboard` (one
32-bit word per row), `position` (`Position` as plain JSON, a cached bitboard view per position
object, `checkPlacement` with one refusal code), `moves` (`Placement` ↔ integer `Move` code),
`movegen` (corner-based `legalMoves`, `hasLegalMove`, `freeCorners`, `forbiddenSquares`), `play`
(`applyMove`, `pass`, `resign`, `abort`; automatic passing), `scoring` (`scores`, `winners`),
`game` (the match layer: seats, leaving, winners among those who stayed; the room's and
`LocalRoom`'s one engine), `bot` (`simpleBotMove`: largest piece first, seeded; the server's
fallback), `turns` (kick rule, clock limits), `rng` (seeded `xoroshiro128plus`).
`@palikka/rules/testing` has `referenceMoves` (naive generator), `randomGame`, `placement` and
`positionWith`. Property tests (fast-check) check the fast generator against the reference along
random games.

Move generation speed (`npm run bench -w @palikka/rules`, 40 seeded random 4-colour games, a full
list for every colour still in at every position; developer desktop, 2026-09-29): **0.034 ms per
move list, about 5.5 million moves/s** (target was under 0.5 ms).

## Bots — Implemented

- **`game-bots`** (`packages/bots`): a game plugs in as a `Game` (player to move, legal moves,
  play, game over). A `Bot` answers `choose(state, budget, rng)`; `Budget` is plain JSON
  (`timeMs` and/or `depth`); the rng is injected, so a seed fixes the choice. Players today:
  `greedyBot(game, evaluate)` (one ply, seeded tie-breaking, stops at the time limit with the
  best so far) and `randomBot` (baseline). Search, MCTS and the worker harness: `bot-search`.
- **`@palikka/bots`** (`packages/palikka-bots`): `palikkaGame` over the rules engine, `evaluate`
  (own score, free corners and exclusive reach against the opponents' average, won/lost end),
  `greedyPlayer`, `randomPlayer`, `playGame` (whole seeded games for tests and tournaments) and the
  worker entry point `chooseMove(position, colour, budget, seed | rng) → Placement | undefined`.
- Strength and speed (`npm run bench -w @palikka/bots -- 50`, developer desktop, 2026-09-29):
  greedy vs three random players wins **99 %** (198/200); **7.9 ms per move** on average, slowest
  77 ms. A unit test keeps the ≥ 90 % bar over 12 seeded games.
- **In the client** (`client/src/bots/`): `bot.worker.ts` runs `chooseMove` in a module Web Worker
  (budget 500 ms; own size-limit entry); `askBotWorker` asks it by message and answers in-thread
  where no worker can run (tests, a failed load). `LocalRoom` gets its bots' moves there, and so
  does the online bot runner (`session/useBotRunner.ts`), which sends them as `botPlace`.

## Client — Implemented

```
client/src/
  App.tsx       StartScreen → WaitingRoomScreen (phase waiting) → GameScreen
  screens/      the three screens
  session/      useGameSession (join, rejoin, commands, local-first leave), viewModel
                (state → GameView), LocalRoom (games on the device), useBotRunner, stores,
                serverWake, nickname
  bots/         the bot worker and its client
  game/         board, interim move control, turn line, player strip, controls
                (place/undo/kick/leave/autoplay/spectate)
  tips/         first-game tips (pure pick + localStorage) and the start screen's reset link
  settings/     device settings store, settings screen, theme, generated sounds, turn alert
  howto/        the rules screen ("Näin pelaat")
  ui/           tokens.css (theme "Kuura", light + dark) and shared components
  logging/ i18n/ config.ts CrashBoundary.tsx
```

- **Server state is the truth.** `toGameView()` turns synced state into an immutable `GameView`;
  components render it.
- **UI foundation:** every colour, spacing and radius is a token in `ui/tokens.css` (theme Kuura:
  flat squares, seat colours Järvi / Lakka / Puolukka / Kuusi; light and dark, following the
  device unless forced in the settings); CSS Modules; anything shown twice is a shared component
  (`SeatMark` = a seat's colour everywhere).
- **Session:** a per-tab reconnection token (sessionStorage) rejoins after a reload; a seated
  player's unfinished game is remembered in localStorage, so a newly opened app offers "Jatka
  peliä". `leave()` is local-first. Close codes 4100/4101 and join failures become start-screen
  notices.
- **Local play:** a game against bots is a `LocalRoom` implementing the same `GameRoomLike` as a
  Colyseus room over the rules' match layer: same synced-state shape, same `CommandResult`s, bots
  from the worker after the server's pause (a refused or missing answer falls back to
  `simpleBotMove`), no turn clock. `undo` ("Peru") restores the game before the player's last own
  move (history of games, stale bot answers dropped). Ids `local-…` / tokens `local:…` route to the
  device. Saved in localStorage (`palikka.localGame`) after every step; a save of an older format
  is dropped. Watched bot games (`local-watch-…`) are never saved.
- **Interim move control (until `basic-ui`):** on the viewer's turn the free corner squares where a
  piece fits are buttons; a tap sends the largest piece covering that square
  (`game/interimMoves.ts`). "Vihje" rings the squares of the bot's move.
- **Daily puzzle:** removed with the placeholder game. **Planned (`daily-puzzle`):** the real
  puzzle (fill a shape with pieces).
- **PWA:** `vite-plugin-pwa` (auto-update service worker, off in `vite dev`); icons generated from
  `public/favicon.svg`.
- **Early wake-up:** the start screen fetches `/health` once per load so a sleeping server wakes
  while the player types; server join actions wait for it (device games do not).
- **i18n:** Finnish is the key source of truth (type-checked), a test enforces fi/en parity.
- **Logging:** pino browser build, batched to `POST /client-logs`; see
  [operations.md](operations.md#logs--implemented).
