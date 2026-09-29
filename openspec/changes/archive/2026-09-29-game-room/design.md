# Design

## Context

`packages/rules` has the real engine (`Position`, `applyMove`, `legalMoves`, automatic passing,
`scores`, `winners`) next to the placeholder "claim a cell" engine (`board`, `game`, `bot`,
`daily`) that `server/src/rooms/GameRoom.ts` and `client/src/session/localRoom.ts` still run. Bot
turns online are played by the server today (`botStrategy` over a `BotView`). Requirements are in
`specs/`; this page is about how.

## Goals / Non-Goals

**Goals:** server room and device games on the real engine; bot moves online computed by a
player's browser in a Web Worker and validated by the server; a small bot interface the bot library
(`bot-greedy`, parallel job) can plug into; undo against bots on the device; the placeholder gone;
the game playable end to end on the live site with an interim control.

**Non-Goals:** the piece tray, rotate/mirror, drag, the new start screen and end screen (`basic-ui`);
real bots (`bot-greedy`, `bot-search`); variants; the daily puzzle (`daily-puzzle`).

## Decisions

### Rules: a match layer over `Position`

`packages/rules/src/game.ts` is rewritten as the match layer (the file name stays, the placeholder
content goes):

```
GameSeat { seat, name, bot }
Game { seed, seats: GameSeat[] (still seated), left: number[] (colours that left),
       position: Position, winners: number[] (set once ended; [] while running or aborted) }
startGame(seed, seats, config = CLASSIC) → Game     // lowest seat first
playMove(game, seat, placement) → { ok, game } | { ok: false, code: GameRejection }
removeSeat(game, seat) → Game                        // leaving (spec: A colour leaves the game)
endGame(game) → Game                                 // aborted, no winner
```

`GameRejection` = `NOT_SEATED | WRONG_PHASE | NOT_YOUR_TURN | INVALID_COMMAND` plus the engine's
placement refusals; the engine's `GAME_OVER` maps to `WRONG_PHASE` and `INVALID_MOVE` to
`INVALID_COMMAND` (the protocol's existing codes). The engine gets `resign(position, colour)` in
`play.ts` (marks the colour out and advances the turn if it was on turn, reusing the private
`advanceTurn`). Winners among colours that did not leave are computed in `game.ts`.

First turn: the lowest seated colour (colour 1 when seated), the classic convention and the order
product.md gives; the host no longer starts by rule. The room keeps its `chooseStartSeat` test hook.

### Rules: the simple bot

`packages/rules/src/bot.ts` is rewritten: `simpleBotMove(position, colour, rng): Placement |
undefined` picks uniformly among the legal moves of the largest remaining piece size, and
`botRng(seed, position, colour)` derives a deterministic rng from the game seed, the move number
and the colour (nothing to save, same move on replay). It is the interim bot of the worker, the
server's fallback and the hint ("Vihje"). The bot library replaces it in the worker later; the
server's fallback keeps it (cheap: one move list, ~0.03 ms).

### Protocol

- `place` payload becomes a placement `{ piece 0–20, orientation 0–7, row 0–19, col 0–19 }` (zod,
  strict). Protocol mirrors `PIECES_PER_COLOUR = 21` and `MAX_ORIENTATIONS = 8` without depending
  on rules; a server test keeps them equal to the rules' constants (as for the board size).
- New command `botPlace { seat, piece, orientation, row, col }` (the runner's bot move).
- `GAME_ERROR_CODES`: `CELL_TAKEN` removed; added `PIECE_USED`, `OFF_BOARD`, `OVERLAP`,
  `EDGE_CONTACT`, `NOT_ON_START`, `NO_CORNER_CONTACT`, `NOT_BOT_RUNNER`, `NOT_BOT_SEAT`; fi/en
  messages in the Kuura voice.
- Client log events: `client.daily.*` removed.

### Synced state

`server/src/rooms/schema/GameState.ts` mirrors the engine after every change:

- `cells` (owner colour per square, row-major) stays.
- New `colours: ColourState[]` (created at the start, ascending): `colour`, `pieces` (placed piece
  numbers in order, which gives the score and later the tray), `out`, `left`.
- `winnerSeat` → `winners: number[]` (shared wins).
- `Player.placed` (a turn count) is removed; the score comes from the colour's pieces.
- New `botRunnerSeat` (0 = none: the server plays the bots).
- `turn` stays a room counter of turns started (the client keys per-turn UI on it).

The client rebuilds a `Position` from `cells` + `colours` + `turnSeat` + `phase` in the view model
(`GameView.position`), so hints, the interim control and the bot runner use the same engine as the
server. No hidden information; everything a player may know is public.

### Bot runner (online)

- The room computes `botRunnerSeat` whenever seats or connections change: the host while seated and
  connected, else the lowest-seat connected person, else 0. Logged as `bot.runner` when it changes.
- A turn of a bot-played seat (a bot, or a person on autoplay) starts a server timer: with a runner,
  `botDelayMs + BOT_RUNNER_GRACE_MS` (1 s + 10 s); without one, `botDelayMs / botSpeed`. If the
  timer fires, the server plays `simpleBotMove` through the same command handler (audit line marked
  `bot: true`) and logs `bot.fallback` with `reason: "noRunner" | "runnerSilent"`. A runner change
  during a bot turn restarts the timer for the new situation.
- `botPlace` handler order: seated (`NOT_SEATED`) → running (`WRONG_PHASE`) → sender is the runner
  (`NOT_BOT_RUNNER`) → the seat is bot-played (`NOT_BOT_SEAT`) → the seat is on turn
  (`NOT_YOUR_TURN`) → the engine. Audit facts include `seat` and the runner.
- Why a fallback at all: a runner can vanish mid-turn (a phone screen off drops the connection and a
  reconnect takes seconds), a background tab can be throttled, and bot-only games watched online
  have no runner. Without a fallback the game would stall until the 120 s kick, which nobody can
  use on a bot. The fallback is the cheapest bot and never the normal path.
- The client side is `useBotRunner` (in `session/`): when the view says this viewer is the runner
  and the seat on turn is bot-played, it asks the bot worker for a move on the view's `Position`,
  waits out the rest of the pause (`BOT_DELAY_MS / botSpeed` from the turn's start) and sends
  `botPlace` directly (not through the one-command-at-a-time `send`, so it never blocks or shows a
  notice to the person); a rejection is logged as `client.warn`. A result for a turn that has
  moved on is dropped.

### Bot interface and worker

`client/src/bots/botApi.ts`, game-independent (no Palikka names):

```ts
interface BotBudget { timeMs: number }
interface BotRequest<State> { state: State; player: number; budget: BotBudget; seed: number }
type Bot<State, Move> = (request: BotRequest<State>) => Move | undefined | Promise<Move | undefined>;
```

`bots/palikkaBot.ts` adapts `simpleBotMove` to `Bot<Position, Placement>`; `bots/bot.worker.ts` runs
it (message `{ id, request }` → `{ id, move }`); `bots/botWorkerClient.ts` gives an async
`Bot<Position, Placement>` backed by one lazily created module worker, and runs the bot in-thread
where `Worker` does not exist (tests). Budget: 1000 ms (the simple bot ignores it). The bot library
plugs in by replacing the function the worker calls; the interface is meant to move into the
library package (see Coordinator to do).

### Device games (`LocalRoom`)

- Holds a rules `Game`; the synced-state shape it emits is the server's (colours, winners,
  `botRunnerSeat` 0), so the view model cannot tell them apart.
- Bots use the injected async `Bot` (the worker in the app, a synchronous stub in tests), after
  `BOT_DELAY_MS / speed`; a generation counter drops a result that arrives after an undo, a leave or
  a new turn. A bot with no move (should not happen: the engine never gives the turn to a stuck
  colour) or a refused move falls back to `simpleBotMove` and logs `client.error kind=bot.fallback`.
- **Undo:** the saved game keeps `history: Game[]`, the game before each of the person's own moves
  (not auto-played ones). `undo` (allowed while running, not watching) restores the last entry,
  cancels a pending bot move and emits `undoable`. At most 21 entries (~2 kB each in localStorage).
- **Saving:** `palikka.localGame` holds `{ roomId, game, autoplay?, rematchRoomId?, speed?, history? }`;
  loading checks the shape (`position.cells` length, colours, placed lists) and drops anything else,
  which also drops the placeholder's saves.
- The daily puzzle's save slot, record and its start-screen entry are removed.

### Client view and interim control

- `GameView` gains `position`, `winners` (replaces `winnerSeat`), `undoable` for device games,
  `botRunnerSeat`, per seat `score` (rules `scoreOf`), `squares` and `out`.
- **Interim control (until `basic-ui`):** `game/interimMoves.ts` maps each tappable square to one
  move: for every legal move of the viewer's colour, the squares it covers that are corner squares
  of the colour (diagonal to own squares and not forbidden; the start square first) get the move if
  its piece is larger than the one they have (ties: first in the engine's move order). The board
  renders only those squares as buttons ("Kulmaruutu: rivi r, sarake c"); a tap sends `place` with
  that move. "Vihje" rings the squares `simpleBotMove` would cover (seeded by the turn).
- Scores in the player strip are the rules' scores (−89 at the start); the result line names the
  winner or, for a shared win, all winners. The end screen with squares per colour is `basic-ui`'s.

### Daily puzzle

Removed until `daily-puzzle`: its placeholder is a "claim the marked cells" game with no piece
rules, keeping it would mean inventing an interim puzzle that `daily-puzzle` throws away. Removed:
`rules/daily.ts`, `LocalRoom.createDaily`, `session/dailyRecord.ts`, `DailyOver`, the start-screen
entry, the rules screen's section, `daily.*` texts except those reused, and `client.daily.*` log
events. `daily-puzzle` rebuilds what it needs.

## Meeting nfr.md

- **Logging/audit:** `botPlace` gets the same one audit line per command as every command (with
  `seat`, marked `bot: true` for server fallbacks); new `bot.runner` and `bot.fallback` (with
  `reason`) events; placement refusals log the engine's code and the move text
  (`placementText`, e.g. `F5/3@4,7`) as a fact. Client bot errors ship as `client.warn`/`client.error`.
- **Tests:** rules unit tests named after the new spec scenarios (match layer, leaving, simple bot);
  server room tests for the wiring (move accepted/refused with codes, runner selection and changes,
  `botPlace` rejections, fallback timers, time limit, leaving); client unit tests for the view model,
  `LocalRoom` (rules, bots, undo, saving), the interim move map and the runner hook; E2E smoke and
  prod smoke updated to the corner tap.
- **Performance:** bot computation off the UI thread; the worker gets its own size-limit entry;
  the interim move map is one `legalMoves` call per render of the viewer's turn (~0.03 ms).
- **Limits:** no new command without the existing rate limit and zod validation.

## Risks / Trade-offs

- [Host's device is slow or throttled] → the 10 s grace then the server's fallback; later bots
  measure their budget themselves.
- [A malicious runner sends bad bot moves] → it can only send legal moves for bot seats on turn
  (validated like any move); the worst case is weak bot play in their own game.
- [Two runners during a reconnect race] → only `botRunnerSeat` is accepted; the other gets
  `NOT_BOT_RUNNER`, logged only.
- [Interim control offers one move per square] → accepted as temporary; `basic-ui` replaces it.
- [Players' saved placeholder games vanish] → accepted (pre-release).

## Decisions made during implementation

- **The worker runs the greedy bot, not the simple one.** `bot-greedy` was merged mid-change, so
  `client/src/bots/bot.worker.ts` calls `@palikka/bots` `chooseMove` (budget `{ timeMs: 500 }`).
  The rules' `simpleBotMove` stays for the server's fallback (the server does not depend on the bot
  packages) and for `LocalRoom` when the bot's answer is missing or refused.
- **Bot interface at the worker boundary** is Palikka-specific and small: `MoveRequest { position,
  colour, budget, seed }` → `AskBot` (async `Placement | undefined`), with `Budget` taken from
  `game-bots`, whose `Bot`/`Budget` are the game-independent interface. The generic worker harness
  (message ids, in-thread fallback) could move into `game-bots` later (see Coordinator to do).
- **No worker, no stall:** where `Worker` is missing or the worker fails to load or throws, the
  move is computed in-thread (logged as `client.error kind=bot.worker`). Tests run this path.
- **Hint** ("Vihje") uses the greedy `chooseMove` on the UI thread with a 100 ms budget, seeded by
  the turn (stable within a turn); only computed after a tap. Moving it to the worker is `basic-ui`
  or `mobile-ui` work (the three-best-moves hint).
- **Runner's view of a turn is frozen** when the turn starts (key = turn counter + seat), so later
  state updates in the same turn (a connection, a spectator) neither restart the pause nor recompute.
- **A runner change during a bot's turn restarts the server's timer** from zero (full pause +
  grace for the new runner).
- **Room tests default the runner grace to 0** (`support/game.ts`): the test clients never compute
  bots, so the fallback plays bot turns right after the pause, like the old server bots did.
- **Turn counter:** the room increments `turn` on every turn change; `LocalRoom` reports
  `moveNumber + 1`. At the end the room keeps the last `turnSeat`, `LocalRoom` reports 0; the view
  handles both (`finished` wins).
- **Scores shown are the rules' points** (−89 at the start); a colour that cannot move gets its
  score struck through (plus "ei enää siirtoja" for screen readers). `game.finished` logs
  `scores` as `colour:score/squares`; `turn.changed` logs `out`.
- **Undo** is also allowed while a bot's answer is pending (it is dropped); with autoplay on, the
  bot replays the turn after an undo (accepted, a corner case).
- **`RULES_VERSION` 1.0.0** (was 0.2.0): the real rules are what server and client now play.
- The old `palikka.dailyGame` / `palikka.daily` localStorage entries are left alone (harmless;
  `daily-puzzle` decides).
- **Bundle:** main 171.6 kB gzip (limit 200 kB); the worker 4.4 kB gzip with its own 30 kB budget
  (`client/package.json` size-limit, main entry excludes `bot.worker-*.js`).
- The production smoke now also taps the start corner in the device game and waits for the bot's
  piece in its corner, so a broken worker in production fails the smoke.

## Coordinator to do

- **Run the E2E smoke locally** (`npm run e2e`, dev servers on 2577/5183) before pushing: this job
  had no dev servers; `e2e/tests/smoke.spec.ts` and `prod.spec.ts` were updated to the corner tap
  but not run.
- **UI check** (Playwright MCP, portrait, light and dark) of the game screen: the dots on tappable
  corner squares (`--target` token), the struck-through score of a colour that is out, the shared
  win line, "Peru" in device games. Nothing new covers or hides a control ("Peru" sits in the
  existing controls row), so no placement decision is open.
- **`openspec/context/roadmap.md`:** mark `game-room` done at archive.
- **`packages/bots` (later, `bot-search` scope):** move the generic worker harness
  (`client/src/bots/bot.worker.ts` message protocol with ids + `botWorkerClient.ts` in-thread
  fallback) into `game-bots` as the "worker harness" product.md names, leaving only the Palikka
  `answer()` in the client; then the tournament driver can reuse it.
- **Optional:** `tools/axiom/dashboard.py` "Botin varasiirtoja" now counts server fallbacks (with
  `reason`); consider splitting `runnerSilent` (worth a look) from `noRunner` (normal for watched
  bot games) when the dashboard is next rebuilt.
