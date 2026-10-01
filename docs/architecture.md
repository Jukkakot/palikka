# Architecture

How the solution is built: structure, flows and contracts. Details (function lists, UI texts,
component behaviour) live in the code and in [`openspec/specs/`](../openspec/specs/); this page
only points to them. Status markers: **Implemented** = on `main`; **Planned (`change`)** = agreed,
delivered by that roadmap change.

> Server and device games run the **real rules** (`packages/rules`) with the piece tray and the
> placement preview (`basic-ui`); the daily puzzle runs on the device only (`daily-puzzle`).

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

- **Game kit:** the generic room, lobby, bot runner, session and device-game logic live in the
  `packages/kit-*` workspaces (`@game-kit/*`), driven by the [game contract](#game-contract--implemented);
  Palikka implements the contract. The kit moves to its own repository in `game-kit`.
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
| `packages/kit-protocol` (`@game-kit/protocol`) | The game contract (`GameRules`), generic codes, payloads, join options and their schemas, close codes, turn rules (clock, hold, kick), client log events; the Connect Four test game in `@game-kit/protocol/testing`. | Import a Palikka package or a file outside itself. |
| `packages/kit-server` (`@game-kit/server`) | `LoggedRoom`, the command wrapper, room ids, server logging, the watch route, `LobbyState` and `KitGameRoom` (seats, host, bots, runner and fallback, clock, kick, autoplay, spectators, rematch, options). | Same; know any game's rules or synced data. |
| `packages/kit-client` (`@game-kit/client`) | `useKitSession`, the connector, `LocalRoom` (device games, undo, the versioned save), `toLobbyView`, the bot runner, the stores, server wake-up, the open-games list, client logging; configured by the game (`configureKit`). | Same; pull zod or Colyseus schema into the bundle. |
| `packages/rules` | Game rules as pure functions on plain data. Randomness only from an injected seed. `palikkaRules` (`contract.ts`) is the contract's rules part over the match layer. | Depend on React, Colyseus or any I/O. |
| `packages/protocol` | Palikka's part of the wire, re-exporting the kit's: placement codes, board constants, the move and options schemas, the event catalogues under their old names. zod schemas sit in `*-schema.ts` modules; rules the client needs are plain functions, so the client bundle has no zod. | Contain game logic. |
| `packages/bots` (`game-bots`) | Game-independent bot brains: a game interface, budgets, players (greedy, best-reply search, MCTS), the Web Worker harness (`game-bots/worker`), and the tournament core (schedule, pairwise results, Elo, report). | Know any game; carry Palikka names. |
| `packages/palikka-bots` (`@palikka/bots`) | Palikka's adapter to `game-bots`, its evaluation, the worker entry point `chooseMove`, the tournament bot registry and formats; Node-only tournament CLI in `cli/`. | Do I/O or hold state in `src/` (the client bundles it); Node code stays in `cli/`. |
| `server` | Palikka's room (its server definition on `KitGameRoom`), the app and its HTTP routes. Source of truth. | Trust the client; compute bots (beyond the fallback). |
| `client` | Rendering, input, Palikka's view model and client definition, i18n, settings. | Hold authoritative state of server games. |

The kit's boundary is enforced: `.oxlintrc.json` forbids `@palikka/*`, `game-bots` and relative
paths three or more levels up in `packages/kit-*`, and `packages/kit-protocol/test/boundary.test.ts`
checks that every relative import of a kit package stays inside it.

**No build step between packages:** the `packages/*` workspaces export a `source` condition pointing at
`src/index.ts`; Vite, Vitest and `tsx` resolve it. The server production build uses `dist/`.

## Server — Implemented

- Entry `server/src/index.ts` (port `PORT`, default 2577); rooms and routes in `app.config.ts`.
- Every room extends `LoggedRoom`: readable room id (`brave-otters-sing`, also the `room` field of
  every log line), lifecycle logging, `this.command()` for commands, `holdSeat()` for drops.
- Rooms: `game` → `GameRoom` (Palikka's `palikkaServer` definition on the kit's `KitGameRoom`;
  `filterBy(["pool"])`, realtime listing on) and `lobby` →
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
- **Adding a kit command** (every game has it): (1) payload type in `kit-protocol/src/codes.ts`,
  schema in `schema.ts`, error codes in `KIT_ERROR_CODES`; (2) a `KitGameRoom.kitMessages()` entry;
  (3) a `useKitSession` method; (4) the command in `LocalRoom` if device games need it; tests over
  Connect Four in the kit; `errors.<CODE>` strings in each game.
- **Adding a game command** (Palikka only): (1) codes in `protocol/src/game-codes.ts`, schema in
  `game-schema.ts`; (2) `GameRoom` adds it to `messages` (spread `kitMessages()`), using the
  protected helpers (`requireSeated`, `requireHostInWaitingRoom`, `options()`, `game()`); (3) a
  method in Palikka's `useGameSession` over `command(name, payload)`; (4) `errors.<CODE>` in fi/en.
  The move and the options need no command of their own: they ride on `move` / `setOptions`.

## Game flow — Implemented

```
 create/join ──▶ waiting ──start──▶ play (turn → next seat …) ──▶ finished
 (nickname)     host = 1st joiner   └─ 120 s turn clock ─┘  end: no colour can move, or last player standing
```

- **Joining:** join options `{ nickname, pool?, watch?, botSeats?, options? }` (strict; Palikka's
  `options` are `{ variant }`) are
  validated in `onCreate` and `onAuth`; refusals are a `ServerError` whose message is the code
  (`INVALID_NICKNAME`, `INVALID_OPTIONS`, `SERVER_FULL`). `options` are only set by a rematch (a new
  room is Perus). Seats: lowest free 1 up to the variant's player count (Perus 4, Duo and Tuplaväri
  2, Kolmikko 3), taken only in the waiting room; in Perus the seat is also the player's colour.
  `MAX_OPEN_GAMES` caps the rooms.
- **Waiting room:** the first joiner hosts. A guest leaving frees the seat; the host leaving closes
  the room (`HOST_LEFT` 4101). Every room is public; friends come in by the invite link. Metadata
  `{ host, open, pool, seated, watchable, options }` feeds the start screen lists.
- **Variant:** the host's generic `setOptions { options: { variant } }` in the waiting room
  (`NOT_HOST`, `WRONG_PHASE`; `TOO_MANY_PLAYERS` when more people, or a person in a higher seat,
  than the options' seat range takes). The kit removes bots on seats above the range (`bot.removed`
  with `reason: "options"`), resets the game child (Palikka resizes `cells` to the variant's
  board), sets `maxClients` and the listing's `options`, and logs `options.changed { from, to }`. `start` needs the variant's minimum
  (`NOT_ENOUGH_PLAYERS`; Kolmikko 3). A rematch keeps the variant.
- **Game engine:** the kit room calls the rules only through the contract (`palikkaRules`); it holds the game as the rules' match layer `Game`
  (`packages/rules/src/game.ts`: variant, seats, colour → seat `control`, seats that left, the
  engine's `Position`, winners as seats; the same as the device's games) and every rule goes
  through it: `startGame(seed, seats, variant)` (colour 1, in Perus the lowest seat's, first),
  `seatOnTurn` (the seat that plays the colour on turn; the shared colour rotates), `playMove`
  (`move { move: { piece, orientation, row, col } }` for the colour on turn by its seat; refusals
  `NOT_YOUR_TURN`, `PIECE_USED`, `OFF_BOARD`,
  `OVERLAP`, `EDGE_CONTACT`, `NOT_ON_START`, `NO_CORNER_CONTACT` …), `removeSeat`, `endGame`.
  Stuck colours are passed by the engine. The synced schema mirrors the engine after each change;
  the room keeps only what is not a rule (seats and connections, clock, bot timers, logs).
- **Turn clock:** 120 s per turn; expiry only sets `turnExpired`, which lets the others `kick` the
  slow player (`KICKED` 4100).
- **Removal** (left, kicked, or a 5-minute drop hold ran out) is the single way out; the leaver's
  squares stay and all its colours are out and cannot win; the last player standing wins, or the
  turn passes (also when the leaver was to play the shared colour: the next staying seat does).
- **Logs:** `game.started` and `phase.changed` to `play` carry the options (`variant`); the turn
  facts (`colour`) come from `turnFacts`, `turn.changed` adds `out` (`turnLogFacts`), `game.finished`
  adds `scores` (`finishFacts`), a refused move's audit line `move` (`moveText`).
- **Bots:** the host's `addBot` / `removeBot { seat }` in the waiting room; a bot is a `Player`
  with `bot = true`, keyed `bot:<seat>`, named Kettu, Ilves, Pöllö, Näätä. The **bot runner**
  (`botRunnerSeat`: the host while connected, else the lowest connected person, else 0; logged as
  `bot.runner`) computes the moves of bot-played seats (bots and auto-played people) and sends
  `botMove { seat, move }` after the 1 s pause (divided by `botSpeed`); the server accepts it only
  from the runner (`NOT_BOT_RUNNER`), for a bot-played seat (`NOT_BOT_SEAT`) that plays the colour
  on turn (`NOT_YOUR_TURN`), legal; the move is placed in the colour on turn. **Fallback:** with no runner after the pause, or with a silent runner 10 s after it, the room
  plays the rules' `fallbackMove` (Palikka: `simpleBotMove` for the colour on turn) itself through `move` (audit `bot: true`, `bot.fallback`
  with `reason` `noRunner` / `runnerSilent`).
- **Autoplay:** `setAutoplay { on }` hands a person's seat to the bot; a dropped player is
  auto-played during the seat hold; a reconnect ends only a drop's autoplay.
- **Nobody left:** no person seated and nobody watching → the game finishes with no winner.
- **Spectators:** `POST /watch` reserves a seat in a running, watchable room (≤ 8 spectators);
  `setSpeed` works while only bots play.
- **Rematch:** `rematch` (seated, finished) creates one new room with the same pool, variant and bots; its id
  is synced as `rematchRoomId` and clients `joinById` it.

## Game contract — Implemented

- **Rules part** (`GameRules<G, M, O>` in `@game-kit/protocol`, pure, shared by server and device
  games): `seatRange`, `start`, `seatOnTurn`, `turnFacts`, `play`, `removeSeat`, `isOver`,
  `winners`, `end`, `fallbackMove`, `finishFacts`, `moveText`. Palikka: `palikkaRules`.
- **Server part** (`GameServerDefinition` in `@game-kit/server`): the move and options schemas,
  default options, the synced child schema with `reset(options, child)` / `sync(game, child)`, and
  optional `optionsChange`, `turnLogFacts`, `stateFacts`. Palikka: `palikkaServer` in `GameRoom.ts`.
- **Client part** (`GameClientDefinition` in `@game-kit/client`): `toView(state, lobby)`,
  `askBot(view, speed, seed)` for the online runner, and `local` for device games (save key and
  check, seats, `parseMove`, `askBot(game, speed)`, `child`, `turn`, `logFacts`). Palikka:
  `client/src/session/palikkaClient.ts`.
- The kit's own test game is a minimal Connect Four (`@game-kit/protocol/testing`, 2–4 seats);
  every kit suite runs over it.

## State sync — Implemented

- Synced: the kit's `LobbyState` (`packages/kit-server/src/rooms/LobbyState.ts`): players (seat,
  nickname, `bot`, `autoplay`, connected), `phase`, `turnSeat` (the seat that plays the turn),
  `turn` (turns started), `hostSeat`, `winners`, `turnDeadline`, `turnExpired`, `botRunnerSeat`,
  `spectators`, `botSpeed`, `rematchRoomId`, and `game`, Palikka's child
  (`server/src/rooms/schema/GameState.ts`): `variant`, `cells` (owner colour per square, row-major,
  board size², Duo 14×14), `colours` (per colour: `seat` that plays it, 0 = shared; placed `pieces`
  in order, `out`, `left`), `turnColour` (the colour on turn). No hidden information: everything a player may know is public.
- The client rebuilds the engine's `Position` from it (`GameView.position`: the variant's board,
  sides from the colours' seats), so the placement preview, the hint and the bot runner use the
  same rules as the server.
- UI-only state (the chosen piece, its orientation, the preview, the hint) never crosses the
  network.

## Rules package — Implemented

`packages/rules/src/`: `pieces` (the 21 pieces `I1 … Z5`, 91 orientations generated at load, stable
indexes pinned by a golden snapshot; `turnOrientation` / `mirrorOrientation` tables), `config` (`BoardConfig`, `CLASSIC` 20×20), `variants`
(`VARIANT_IDS` `classic` / `duo` / `double` / `trio`, `VARIANTS` with board, player counts,
colour groups per seat and the shared colour; `DUO` 14×14 with start squares (4,4) and (9,9)), `bitboard` (one
32-bit word per row), `position` (`Position` as plain JSON, a cached bitboard view per position
object, `sides`: colour → the seat it scores for, 0 = shared; `checkPlacement` with one refusal code), `moves` (`Placement` ↔ integer `Move` code),
`movegen` (corner-based `legalMoves`, `hasLegalMove`, `fittingPieces`, `freeCorners`, `forbiddenSquares`), `play`
(`applyMove`, `pass`, `resign`, `abort`; automatic passing), `scoring` (`scores` per colour,
`sideScores` per side without the shared colour, `winners` = best sides), `game` (the match layer:
variant, seats, `control` colour → seat, `controllerOf` / `seatOnTurn` with the shared colour's
rotation `staying[placed.length % staying.length]`, leaving resigns all of a seat's colours,
winners are seats among those who stayed; the room's and `LocalRoom`'s one engine), `bot` (`simpleBotMove`: largest piece first, seeded; the server's
fallback), `turns` (kick rule, clock limits), `rng` (seeded `xoroshiro128plus`), `puzzle` (the daily
puzzle: `dailyPuzzle(date)` packs the day's pieces into a compact, hole-free shape from a date seed,
so it is solvable by construction; `puzzleFits`, `puzzleSolved`; `PUZZLE_VERSION` is part of the
seed and changes every day's puzzle when bumped).
`@palikka/rules/testing` has `referenceMoves` (naive generator), `randomGame`, `placement` and
`positionWith`. Property tests (fast-check) check the fast generator against the reference along
random games, also in every variant with random leavers. `RULES_VERSION` 1.1.0 (variants).

Move generation speed (`npm run bench -w @palikka/rules`, 40 seeded random 4-colour games, a full
list for every colour still in at every position; developer desktop, 2026-09-29): **0.034 ms per
move list, about 5.5 million moves/s** (target was under 0.5 ms).

## Bots — Implemented

- **`game-bots`** (`packages/bots`): a game plugs in as a `Game` (player to move, legal moves,
  play, game over); search needs a `MultiplayerGame` on top (players still in, a player's moves and
  playing one out of turn, a cheap move key for ordering, optionally `opponents(state, player)`:
  best-reply search lets only these answer, so partners are never searched as opponents). A `Bot` answers
  `choose(state, budget, rng)`. `Budget` is plain JSON (`timeMs`, `depth`, `iterations`; whichever
  runs out first, a bot ignores limits that do not apply to it). The rng is injected, so a seed
  fixes the choice. Players:
  - `greedyBot` (one ply, seeded tie-breaking, best so far at the time limit), `randomBot`.
  - `rankMoves(game, evaluate, state, player, n, rng?)`: the `n` best moves one ply deep, best
    first, ties in seeded order (the first equals `greedyBot`'s move for the same rng). No time
    limit: it rates every move.
  - `bestReplyBot` (`search/brs.ts`): Best-Reply Search. The root player's layers alternate with
    one layer where the single most harmful reply of any opponent still in is searched; alpha-beta,
    iterative deepening, beams (10 root moves by their one-ply value, then 6 own moves and 3
    replies per opponent by the move key). Depth 1 is exactly the greedy pass and always finishes
    first, then depth 3, 4, … (depth 2 measured weaker than greedy, so it runs only for a budget of
    exactly depth 2). It is therefore never weaker than greedy under a time limit, and a cut deeper
    iteration keeps the previous depth's answer.
  - `mctsBot` (`search/mcts.ts`): max^n UCT with progressive widening in key order, short keyed
    playouts rated by the evaluation (logistic against the players' mean); budget in iterations.
  - Worker harness (`game-bots/worker`): `serveBotWorker` in the worker, `botWorkerClient` in the
    page (ids, lazy worker, answers in the page when no worker can run, on an error reply or after
    a crash, reported through a callback).
- **`@palikka/bots`** (`packages/palikka-bots`): `palikkaGame` over the rules engine (off-turn
  moves via the rules' `withTurn`, which keeps the cached bitboards), `opponents` (colours of other sides; the
  shared colour opposes everyone), `evaluate` (for the colour's side: the side's score, its free
  corners and reach exclusive to the side against the opposing colours' average, won/lost end by
  side), `moveKey` (piece
  size, opponents' free corners covered, new own corners; boards cached per position), the players
  `greedyPlayer`, `brsPlayer`, `mctsPlayer`, `randomPlayer`, **`devicePlayer` = `brsPlayer`** (the
  bot people play against), `playGame` and the worker entry point
  `chooseMove(position, colour, budget, seed | rng, bot = devicePlayer, viewpoint?) → Placement | undefined`.
  For the shared colour (side 0) with a `viewpoint` (a colour of the seat that plays it this turn)
  it picks the legal move best for that side one ply deep, seeded (variants design D6).
- Strength and speed (developer container, 2026-09-29, `npm run bench -w @palikka/bots -- <bot>`):
  greedy ≈ 14 ms per move; `brs@d2` 20 ms, `brs@d3` 43 ms, `brs@d4` 148 ms; in 200 ms BRS reaches
  depth 4 on average (up to 8 late in the game), in 800 ms depth 5. `mcts@i400` ≈ 380 ms. Depth
  matters: `brs@d2` loses to greedy (42.5 %), `brs@d4` beats it (68 %). At 200 ms per move (about a
  phone's work at the real 800 ms), BRS beats greedy 61 % and MCTS 66 % (bot-search design).
  A unit test keeps greedy ≥ 90 % against three random players.
- **Tournaments and Elo** (strength is measured, not guessed):
  - `game-bots` `tournament/`: a round robin of named bots; each pairing's games come in seed
    pairs with the seats swapped. A finished game becomes **pairwise results** (every two colours
    of different bots, by final score: 1 / ½ / 0). Ratings are Bradley–Terry maximum likelihood on
    the Elo scale (order-independent, one virtual draw per pairing, `random` or the first bot
    anchored at 1000). Each pairing's share gets a 95 % Wilson interval with the seed pairs as the
    independent unit. The game supplies only "play this scheduled game → seats and scores".
  - `@palikka/bots`: the bot registry (`random`, `greedy`, `brs`, `mcts`; a name may carry a
    budget: `greedy@200ms`, `brs@d4`, `mcts@i400`), formats (`--colours 4`: one bot on 1 and 3, the other on 2 and 4;
    `2`: colours 1 and 2; `duo`: colours 1 and 2 on the Duo board), `playTournamentGame` with per-move timing; `cli/` runs games on worker
    threads (`worker-entry.mjs` registers tsx's loader in each worker), prints the Markdown report
    and writes JSON.
  - **Strength requirements** live in `packages/palikka-bots/strength.json` ("candidate beats
    baseline ≥ X over N games"); `npm run strength` fails when one is missed. The workflow
    `tournament.yml` runs it when bot or rules code changes (operations → Bot tournaments).
  - Measured (4 cores, 2026-09-29): greedy beats random 99.7 % (4 colours); greedy vs
    `greedy@5ms` 58.9 %; about 0.65 s per 4-colour greedy game per core.
- **In the client** (`client/src/bots/`): `bot.worker.ts` serves `chooseMove` (the device bot) in a
  module Web Worker through the library harness (own size-limit entry); `askBotWorker` asks it and
  answers in the page where no worker can run. Budget 800 ms (divided by the watching speed). The
  bot is asked as soon as its turn begins and thinks during the 1 s pause: its move lands when the
  pause is over and the answer is there, whichever is later. That holds in `LocalRoom` and in the
  online bot runner (the kit's `useBotRunner`, which sends the move as `botMove`). Both ask for
  the colour on turn, with the seat's own colour as `viewpoint` for the shared colour. The hint uses
  `topMoves` (`rankMoves` over `evaluate`, top 3, seeded by the turn, UI thread, computed once per
  turn on the first press; about 5–30 ms on a desktop), with the viewer's colour as viewpoint on a
  shared turn.

## Client — Implemented

```
client/src/
  App.tsx       StartScreen → WaitingRoomScreen (phase waiting) → GameScreen
  screens/      the three screens
  kit.ts        configureKit: storage prefix "palikka", server URL, version, key log events
  session/      useGameSession (the kit's useKitSession + place/setVariant), viewModel
                (toView: state.game + lobby view → GameView), palikkaClient (the client
                definition: bot asks, device-game seats, save check, listing reader), devShortcut
  bots/         the bot worker and its client
  game/         board, piece tray, placement model (placing, usePlacement), turn line, player
                strip, result table, controls (place/undo/kick/leave/autoplay/spectate)
  tips/         first-game tips (pure pick + localStorage) and the start screen's reset link
  settings/     device settings store, settings screen, theme, generated sounds, turn alert
  howto/        the rules screen ("Näin pelaat")
  motion/       generic motion helpers: board diff, useLastMove, useEnded, useCountUp, useBlip,
                usePrevious, prefersReducedMotion, Snowfall
  puzzle/       the daily puzzle: screen, state hook, fit-rule placing, device store
  ui/           tokens.css (theme "Kuura", light + dark) and shared components
  logging/ i18n/ config.ts CrashBoundary.tsx
```

- **Server state is the truth.** The kit's `toLobbyView()` and Palikka's `toView()` turn synced
  state into an immutable `GameView` (`LobbyView<SeatView> & PalikkaView`; `toGameView()` does both);
  components render it. Variants: `variant`, `boardSize`, `maxSeats`, `turnColour`, `turnShared`,
  per seat `colours` (scores summed), `myColours`, and `trayColour` (the colour on turn when the
  viewer plays it, else their own next colour in turn order that is not out); the tray, the
  placement, the free-corner dots and the preview use `trayColour`.
- **UI foundation:** every colour, spacing and radius is a token in `ui/tokens.css` (theme Kuura:
  flat squares, seat colours Järvi / Lakka / Puolukka / Kuusi; light and dark, following the
  device unless forced in the settings); CSS Modules; anything shown twice is a shared component
  (`SeatMark` = a seat's colour everywhere).
- **Session:** a per-tab reconnection token (sessionStorage) rejoins after a reload; a seated
  player's unfinished game is remembered in localStorage, so a newly opened app offers "Jatka
  peliä". `leave()` is local-first. Close codes 4100/4101 and join failures become start-screen
  notices.
- **Local play:** a game against bots is the kit's `LocalRoom` with Palikka's definition, implementing the same `GameRoomLike` as a
  Colyseus room over the rules' match layer: same synced-state shape, same `CommandResult`s, bots
  from the worker, which thinks during the server's pause (a refused or missing answer falls back to
  `simpleBotMove`), no turn clock. `undo` ("Peru") restores the game before the player's last own
  move (any colour the player played, the shared colour too; history of `{ seat, game }`, stale bot
  answers dropped). Any variant: Perus takes 1–3 bots (2–4 to watch), the others their own count
  (`botCount`); the bot on turn is the seat that plays the colour on turn. Ids `local-…` / tokens
  `local:…` route to the device; the variant lives in the saved `Game`. Saved in localStorage
  (`palikka.localGame`, the kit's envelope version 2 with seats and options) after every step; a
  save without that version (before the kit) or of an older game format (before the variants: no
  `variant`, `control` or `sides`) is dropped. Watched bot games (`local-watch-…`) are never saved.
- **Piece controls:** the viewer's 21 pieces sit in the tray (`PieceTray`; placed = empty slot,
  pieces that fit nowhere frozen on and off turn, from the rules' `fittingPieces` via
  `usePlacement.fitsAnywhere`). `usePlacement` holds the choice
  (piece, orientation, aimed square) for the current turn; `turnOrientation` / `mirrorOrientation`
  step the orientation ("Käännä", "Peilaa", R, F). `placing.ts` turns an aim into a preview: a
  pointer snaps to the legal spot of that orientation covering the square whose reference square
  (the cell nearest the piece's centre) is nearest; with none, or from the keyboard, the piece sits
  exactly there and `checkPlacement` gives the reason. One click rule for every pointer: a click
  inside a legal preview places it, any other click moves the preview (a mouse previews on hover,
  so one click places; touch needs two taps). "Aseta" and Enter place too. "Vihje" puts the bot's
  best move into the preview; pressed again, the second and third best ("Vihje 2/3", `topMoves`).
  Every way of placing ends in the same preview and the same one confirming tap.
- **Corner mode** (`usePlacement`): with no piece chosen, a tap on a free corner narrows the tray
  (`fitting`) to the pieces with a legal move covering it (`piecesCovering`, from the cached
  per-position legal-move list in `placing.ts`); one fitting piece is chosen at once. A chosen piece
  shows its first spot on the corner, "‹ n/m ›" (`step`) cycles its spots in engine order, wrapping.
  Another free corner switches; any other square, the chosen piece again, R/F, the arrows or a drag
  leave corner mode, keeping the piece.
- **Drag** (`usePieceDrag` + `usePlacement.dragStart/dragTo/dragEnd`): pointer events, no library.
  A press on a fitting tray piece or on the preview that moves over 8 px starts a drag; the
  `FloatingPiece` (fixed, no pointer events, the board's square pitch) is held by its reference
  square, 1.5 squares above a finger. The board square under that square (`elementFromPoint`) is
  the aim; the landing spot is recomputed once per square and snaps only within one square
  (`Aim.near`), else it is the exact spot, illegal with the reason. Release over the board keeps it
  as the preview (never places); elsewhere the drag is cancelled and the previous preview returns.
  The click that ends a drag is ignored. Tray pieces that can be dragged and the preview's squares
  have `touch-action: none` (so the browser does not scroll instead); the whole board only while
  dragging.
- **Phone view** (`game/boardView.ts`, `ui/usePhoneLayout.ts`): "phone" is the negation of the
  wide layout's media query. A seated player's board turns in quarter turns (`ViewTransform`,
  `turnsFor` their first colour's start square) so it is at the bottom-left; spectators and the wide
  layout are unturned. Only the view turns: `Board` renders squares in screen order and reports
  board indexes; the tray and `FloatingPiece` draw `screenOrientation`s; "Peilaa" mirrors as seen
  (`mirrorOnScreen`), the arrows move in screen directions (`boardDirection`). On the viewer's turn
  the board zooms (`zoomBox`: free corners on screen + 2, at least 10 squares, widened for the
  preview, the whole board from 16) with a CSS scale/translate of the grid in a frame with
  `overflow: clip` (not `hidden`: a hidden frame can still be scrolled by focus or scrollIntoView).
  The control bar's zoom toggle (phone only) is the `boardZoom` setting. The start screen's bot way
  starts at the `lastVariant` setting, else Duo on a phone and Perus otherwise.
- **Motion** (`motion/`, CSS keyframes only, tokens `--motion*`, `--frost*`, `--last-mark`,
  `--snow`): the last move comes from a board diff in the client (`useLastMove`: squares empty
  before and filled now; an update that only empties clears it; the first board and another room
  have none), so bot, online and catch-up moves all work with no protocol change. `Board` marks
  `lastMove` (ring + small square, static) and settles `fresh` squares; the puzzle passes only
  `fresh`. `usePlacement.nudge` (refused tap, Enter or drop) shakes and `hintShown` pulses the
  preview (`useBlip`, so a preview moved later does not replay it). The tray and the player strip
  compare with the value before the last change (`usePrevious` by content) to freeze only on a
  seen transition. The end celebrates only when `useEnded` saw `finished` turn true (not after a
  reload): `ResultTable` counts up (`useCountUp`, the final score in accessible text) and shimmers
  winners; `Snowfall` when the viewer won or spectates; the puzzle's solved panel too. The global
  `prefers-reduced-motion` rule stops all keyframes; the count-up and snowfall check it themselves.
- **Layout:** phone portrait stacks turn line, players, board, control bar and tray; from 900 px
  landscape the board sits left and the rest in a column beside it (`GameScreen.module.css`).
- **Result:** a finished game shows `ResultTable` from `GameView.results` (every player ranked by
  score with shared ranks, their colour marks, squares, pieces left summed over their colours,
  winners, players that left; a shared colour row last, "ei lasketa", no rank).
- **Turn line:** in Tuplaväri and Kolmikko the colour's name comes first ("Puolukka · …",
  "Kuusi (yhteinen) · …"); Perus and Duo keep the plain text.
- **Variant picker:** `game/VariantPicker` (four chips as a radio group, a line about the chosen
  one) in the start screen's bot way and the host's waiting room (others see "Pelimuoto: …"; the
  waiting room shows the variant's seats with each seat's colours).
- **Start screen:** two equal ways in: "Pelaa botteja vastaan" (a variant; in Perus 1–3 bots or 2–4
  to watch, in the others the variant's count, on the device) and "Luo peli kavereille" (`create`:
  always a new online game, waits for the wake-up); the open and running games of the pool show
  under "Liity peliin" only when there are any, each with its variant and seats (`seated/maxSeats`).
- **Daily puzzle ("Päivän pulma"):** `puzzle/`, device only, no server. The start screen's
  secondary entry opens `PuzzleScreen` (lazy-loaded chunk). The puzzle of the device's local date
  comes from the rules' `dailyPuzzle`. Placing reuses `Board` (with `outside` squares), `PieceTray`
  (only the puzzle's `pieces`) and the reference-square aiming of `placing.ts` under the puzzle's
  fit rule (`puzzlePlacing.ts`). A tap on a placed piece lifts it. `usePuzzle` holds the state and
  a clock that runs only while the screen is open and visible. `puzzleStore.ts` keeps today's
  progress, today's result and the records (streaks, best time per piece count) in localStorage
  (`palikka.puzzle`). A solve ships `client.puzzle.solved`.
- **PWA:** `vite-plugin-pwa` (auto-update service worker, off in `vite dev`); icons generated from
  `public/favicon.svg`.
- **Early wake-up:** the start screen fetches `/health` once per load so a sleeping server wakes
  while the player types; server join actions wait for it (device games do not).
- **i18n:** Finnish is the key source of truth (type-checked), a test enforces fi/en parity.
- **Logging:** pino browser build, batched to `POST /client-logs`; see
  [operations.md](operations.md#logs--implemented).
