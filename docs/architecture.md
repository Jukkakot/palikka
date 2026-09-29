# Architecture

How the solution is built: structure, flows and contracts. Details (function lists, UI texts,
component behaviour) live in the code and in [`openspec/specs/`](../openspec/specs/); this page
only points to them. Status markers: **Implemented** = on `main`; **Planned (`change`)** = agreed,
delivered by that roadmap change.

## Overview — Implemented

```
 Browser (mobile first)                          Render (free, Frankfurt)
┌──────────────────────────────┐   WebSocket   ┌─────────────────────────────┐
│ client  React 19 + Vite      │◀────────────▶│ server  Colyseus 0.18        │
│  i18next (fi default, en)    │   + HTTP      │  one Room per game + lobby  │
│  uses @palikka/rules for   │               │  authoritative: validates   │
│  previews and highlights     │               │  every command              │
└──────────────┬───────────────┘               └──────────────┬──────────────┘
               │ imports                                       │ imports
               ├────────────▶ packages/rules ◀─────────────────┤
               │              pure, deterministic game logic   │
               └────────────▶ packages/protocol ◀──────────────┘
                              shared contract: codes, schemas, log events
```

- **Monorepo**, npm workspaces, TypeScript everywhere. Hosting: client on GitHub Pages, server on
  Render ([operations.md](operations.md)).
- **No database.** Games live in server memory and are lost on restart, deploy or sleep.
- **Games with bots from the start screen run on the device** (see Client → Local play), played
  or watched; online games, watching them and the waiting room use the server.

## Workspaces — Implemented

| Workspace | Responsibility | Must not |
|---|---|---|
| `packages/rules` | Game rules as pure functions on plain data. Randomness only from an injected seed. | Depend on React, Colyseus or any I/O. |
| `packages/protocol` | What client and server agree on: command codes, payload and join-option schemas, close codes, log event catalogue. zod schemas sit in `*-schema.ts` modules; rules the client needs are plain functions, so the client bundle has no zod. | Contain game logic. |
| `server` | Rooms, matchmaking, command validation (via rules), state sync, bots. Source of truth. | Trust the client. |
| `client` | Rendering, input, local previews, i18n, settings. | Hold authoritative state. |

**No build step between packages:** `rules` and `protocol` export a `source` condition pointing at
`src/index.ts`; Vite, Vitest and `tsx` resolve it. The server production build uses the compiled
`dist/` instead.

## Server — Implemented

- Entry `server/src/index.ts`; rooms and routes in `server/src/app.config.ts`.
- Every room extends `LoggedRoom`: readable room id (`brave-otters-sing`, also the `room` field of
  every log line), lifecycle logging, `this.command()` for commands, `holdSeat()` for drops.
- Rooms: `game` → `GameRoom` (one game; `filterBy(["pool"])`, realtime listing on) and `lobby` →
  Colyseus' built-in `LobbyRoom` (pushes the game listing to start screens).
- HTTP: `POST /watch` (`server/src/watch.ts`: a seat reservation for a spectator, see below),
  `GET /health` (`{ status, rulesVersion, version, builtAt }`; Render's health check and the
  client's wake-up request), `POST /client-logs`. Development only: `/monitor`, `/playground`.
- CORS restricted to `ALLOWED_ORIGINS` (`server/src/cors.ts`).

### Commands and rejection contract — Implemented

- Clients send `room.request(name, payload)` and always get `CommandResult`: `{ ok: true }` or
  `{ ok: false, code }`.
- `LoggedRoom.command(name, schema, handler)` validates with zod (→ `INVALID_COMMAND`), runs the
  handler and writes exactly one audit line (`cmd.accepted` / `cmd.rejected` / `cmd.failed`); an
  unexpected exception becomes `INTERNAL_ERROR` and the room keeps running.
- A handler rejects by throwing `CommandRejection(code, facts)` **before changing state**. State
  facts (phase, turn, host …) are added to rejection lines via `commandStateFacts()`.
- Handlers take an `Actor { sessionId, bot? }`, not a Colyseus `Client` (a client fits). A bot
  calls the same wrapped handler (`this.messages.shift(botActor, payload)`), so its commands get
  the same checks and audit line, marked `bot: true`.
- **Adding a command:** (1) codes/types in `protocol/src/game-codes.ts`, payload schema in
  `game-schema.ts`; (2) `GameRoom.messages` entry; phase and turn checks first, then rule
  preconditions via `@palikka/rules`, then write state; (3) a `useGameSession` method, and
  `errors.<CODE>` strings in fi/en.

## Game flow — Implemented

Specs: `lobby`, `game-session`, `turns`, `tile-shift`, `pawn-movement`, `treasures`.

```
 create/join ──▶ waiting ──start──▶ shift ──▶ move ──▶ (next seat) shift … ──▶ finished
 (nickname)     host = 1st joiner   └─ 60 s turn clock ─┘   win: home or last player standing
```

- **Joining:** join options `{ nickname, pool?, watch?, botSeats?, look? }` (strict: unknown keys are refused) are validated in `onCreate` (no room is
  created) and `onAuth` (before a seat); refusals are a `ServerError` whose message is the code
  (`INVALID_NICKNAME`, `INVALID_OPTIONS` for any other bad option, `SERVER_FULL`). Seats: lowest free 1–4 → start corner clockwise from
  top-left, taken only in the waiting room. `MAX_OPEN_GAMES` caps the rooms (static counter).
- **Waiting room:** `phase = "waiting"`, no turn, no cards, no clock. The first joiner is the host
  (`hostSeat`). A guest leaving frees the seat; the host leaving (or a dropped host's hold running
  out) closes the room for everyone (`closeRoom`, close code `HOST_LEFT` 4101). Every room is public
  (no private rooms; friends come in by the invite link); metadata `{ host, open, pool, seated }`
  feeds the list (`seated` = people + bots).
- **Game engine:** from the start the room holds the game as the rules engine's `GameState`
  (`packages/rules/src/game.ts`, the same engine as the device's quick games) and every rule goes
  through it: `startGame`, `applyShift` / `applyMove` (their rejection codes are the commands'),
  `removeSeat`, `endGame`, `botViewOf`. The synced schema mirrors the engine after each change;
  the room keeps only what is not a rule (seats and connections, clock, bots' timers, logs).
  Room tests arrange positions through `arrange()` in `test/support/game.ts`, which edits both.
- **Start** (host only, ≥ 2 seated): `startGame(dealSeed, seats, hostSeat, board)` deals 24/n cards
  from one seeded RNG onto the waiting room's board; the host takes the first turn (`firstSeat`; with no
  host, as in a watched bot game on the device, the deal draws the seat), and `game.started { dealSeed, seats, startSeat }`
  records the opening. The room locks: nobody joins a started game.
- **Turn:** `shift` then `move` by the current player; the turn passes clockwise to the next taken
  seat after the move or when the current player leaves. Shift and move before the start or after
  the end are `WRONG_PHASE`.
- **Turn clock:** 60 s per turn while `phase` is `shift` or `move`; expiry only sets
  `turnExpired`, which lets the others `kick` the slow player (close code `KICKED` 4100).
- **Removal** (`removePlayer`: left, kicked, or a 5-minute drop hold ran out) is the single way
  out: pawn, stack and seat go; then the last player standing wins, or the turn passes.
- **Finished:** `winnerSeat` set, clock stopped, room locked; players may stay and look.
- **Bots** (spec `bots`): the host's `addBot` / `removeBot { seat }` in the waiting room. A bot is
  an ordinary `Player` with `bot = true`, keyed `bot:<seat>`, named from Robo, Pixel, Byte, Nova;
  every seat-based rule works unchanged. While waiting, `maxClients = 4 − bots` (Colyseus locks and
  unlocks the room itself), and a seat reserved by a person who is joining right now counts as
  taken (`SEAT_TAKEN`). On its turn `setTurn` schedules the bot: after 1.5 s the room builds a fair
  `BotView` (no one else's target), asks `botStrategy` (default `chooseBotTurn`, rng seeded from
  the deal seed and seat) and sends the shift; 1 s later the move. A rejected choice logs
  `bot.fallback` and the bot makes an allowed shift and stays. One `botTimer` per room, cleared
  on every turn change, finish and dispose.
- **Autoplay** (spec `autoplay`): a seated person's `setAutoplay { on }` (running game only) sets the
  synced `Player.autoplay`; the room keeps why (`player` / `drop`) and a reconnect ends only a
  drop's autoplay. A dropped player in a running game is auto-played during the seat hold; a
  timed-out connected one is not (kick stays). `setTurn` schedules the bot for any bot-played seat
  (bot or auto-played person); turning it on mid-turn plays the current step (on the move step
  the rules' `botMoveAfterShift`), turning it off clears the pending step. The bot acts as
  `{ sessionId: <the person's>, bot: true }`; the person's own shift/move is `AUTOPLAYING`.
- **Pawns** (spec `pawn-looks`): a look 1–4 is a colour+shape pair (`--seat-N` tokens and the
  pawn shapes, indexed by look). `pickLook` in `packages/protocol` gives one out (preferred →
  seat's own → lowest free) on join (join option `look`, the device's stored choice), for bots and
  for games on the device. `setLook { look }` changes it in the waiting room (`LOOK_TAKEN`). The
  client draws every pawn and last-move mark by look; the seat only places crowded pawns.
  Auto-played people still count as people for "Nobody left".
- **Bot games from the start screen** run only on the device: a `bots` option is refused (`INVALID_OPTIONS`).
- **Nobody left:** when no person is seated and nobody watches (held drops count), a started game
  finishes with `winnerSeat = 0` (reason `noPeople`); bots play on only for spectators.
- **Spectators** (spec `spectators`): a started room stays locked, so `joinById` refuses everyone;
  `POST /watch { roomId, nickname }` checks the listing's `watchable` (running, < 8 spectators) and
  calls `matchMaker.reserveSeatFor` with `watch: true` in the auth, and the client consumes the
  reservation. `onJoin` keeps spectators in a set (not in `players`), syncs their count and gives
  their `StateView` every player (so they see all targets); drops are held like players'. Creating
  a room with `watch` is refused. When every person has left and spectators remain, `setSpeed`
  (spectator, no person seated) sets `botSpeed`; bot pauses are divided by it. After the start `maxClients` = 4 + 8.
- **Rematch:** `rematch` (seated, finished) creates one new room through `matchMaker.createRoom`
  with the requester's nickname, the same `pool`, and `botSeats` (bots of the start);
  concurrent requests share one pending creation. The id is synced as
  `rematchRoomId`; clients that tapped "Pelaa uudelleen" leave and `joinById` it (the requester
  first, so they host).

## State sync — Implemented

- Synced (`server/src/rooms/schema/GameState.ts`): players (seat, `look`, nickname, `bot`, `autoplay`, connected, pawn
  square, card count, found treasures, and the **view-filtered** current target), the 49 squares
  and the spare as `{ id, rotation }`, `phase`, `turnSeat`, `hostSeat`, `winnerSeat`,
  `lastInsertion`, `turnDeadline`, `turnExpired`, `spectators` (count), `botSpeed`, `rematchRoomId`.
- Never synced: seeds, treasure stacks, tile kinds and treasures (static per tile id). The client
  rebuilds a rules `Board` from ids and derives everything else with `@palikka/rules`.
- **Hidden information:** `Player.target` is `.view()`-tagged; each player's `StateView` holds only
  its own player, a spectator's holds all. A room test decodes another client's state to prove
  nothing leaks.
- UI-only state (shift preview, local rotation, the last turn's marks, the hint) never crosses the
  network.

## Rules package — Implemented

`packages/rules/src/`: `geometry` (squares, directions), `tile` (kinds, openings, rotation),
`board` (validated board, fixed squares, connections), `tileSet` (static 50-tile catalogue with
the 24 treasures), `rng` + `setup` (seeded board; draw order pinned by a golden test), `shift`
(`shiftBoard`, insertion ids, reverse rule), `move` (reachability, shortest path), `treasures`
(deals, collect and win), `turns` (next seat, kick rule, clock limits), `bot` (the replaceable
`BotStrategy` over a fair `BotView`, `chooseBotTurn` = the sampling bot in `botSampling`: the
look-ahead in `botLookahead` (typed-array board, one own turn plus every next shift, averaged
opponent blocking; each seat's optional public `foundTreasures` rules those out as an opponent's
targets) proposes its best choices, and each is played out one round ahead with greedy turns for
everyone against opponents' targets sampled from the treasures still possible; fixed work per turn,
~11 ms on a desktop; the look-ahead and the old greedy one are kept for the tournament, `botSeed`),
`botHint` (the "Vihje" hint: the bots' strategy in the viewer's seat, always blocking, rng seeded
from the position; `hintTurn` for the shift step,
`hintMove` for the move step after a shift; the client maps its view to a `BotView` with only
its own target in `client/src/game/hint.ts`), `game` (a whole game as JSON-serialisable data: `startGame`, `applyShift`, `applyMove` with the
server's rejection codes and order, `removeSeat`, `endGame`, `botViewOf`, `botRngFor`; the one
rules engine of the device's games, the server's rooms and the tournament), `botTournament`
(whole games among strategies through the engine, win rates and ms per turn; not in the package
entry). Test fixtures in
`@palikka/rules/testing` (`boardFromRows`, `boardToText`). Board coordinates: `(row, col)`
0–6 from the top-left; tile ids never change, which is what the client animates by.

## Client — Implemented

```
client/src/
  App.tsx       StartScreen → WaitingRoomScreen (phase waiting) → GameScreen
  screens/      the three screens
  session/      useGameSession (join, rejoin, commands, local-first leave), viewModel
                (state → GameView), useOpenGames, serverWake, nickname, inviteLink, sessionToken
  game/         board SVG and its layers, turn line, player strip, step/kick/leave controls
  tips/         first-game tips (pure pick + localStorage) and the start screen's reset link
  settings/     device settings store, settings screen, theme, generated sounds, turn alert
  howto/        the rules screen ("Näin pelaat"), pictures drawn with the board's own tile and pawn
  ui/           tokens.css and shared components (Screen, Message, Button, Badge, Notice, …)
  logging/ i18n/ config.ts CrashBoundary.tsx
```

- **Server state is the truth.** `toGameView()` turns synced state into an immutable `GameView`;
  components render it. Previews (shift and the reach after it) are computed locally with the same rules functions;
  the last turn's marks (where the tile was pushed in, marked outside the board edge; walked route) are derived by comparing successive views.
- **UI foundation:** every colour, spacing and radius is a token (light and dark); CSS Modules;
  anything shown twice is a shared component. Board: one SVG, 100 units per tile; pawns = seat
  colour + shape; tiles and pawns animate with CSS transforms keyed by id; reduced motion honoured.
  Tiles draw only treasures still in play: the collected set is the union of every seat's `found`
  (synced to players and spectators), except that the viewer's target tile always shows its treasure.
- **Session:** a per-tab reconnection token (sessionStorage) rejoins after a reload; the last
  nickname is kept in localStorage only to prefill the field. A seated player's unfinished game is
  also remembered in localStorage (token, room, last seen; refreshed every 15 s and on hide), so a
  newly opened app offers "Jatka peliä" within the server's 5-minute seat hold. `leave()` is local-first: the start
  screen shows at once, then `room.leave()`. Close codes 4100/4101 and join failures become a
  start-screen notice.
- **Local play:** a quick game against bots is a `LocalRoom` (`session/localRoom.ts`) that
  implements the same `GameRoomLike` as a Colyseus room, over the rules `game` engine: it exposes
  the synced-state shape (only the player's own target), answers commands with `CommandResult`,
  plays bots with the server's pauses and fallback (and the player's seat while it is auto-played,
  saved with the game), and has no turn clock. The connector routes by
  prefix: room ids `local-…` and tokens `local:…` (`reconnect`, and `joinById` for rematch) go to
  the device, everything else to the server; the SDK client is created only for server games. The
  one local game (with its pawns by seat) is saved in localStorage (`palikka.localGame`) after every step, so a reload,
  an app update or "Jatka peliä" (no time limit for a local token) continues it, also offline.
  A game of bots to watch ("Pelaan itse" off) is a `LocalRoom` too: ids `local-watch-…`, bots in
  seats 1..n, no seat for the viewer (so the view model sees a spectator), every target synced,
  `setSpeed` divides the pauses; it is never saved, so a reload ends it.
  Start and end are logged as `client.local.started` (`watch: true` for a watched game) /
  `client.local.finished`.
- **Daily puzzle:** a `LocalRoom` of a solo game from the rules' `startDailyPuzzle(date)`: the
  local date seeds the board, and a breadth-first search over shifts (`fewestTurns`, a board plus
  the set of squares the pawn could be on per node) picks a destination treasure whose best is 2
  turns, the puzzle's par. Its room ids start with `local-daily-` and it has its own save slot
  (`palikka.dailyGame`, with a history of states for the client-only `undo` command), so it and
  a quick game never replace each other; leaving an unfinished puzzle keeps it. `palikka.daily`
  records the date, the current attempt, the par and the day's best solve (fewest turns over any
  number of attempts). The view model spots a puzzle by its room id; local games also report
  `turn` (and a puzzle its `par` and `undoable`). The puzzle's hint and the end screen's
  best-route replay use the same search with shift paths (`bestLine`, `bestMove`); the replay is
  view state only (frames rebuilt from the date). Logged as `client.daily.started` /
  `client.daily.finished`.
- **PWA:** `vite-plugin-pwa` builds the manifest and a Workbox service worker that precaches the
  app shell (auto-update: a new version takes over on the next load and reloads once; both kinds
  of game survive a reload). Off in `vite dev`. Icons are generated from `public/favicon.svg`.
- **First-game tips:** which one-time tips were seen is kept in localStorage
  (`palikka.tips.seen`); the tips take plain props from the game screen, so they do not depend on
  the session or its transport.
- **Device settings:** one localStorage record (`palikka.settings`), merged over the defaults
  and read through a small subscribe store, so a change applies at once; never sent to the server.
  The settings screen opens from the gear on the start screen and in the game's top bar (in the game
  it covers the board while the game runs on; the language choice lives there). Theme = `data-theme`
  on `<html>` (set before the first paint by an inline script in `index.html`, then by `theme.ts`; `tokens.css` holds the dark tokens for the media query and the forced
  attribute). Sounds are generated with Web Audio (no files). The turn alert fires when the viewer's
  own turn begins (sound, vibration; the tab title only while the page is hidden).
- **Sub-screens:** settings and the rules screen are not routes: the start screen and the settings
  screen swap themselves for them through local state, so "Takaisin" returns to where they opened
  (during a game: game → settings → rules). The rules open from a link on the start screen and a row
  in the settings.
- **Early wake-up:** the start screen fetches `/health` once per page load (retries up to 90 s) so
  a sleeping Render server wakes while the player types; server join actions wait for it (local
  bot games and a local "Jatka peliä" do not), and the screen
  counts the seconds waited.
- **i18n:** Finnish is the key source of truth (type-checked), a test enforces fi/en parity.
  Language: `?lng=` → saved choice → Finnish.
- **Logging:** pino browser build, batched to `POST /client-logs`; global error handlers and
  `CrashBoundary` log `client.error`. See [operations.md](operations.md#logs--implemented).
