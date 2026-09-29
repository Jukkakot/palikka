# Architecture

How the solution is built: structure, flows and contracts. Details (function lists, UI texts,
component behaviour) live in the code and in [`openspec/specs/`](../openspec/specs/); this page
only points to them. Status markers: **Implemented** = on `main`; **Planned (`change`)** = agreed,
delivered by that roadmap change.

> The game on `main` is still the **placeholder "claim a cell" game** (20×20 board, one square per
> turn, five turns each, most squares wins). It exists so the whole chain runs end to end; the
> real rules replace it with the roadmap's `rules-engine` change, keeping the shapes below.

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
- **Bots:** today the server plays bot seats of online games. **Planned (`game-room`):** the host's
  browser computes bot moves (Web Worker) and the server only validates them; the bot "brains"
  become a game-independent workspace package (**Planned (`bot-greedy`)**).

## Workspaces — Implemented

| Workspace | Responsibility | Must not |
|---|---|---|
| `packages/rules` | Game rules as pure functions on plain data. Randomness only from an injected seed. | Depend on React, Colyseus or any I/O. |
| `packages/protocol` | What client and server agree on: command codes, payload and join-option schemas, close codes, log event catalogue. zod schemas sit in `*-schema.ts` modules; rules the client needs are plain functions, so the client bundle has no zod. | Contain game logic. |
| `server` | Rooms, matchmaking, command validation (via rules), state sync, bots. Source of truth. | Trust the client. |
| `client` | Rendering, input, games on the device, i18n, settings. | Hold authoritative state of server games. |

**No build step between packages:** `rules` and `protocol` export a `source` condition pointing at
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
 (nickname)     host = 1st joiner   └─ 60 s turn clock ─┘   end: rules decide, or last player standing
```

- **Joining:** join options `{ nickname, pool?, watch?, botSeats? }` (strict) are validated in
  `onCreate` and `onAuth`; refusals are a `ServerError` whose message is the code
  (`INVALID_NICKNAME`, `INVALID_OPTIONS`, `SERVER_FULL`). Seats: lowest free 1–4, taken only in the
  waiting room; the seat is also the player's colour. `MAX_OPEN_GAMES` caps the rooms.
- **Waiting room:** the first joiner hosts. A guest leaving frees the seat; the host leaving closes
  the room (`HOST_LEFT` 4101). Every room is public; friends come in by the invite link. Metadata
  `{ host, open, pool, seated, watchable }` feeds the start screen lists.
- **Game engine:** the room holds the game as the rules engine's `GameState`
  (`packages/rules/src/game.ts`, the same engine as the device's games) and every rule goes through
  it: `startGame`, `applyPlace`, `removeSeat`, `endGame`, `botViewOf`, `botRngFor`. The synced
  schema mirrors the engine after each change; the room keeps only what is not a rule (seats and
  connections, clock, bot timers, logs).
- **Turn clock:** 60 s per turn; expiry only sets `turnExpired`, which lets the others `kick` the
  slow player (`KICKED` 4100).
- **Removal** (left, kicked, or a 5-minute drop hold ran out) is the single way out; the leaver's
  cells stay; the last player standing wins, or the turn passes.
- **Bots:** the host's `addBot` / `removeBot { seat }` in the waiting room; a bot is a `Player`
  with `bot = true`, keyed `bot:<seat>`, named Kettu, Ilves, Pöllö, Näätä. On its turn the room
  waits `botDelayMs` (1 s, divided by `botSpeed`), asks `botStrategy` over a `BotView` and sends
  the command; a rejected choice logs `bot.fallback` and takes the first empty cell.
- **Autoplay:** `setAutoplay { on }` hands a person's seat to the bot; a dropped player is
  auto-played during the seat hold; a reconnect ends only a drop's autoplay.
- **Nobody left:** no person seated and nobody watching → the game finishes with winner 0.
- **Spectators:** `POST /watch` reserves a seat in a running, watchable room (≤ 8 spectators);
  `setSpeed` works while only bots play.
- **Rematch:** `rematch` (seated, finished) creates one new room with the same pool and bots; its id
  is synced as `rematchRoomId` and clients `joinById` it.

## State sync — Implemented

- Synced (`server/src/rooms/schema/GameState.ts`): players (seat, nickname, `bot`, `autoplay`,
  connected, `placed`), `cells` (owner seat per cell, row-major), `phase`, `turnSeat`, `turn`,
  `hostSeat`, `winnerSeat`, `turnDeadline`, `turnExpired`, `spectators`, `botSpeed`,
  `rematchRoomId`. No hidden information: everything a player may know is public.
- UI-only state (the hint) never crosses the network.

## Rules package — Implemented (placeholder game)

`packages/rules/src/`: `board` (20×20 cells, owners), `game` (a whole game as JSON data:
`startGame`, `applyPlace` with the server's rejection codes, `removeSeat`, `endGame`, `leader`,
`botViewOf`, `botRngFor`), `bot` (`BotStrategy` over a `BotView`, `chooseBotCell`, `botSeed`),
`daily` (`startDailyPuzzle(date)`: target cells seeded by the date), `turns` (next seat, kick rule,
clock limits), `rng` (seeded `xoroshiro128plus`). Test fixtures in `@palikka/rules/testing`
(`boardFromRows`, `boardToText`). **Planned (`rules-engine`):** pieces, orientations, corner rule,
bitboard move generation, passing and scoring replace `board`/`game`/`bot`.

## Client — Implemented

```
client/src/
  App.tsx       StartScreen → WaitingRoomScreen (phase waiting) → GameScreen
  screens/      the three screens
  session/      useGameSession (join, rejoin, commands, local-first leave), viewModel
                (state → GameView), LocalRoom (games on the device), stores, serverWake, nickname
  game/         board, turn line, player strip, controls (place/kick/leave/autoplay/spectate)
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
  Colyseus room over the rules engine: same synced-state shape, same `CommandResult`s, bots with
  the server's pause and fallback, no turn clock. Ids `local-…` / tokens `local:…` route to the
  device. Saved in localStorage (`palikka.localGame`) after every step. Watched bot games
  (`local-watch-…`) are never saved.
- **Daily puzzle:** a `LocalRoom` of a solo game from `startDailyPuzzle(date)` with its own save
  slot (`palikka.dailyGame`, history for `undo`); `palikka.daily` records the date, attempt, par
  and the day's best. **Planned (`daily-puzzle`):** the real puzzle (fill a shape with pieces).
- **PWA:** `vite-plugin-pwa` (auto-update service worker, off in `vite dev`); icons generated from
  `public/favicon.svg`.
- **Early wake-up:** the start screen fetches `/health` once per load so a sleeping server wakes
  while the player types; server join actions wait for it (device games do not).
- **i18n:** Finnish is the key source of truth (type-checked), a test enforces fi/en parity.
- **Logging:** pino browser build, batched to `POST /client-logs`; see
  [operations.md](operations.md#logs--implemented).
