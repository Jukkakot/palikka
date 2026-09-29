# Design

## Context

The rules engine (`packages/rules`) gives plain-JSON `Position`s, fast `legalMoves` (integer move
codes), `applyMove`, `scores`/`winners` and bitboards. Product decisions: bot brains are a
game-independent library (own workspace, no Palikka names) that Palikka uses through an adapter;
bots run in the host's browser (Web Worker, wired by `game-room`); every bot takes a budget (time
or depth) so levels can come later. This change delivers the first bot (greedy, one ply) and the
library's shape; search, MCTS and the worker harness come in `bot-search`, tournaments and Elo in
`tournament-elo`.

## Goals / Non-Goals

**Goals:** a library API that search/MCTS can extend without rework; a greedy Palikka bot that
beats random play clearly; one worker-ready entry point; fast CI checks.

**Non-Goals:** worker wiring, search, MCTS, time-management tuning, difficulty levels, tournament
driver, tuned weights (the weights are hand-set; `tournament-elo` tunes them).

## Decisions

### Two packages: `packages/bots` (library) and `packages/palikka-bots` (adapter)

- `packages/bots`, npm name **`game-bots`** (no `@palikka` scope, so the library carries no
  Palikka name and can move to a shared repo as is; see `docs/template.md`). Depends on nothing.
- `packages/palikka-bots`, npm name **`@palikka/bots`**: the adapter over `@palikka/rules` and
  the greedy evaluation. The client worker imports only this package.
- Alternative rejected: a `palikka/` subfolder inside `packages/bots`. It would make the library
  depend on `@palikka/rules`, so it could not be extracted without surgery, and a sub-path export
  would still ship Palikka names in the library's package.
- Both export `source` → `src/index.ts` like `rules`/`protocol` (no build between packages); both
  have `build` (tsc to `dist/`) for symmetry and a future Node tournament runner. Workspace order:
  `rules`, `protocol`, `bots`, `palikka-bots`, then apps (builds run in list order).

### Library API (`game-bots`)

- `Game<S, M, P>`: `toMove(s)`, `isOver(s)`, `moves(s)` (legal moves of the player to move),
  `play(s, m)` (returns a new state). Immutable states, so search can keep them.
- `Evaluate<S, P> = (state, player) => number`, higher = better for `player`. Pluggable.
- `Budget = { timeMs?: number; depth?: number }` (plain JSON for worker messages). At least one
  field; with both, whichever runs out first. Greedy: depth ≥ 1 is its whole search.
- `Rng = { int(min, max) }`, structurally the same as `@palikka/rules`' `Rng`, so the rules'
  seeded xoroshiro generator plugs in; the library has no randomness of its own.
- `Bot<S, M> = { choose(state, budget, rng): M | undefined }`; `greedyBot(game, evaluate, { now })`
  and `randomBot(game)`. `now` defaults to `performance.now` and is injectable for tests.
- Greedy order: shuffle the move list with the rng (Fisher–Yates), rate each, keep the first of
  the best (strict `>`). The shuffle makes tie-breaking seeded and uniform, and makes a time
  cut-off rate a random subset rather than a board-region-biased one. The clock is read before
  each rating after the first, so at least one move is always rated.

### Palikka adapter (`@palikka/bots`)

- State = `Position`, move = integer `Move` code, player = colour. `play` = `applyMove` (throws
  on refusal: a bug). `moves` = `legalMoves(position, position.turn)`.
- `chooseMove(position, colour, budget, rng: Rng | number): Placement | undefined`: a number is a
  seed for the rules' `createRng`. Returns the readable `Placement` (what the protocol sends).
  Returns `undefined` when the game ended or the colour is out. If `colour` is not on turn, the
  bot plays as if it were (the position is copied with `turn: colour`); the worker normally asks
  only on the bot's turn.
- `greedyPlayer` / `randomPlayer`: ready `Bot`s for tests, tools and tournaments.

### Greedy evaluation (`evaluate(position, colour)`, after the move)

Weights are named constants in `evaluation.ts` (hand-set now, tuned by `tournament-elo`):

- **Size:** squares the colour has placed (its score up to a constant) × 1.0 — bigger pieces
  first. When the game has ended, a large bonus/penalty for winning/losing replaces the heuristic
  terms' role (a won end is best).
- **Free corners:** the colour's free corner squares (diagonal to its own, not forbidden to it)
  minus the average of the opponents still in, × `CORNER_WEIGHT`. Opponents that are out count 0.
- **Area control:** squares the colour reaches within two king steps from its free corners
  through squares it may still cover, minus the opponents' average, × `AREA_WEIGHT`. Cheap
  bitboard dilation (row words), so a rating costs a few microseconds.
- Needed from `rules` (additive exports): `freeCorners(position, colour)` and
  `forbiddenSquares(position, colour)` (the existing private `cornersFor`/`forbiddenFor` in
  `movegen.ts`, exposed), and `edgeNeighbours`/`diagonalNeighbours`/`rowMask` from `bitboard.ts`.
  No existing behaviour changes. `index.ts` gets one added export block at its end (the
  `game-room` job edits the placeholder exports at the top; the merge stays trivial).

### Strength check and speed

- Test: one greedy bot vs three random players on the classic board, seeded games, greedy seat
  rotating 1–4; the greedy bot must win (alone or shared) ≥ 90 %. A 2-player case is not needed:
  the 4-player case is the harder, product-relevant one. The run is kept to a few seconds.
- A bench script (`npm run bench -w @palikka/bots`) reports the average time per greedy move on
  the classic board (not in CI; timing is flaky there).

Measured (developer desktop, 2026-09-29): see **Measurements** below.

## How NFRs are met

- **Tests:** library unit tests with a toy game (legal choice, best-rated choice, seeded ties,
  time cut-off with a fake clock, no move, random bot); adapter tests per spec scenario (named
  after them), including a full game of legal bot moves and the strength check. Fast (seconds).
- **Performance:** bots never run on the UI thread (the worker wiring is `game-room`'s); a greedy
  move costs milliseconds (measured below); the time budget caps it anyway.
- **Logging:** none; the library is pure. The room/worker logs bot moves as today.
- **Limits / abuse:** not applicable (pure functions, no I/O).
- **Determinism:** randomness only from the injected rng.

## Risks / Trade-offs

- Greedy evaluation weights are guesses → measured against random here, tuned by `tournament-elo`.
- A time budget makes the choice depend on machine speed → documented; tests use depth budgets or
  a fake clock.
- Bundle: the adapter pulls in `@palikka/rules` (already in the client bundle); the worker bundle
  gets its own budget when the coordinator wires it (nfr.md).

## Measurements

(filled in during implementation)
