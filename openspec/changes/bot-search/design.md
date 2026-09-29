# Design

## Context

- `game-bots` (`packages/bots`) has `Game` (`toMove`, `isOver`, `moves`, `play`, immutable
  states), `Bot.choose(state, budget, rng)`, `Budget` (`timeMs`/`depth`), `checkBudget`,
  `deadline`, `greedyBot`, `randomBot`, and the tournament core. It is browser-safe (the client
  worker bundles it).
- `@palikka/bots`: `palikkaGame`, `evaluate` (own score, free corners, exclusive reach within 2
  king steps, ±1000 at the end), `greedyPlayer`, `chooseMove`, the registry `BOTS` with
  `parseBot` (`@<n>ms`, `@d<n>`), `strength.json` (greedy beats random, 40 games, 0.9).
- Measured cost per position (developer container, one greedy 4-colour game, 2026-09-29):
  **218 legal moves on average** (≈ 400 in the first quarter of the game, max 869, ≈ 24 in the
  last). **0.31 ms** to generate a colour's moves, **10 µs** to play one, **48 µs** to evaluate
  one. A full one-ply pass therefore costs ≈ 13 ms. Rating every move this way at every inner
  node is far too slow, so inner layers must be ordered by something much cheaper than
  `evaluate`.
- `applyMove` refuses a colour that is not on turn. `bitView` is cached per position object in a
  `WeakMap`. `chooseMove` spreads `{ ...position, turn }`, which loses the cache, so the view is
  rebuilt.
- Client: `BOT_BUDGET = { timeMs: 500 }`, `BOT_DELAY_MS = 1000`. Online (`useBotRunner`) the
  worker computes during the delay. In device games (`LocalRoom.playBot`) the delay runs first
  and the worker is asked after it, so a person waits delay + compute. The hint uses
  `chooseMove(…, { timeMs: 100 })` with greedy. The worker harness lives in
  `client/src/bots/bot.worker.ts` + `botWorkerClient.ts` (ids, in-page fallback, logs); the
  game-room design already earmarked it for `game-bots` in this change.
- A mid-range phone is roughly 3–5× slower than the developer container. At 800 ms on a phone,
  a search gets about the work of 160–270 ms on the container.

## Goals / Non-Goals

**Goals:** two search bots in the generic library, each tested on a toy game and on Palikka. An
anytime guarantee: never weaker than greedy under a short time limit. Machine-independent
budgets for tests and strength checks. The strongest one plays people. The worker harness
becomes reusable.

**Non-Goals:** difficulty levels (the budget stays the only knob), evaluation weight tuning,
opening books, transposition tables, teams (`variants` brings two colours per player; the
search then needs a player → side mapping, noted as a risk), multi-threaded search, the "Vihje"
top 3 (`mobile-ui`), server-side bots.

## Decisions

### Library interface additions (`game-bots`)

- `Budget` gains `iterations?: number` (positive integer). `checkBudget` accepts any non-empty
  combination and refuses a non-positive or non-integer value. Greedy and random ignore
  `iterations`, and MCTS ignores `depth`.
- `MultiplayerGame<S, M, P> extends Game<S, M, P>` adds:
  - `players(state): readonly P[]`: the players still able to move, in turn order starting after
    the player to move.
  - `movesOf(state, player): readonly M[]`: a player's legal moves even when it is not on turn.
  - `playAs(state, player, move): S`: the state after `player` plays `move`.
  - `moveKey(state, player, move): number`: a cheap "how promising" key, higher first. It is
    meant to cost about a microsecond, never a full evaluation.
- `bestReplyBot(game, evaluate, options)` and `mctsBot(game, evaluate, options)` take the
  multi-player game. Options: `now` (clock) and the tuning constants below, with defaults, so
  tournaments can compare settings without code changes. Registry names carry these presets.

### Best-reply search (`brs`)

- Schadd & Winands' Best-Reply Search. The root player (MAX) moves at even plies. At odd plies,
  one MIN layer merges the moves of **all** opponents still in; the one reply that hurts MAX most
  is taken and the other opponents skip. The leaf value is `evaluate(state, root)`. Alpha-beta
  runs over this two-player tree.
- **Iterative deepening:** depth 1 is the full greedy pass. Every legal move is rated with
  `evaluate` in a seeded random order, the first best wins ties, and it stops at the deadline.
  This is exactly `greedyBot`'s loop, so depth 1 equals greedy, including tie-breaking by the
  seed. Then depth 2, 3, … up to `budget.depth` (default: unlimited while time remains).
- **Beam widths:** at the root after the depth-1 pass, only the best `rootWidth` moves (default
  10) by their depth-1 value go deeper, best first. At inner MAX layers, the best `width`
  (default 6) moves by `moveKey` go deeper. At a MIN layer, each opponent's moves are ranked by
  `moveKey` and the best `replyWidth` (default 3) per opponent are merged. That makes 9 replies
  with three opponents. A MIN layer with no moves at all (every opponent out or stuck) passes
  straight to MAX.
- **Deadline:** checked before each leaf evaluation and each child. When it fires inside depth
  *d*, depth *d* is abandoned and the depth *d − 1* answer is returned. One exception: if a root
  move searched completely at depth *d* already beats the *d − 1* best, that move is returned.
  The work after the deadline is at most one node's move generation plus one evaluation (well
  under a millisecond), which meets the spec's "one position's rating work".
- **Why BRS over paranoid:** paranoid needs 4 plies for one round with four colours, and its
  opponents play against the root in turn order, so depth 2 only sees the next colour. BRS sees
  the most dangerous reply from any colour at depth 2 and reaches MAX's own follow-up at depth
  3. In the literature it beats paranoid and max^n in several multi-player games at equal time.
  Rejected: max^n, whose shallow pruning is weak with 4 players.
- **Cost estimate:** depth 2 ≈ 13 ms (the pass) + 10 × (3 × 0.31 ms generation + 9 × ~60 µs) ≈
  28 ms. Depth 3 ≈ 10 × 9 × (0.31 ms + 6 × 60 µs) ≈ 60 ms more. So the container reaches depth
  3–4 in 800 ms and a phone depth 2–3. The numbers are to be confirmed by the benchmark and
  recorded below.

### MCTS (`mcts`)

- Max^n UCT: every node keeps visit counts and a value sum per player. Selection maximises the
  mover's mean + `c·√(ln N / n)` with `c = 0.5` (default). The rewards are in [0, 1], so a
  smaller c than √2 suits them.
- **Progressive widening:** a node's moves are sorted once by `moveKey` when it is created (ties
  by seeded shuffle). A node may have `⌈k · visits^α⌉` children (`k = 2`, `α = 0.5`), taken in
  key order. The root is the exception: its move order comes from the depth-1 greedy pass (as in
  BRS), so MCTS starts from greedy's ranking.
- **Playouts:** from the new node, `playoutPlies` (default 4, one round) moves. Each is chosen
  among the top 3 by `moveKey` with seeded randomness (weights 3 : 2 : 1). The playout then
  stops and every player still in is rated with `evaluate(state, p)`. The ratings go into [0, 1]
  through a logistic function on each player's value minus the mean over the players:
  `1 / (1 + e^(−x / scale))`, `scale = 10` (default, ≈ 10 squares). A player that is out gets its
  final-score comparison. An ended game gives 1 to the winners (shared) and 0 to the others.
- **Budget:** `iterations` (default 400 in the registry for tests) and/or the deadline. The
  answer is the root child with the most visits; ties go to the higher mean, then to key order.
  It always runs the depth-1 pass first, so under a tiny time limit it returns greedy's move.
- **Determinism:** one rng from the request seeds the shuffle and the playouts. With iterations
  and no time limit the answer is machine-independent.

### Palikka adapter (`@palikka/bots`)

- `packages/rules` gains `withTurn(position, colour)`: the same position with `turn` set,
  carrying the cached bit view. `chooseMove` and `playAs` use it. `movesOf` returns
  `legalMoves(withTurn(p, c), c)`. It is empty for a colour that is out or when the game has
  ended.
- `playAs(p, c, m)` = `applyMove(withTurn(p, c), c, m)`. The rules' own turn advance and
  automatic passing still happen, so `players()` is read from the result each time, not
  assumed.
- `moveKey(p, c, m)` = piece squares + 1.5 × opponent free corner squares the piece covers + 0.5
  × new own corner squares the piece creates (approximated from the orientation's own corner
  mask: diagonal neighbours of the piece that are empty and on the board, without the forbidden
  check). It is computed from the decoded placement with bit operations, with no position copy.
  The weights are hand-set, and the design records any change a tournament shows is better.
- Registry: `brs` (default budget `{ depth: 2 }`) and `mcts` (default `{ iterations: 400 }`);
  `parseBot` learns `@i<n>`. Preset variants may be added under their own names (e.g.
  `brs-wide`) when tuning. Only the ones worth keeping stay.
- `chooseMove`'s default bot becomes `devicePlayer`, a named export that points at the winner of
  the head-to-head below. `greedyPlayer` stays exported for the hint.

### Choosing the device bot

- Run by hand during apply: `npm run tournament -w @palikka/bots -- greedy@800ms brs@800ms
  mcts@800ms --games 100 --jobs 4`. Also run `@200ms` versions (roughly a phone's work at
  800 ms). The bot with the higher rating at **200 ms** becomes the device bot, because a phone
  is the target device. The container's 800 ms result is recorded as well.
- The strength requirement then uses the winner at a machine-independent budget that takes
  about the same work as 200 ms on the container. For BRS that is depth 2. For MCTS it is the
  iteration count that the benchmark shows averages ≈ 200 ms. Requirement: "search beats greedy",
  4 colours, 200 games, seed 1, minShare 0.6.
- If neither search bot reaches 60 % against greedy, tune the widths, `moveKey` weights and
  `c`/`scale` with tournaments until one does. Record the settings here. If that fails after
  honest tuning, stop and report it (a failing check that cannot be fixed).

### Worker harness (`game-bots/worker`)

- `serveBotWorker(answer)` (inside a worker) installs `onmessage` and replies
  `{ id, result } | { id, error }`. `botWorkerClient({ create, answer, onError })` (in the page)
  lazily creates the worker, matches replies by id, answers in the page when no worker can be
  made, when the worker reports an error for a request, or when the worker crashes (for everything
  pending and afterwards). It reports through the `onError(kind, message)` callback, and the
  client passes its logger. It is generic in request/response types. The worker `URL` stays in
  the client, because Vite needs `new URL("./bot.worker.ts", import.meta.url)` literally at the
  call site.
- Exported from a separate entry `game-bots/worker` (package `exports`), so the tournament CLI and
  the rules never pull DOM worker types into their typecheck. The library has no DOM lib: the
  worker types are declared minimally (`postMessage`, `onmessage`, `terminate`) in the module.
- The client keeps `botMoves.ts` (`answer`, `MoveRequest`, budget and delay) and thin
  `bot.worker.ts`/`botWorkerClient.ts` wrappers. Behaviour and log events stay the same as now.

### Client timing and budget

- `BOT_BUDGET = { timeMs: 800 }`. The delay stays at 1000 ms, so computing hides inside the pause
  with a margin for posting the message.
- `LocalRoom.playBot`: ask the worker when the bot's turn begins and play the move when both the
  answer is there and the delay has passed (`max(delay, compute)`). Online already works this way.
  A stale answer (undo, new game, generation changed) is dropped as today.
- The hint stays greedy at 100 ms, which is fast enough for the UI thread fallback.

### Decided during apply

- **MCTS rewards:** every player's reward uses the same logistic of its evaluation minus the mean,
  ended games included. `evaluate` already adds ±1000 for a won or lost end, which saturates the
  curve to 1 or 0, and it handles out colours itself, so the separate cases above were not needed.
- **Budget defaults:** a bot whose budget has no limit that applies to it (BRS with only
  iterations, MCTS with only a depth) uses its own default: depth 2 or 400 iterations.
- **Stopping early:** iterative deepening stops as soon as a depth finishes without reaching its
  depth limit anywhere (the whole tree fits). Depth is capped at 64.
- **Benchmarks:** both search bots take an optional `report` callback (depth finished or
  iterations run per answer). `scripts/bench.ts` takes a bot name with budget and plays it on
  colours 1 and 3 against greedy.
- **Watching speed:** the bot budget is divided by the watching speed (`botBudget(speed)`), just
  like the pause, so fast bot-only games stay fast.
- **Tests with fake timers** that use the real search bot fake only `setTimeout`/`clearTimeout`/
  `Date`. A faked `performance.now` never lets a time limit run out.
- **Hint:** `hintMove` passes `greedyPlayer` explicitly. `chooseMove`'s default is now the device
  bot.
- **Depth 2 is skipped under a time limit** (measured below).
- **`moveKey` corners** use the colour's forbidden squares (cached), not only the occupied ones. It
  costs nothing extra and is closer to the truth.

### Measured (developer container, 4 cores, 2026-09-29)

- Bench (2 games, bot on colours 1 and 3 against greedy): greedy 14 ms per move; `brs@d2` 20 ms,
  `brs@d3` 43 ms, `brs@d4` 148 ms (slowest 666 ms); `brs@200ms` reaches depth 4.1 on average
  (3–8); `brs@800ms` depth 5.3 (2–10), slowest 812 ms. `mcts@i400` 378 ms per move (slowest
  996 ms); `mcts@200ms` runs 39–74 569 iterations (many late in the game, where playouts are short).
- Fixed-work tournaments (20 games per pairing, 4 colours):
  - `greedy brs@d2 mcts@i100`: greedy 57.5 % against `brs@d2`. So depth 2 is *weaker* than
    greedy: one pessimistic reply layer judged by the one-ply evaluation is not enough.
    `mcts@i100` ≈ greedy (52.5 %).
  - `greedy brs@d3 brs@d4 mcts@i400`: `brs@d4` beats greedy **68.1 %** (52.8–80.3 %) and `mcts@i400`
    72.5 %. `brs@d3` ≈ greedy (52.5 %). `mcts@i400` ≈ greedy (46.9 % for greedy), and loses to
    both BRS depths.
- Head-to-head at the phone-like time budget, `greedy brs@200ms mcts@200ms`, 100 games per
  pairing (731 s): brs 1109, mcts 1027, greedy 1000. `brs@200ms` beats greedy **61.3 %**
  (54.1–67.9 %) and MCTS 65.6 %. `mcts@200ms` beats greedy 57.9 %. At that point the time-limited
  BRS still searched depth 2 before 3. See the next point.
- **Depth 2 skipped under a time limit** (`firstDeepDepth = 3`): since depth 2 is weaker than
  greedy, a time-limited search goes from the one-ply pass straight to depth 3, and depth 2 is
  searched only when a budget's depth is exactly 2. A slow device that cannot finish depth 3 then
  plays greedy's move, not a worse depth-2 one.
- **Device bot: `brs`** (`devicePlayer = brsPlayer`). The strength requirement uses `brs@d4`, the
  fixed-work budget closest to 200 ms on the container (148 ms per move, depth 4.1 reached at
  200 ms).
- `npm run strength` (4 jobs, about 10 minutes): greedy beats random 99.7 %; **search beats greedy
  61.0 %** (56.3–65.5 %, 200 games, `brs@d4`, game wins 67.5 %). The margin over the 60 % bar is
  thin. The result is reproducible (depth budget), so CI gives the same pass, but a future change
  to the evaluation or the move key must re-run it. If it drops below 60 %, the fix is to tune the
  evaluation, not to lower the bar.
- MCTS stays in the registry for comparison. Tuning it (wider playouts, better rewards) is left to a
  later change, together with evaluation tuning. Phones at 800 ms get about the container's
  200 ms of work, so they reach depth 3–4. That is roughly the depth where BRS starts to beat
  greedy, so a faster evaluation would pay off directly.

## How the NFRs are met

- **Tests (nfr → Testing):** `game-bots` tests the search bots on a small deterministic toy
  multi-player game. Its known tactics include a move that greedy takes and a best reply punishes,
  plus a stuck/out player. They cover: BRS avoiding the punished move at depth 2, the depth-1
  result equal to greedy for the same seed, determinism with depth or iterations, the deadline
  with an injected clock (tiny limit → a legal move, the depth *d − 1* answer when *d* is cut), and
  budget parsing. The `@palikka/bots` tests cover legal moves through whole games for both bots
  on small budgets, `withTurn`/`movesOf`/`playAs` agreeing with the rules, `moveKey` rewarding
  size and blocking, `parseBot("mcts@i400")`, and `chooseMove` using the device bot. The harness
  has fake-worker tests (id matching, error fallback, crash fallback). `LocalRoom` gets a test that
  the move lands at `max(delay, compute)`. Strength ≥ 60 % is checked only in the strength
  workflow, never in unit tests.
- **Logging:** unchanged events (`client.warn`/`client.error` with `kind: "bot.worker"` and
  friends) now come through the harness callback. The search itself does no logging (hot loop,
  worker).
- **Performance:** search runs only in the worker. The UI thread only falls back when workers are
  unavailable, which is already accepted. The bot worker bundle budget in size-limit is raised
  only if the search code needs it, and to the measured size + 5 kB.
- **Limits:** the depth is capped by the budget (registry defaults); the widths bound the tree.
  MCTS memory is bounded by iterations × one node (≈ tens of kB for 400).
- **CI time:** 200 games of `brs@d4` took about 10 minutes on the 4-core container (measured
  above). That is within the job's 60 min timeout.

## Risks / Trade-offs

- **Search may not beat greedy by 60 %** with a hand-set `moveKey` and evaluation: the
  evaluation's blind spots now matter more. Mitigation: the tuning step above. Evaluation weight
  tuning is deliberately a later change, but small weight fixes that tuning proves are allowed
  here and recorded.
- **Phones are slower:** the device bot is chosen at 200 ms for this reason. Iterative deepening
  keeps it at least greedy-strong on any device.
- **The 4-colour tournament format gives one bot two colours** that the search treats as rivals.
  This is the same for both sides, so it is fair, but it undersells coordinated play. Real teams
  come with `variants`, where the search needs a player → side mapping in `MultiplayerGame`, noted
  there.
- **Time-limited results are machine-dependent:** the device bot choice is a one-off measurement
  on the container, recorded here. It can be repeated with the manual tournament workflow.
