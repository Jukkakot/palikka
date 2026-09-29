# Design

## Context

- `game-bots` (`packages/bots`) is the game-independent library: `Game`, `Bot`, `Budget`
  (`timeMs`/`depth`), `Rng`, `greedyBot`, `randomBot`. No I/O, no Node or DOM APIs; the client's
  bot worker bundles it.
- `@palikka/bots` (`packages/palikka-bots`) holds the adapter, `evaluate`, `greedyPlayer`,
  `randomPlayer`, `playGame(start, botsByColour, seed, budget)` and a `bench` script (tsx, run from
  source with `--conditions=source`; greedy ≈ 8 ms per move, ≈ 0.4–0.7 s per 4-colour game).
  Its `src/` is imported by the client worker, so it must stay browser-safe.
- 2-colour games in the room use colours 1 and 2 (the lowest seats); 4-colour games use 1–4.
- GitHub-hosted runners have 4 vCPUs; the CI workflow `ci.yml` already runs lint, typecheck, unit
  tests, build and E2E on every push and PR.

## Goals / Non-Goals

**Goals:** reproducible, fair matches; ratings that do not depend on game order; strength
requirements as data with a pass/fail check; heavy runs in Actions on all cores; a generic core
that `bot-search` and later games reuse.

**Non-Goals:** new bots or evaluation tuning (`bot-search`), rating history across runs, variant
formats (`variants` adds them to the format list), SPRT or other sequential testing, any UI.

## Decisions

### Split: generic core in `game-bots`, Palikka glue in `@palikka/bots`, Node-only CLI apart

- **`game-bots` `src/tournament/`** (pure, browser-safe, no game names):
  - `schedule(bots, gamesPerPairing, firstSeed)` → the list of games. Pairings in round-robin
    order `(i, j), i < j` by the order the bots were named; game `k` of a pairing uses seed
    `firstSeed + ⌊k / 2⌋` and is "swapped" when `k` is odd. Every pairing uses the same seed
    sequence, so all pairings see the same boards. Odd `gamesPerPairing` throws.
  - `pairwise(seatBots, scores)` → the comparisons of one game: every two seats with different bot
    names, 1 / ½ / 0 by score.
  - `rate(games, anchor)` → Elo per bot (below).
  - `summarize(games)` → per pairing: points, comparisons, share and the 95 % interval; per bot:
    total share against all others.
  - `markdownReport(result)` → the report text (setup, standings, pairing matrix).
  - `checkRequirement(requirement, summary)` → pass/fail with measured share.
  The game supplies only `playGame(seatBots, seed) → final score per seat`. The core never knows
  seats beyond "a list of bot names per seat".
- **`@palikka/bots` `src/tournament.ts`** (browser-safe, testable):
  - the bot registry: `random`, `greedy` (defaults `{ depth: 1 }`, deterministic); `bot-search`
    adds its bots here.
  - `parseBot("greedy@200ms")` → `{ name, bot, budget }`; `@<n>ms` = `timeMs`, `@d<n>` = `depth`;
    anything else is refused with the known names listed.
  - formats: `4` (classic board, colours 1–4; bot A on 1 and 3, B on 2 and 4; swapped = the
    opposite) and `2` (classic board, colours 1 and 2; swapped = B on 1). Colour 1 always moves
    first, as in the room.
  - `playTournamentGame(format, botA, botB, seed, swapped)` → seats and final scores (using the
    existing `playGame` with each bot's own budget, timing each move).
- **`packages/palikka-bots/cli/`** (Node-only: args, worker pool, files, exit codes): `tournament.ts`,
  `strength.ts`, `worker.ts`, `pool.ts`. Own `tsconfig.cli.json` with Node types, run by the
  package's `typecheck` script next to `src/`, so the client worker never sees Node imports.
  Scripts: `npm run tournament -w @palikka/bots -- <bots…> [--games N] [--colours 4|2]
  [--seed S] [--jobs J] [--out file]` and `npm run strength -w @palikka/bots [-- --jobs J]`.
- Alternative rejected: everything in `@palikka/bots`. The schedule, pairwise scoring, Elo and the
  report know nothing about Palikka, and `docs/template.md` wants the bot library reusable.

### Pairwise results, per-pair-of-seeds intervals

- A game's comparisons are between colours of different bots only (4 per 4-colour game, 1 per
  2-colour game). Share = points / comparisons. This works for both formats and rewards beating
  each opposing colour, which is what the game rewards; a "whole-game win" share is reported per
  bot as extra information (winner or shared winner among all colours).
- The 95 % interval uses the **seed pair** (the two games that share a seed) as the independent
  unit: the bot's share in each seed pair, mean ± 1.96 · sd / √pairs, clamped to [0, 1]. The
  comparisons inside a game or a seed pair are correlated, so counting them as independent would
  overstate confidence. With one seed pair the interval is [0, 1].

### Elo: Bradley–Terry maximum likelihood with a virtual draw

- Each bot has strength γ; P(A beats B) = γA / (γA + γB); draws count as half a win each. Fit by
  the minorization–maximization iteration (Hunter 2004): γi ← Wi / Σj nij / (γi + γj), until the
  largest relative change is below 1e-9 or 10 000 iterations. Elo = 1000 + 400 · log10(γ / γanchor).
  Deterministic and order-independent (it uses only totals per pairing).
- Each pairing that played gets one virtual draw (½ point each, one comparison) so a clean sweep
  stays finite (the BayesElo idea). With many comparisons its effect is small; the spec's 75 %
  scenario allows for it.
- Anchor: `random` when present (a stable zero point across runs), else the first bot named.
- Alternatives rejected: incremental Elo updates (depend on game order, need a K factor); a
  library (none small and maintained for multi-way BT; the iteration is ~30 lines).

### Reproducibility and parallelism

- Each game is independent and fully defined by (pairing, seed, swapped, budgets), so a worker pool
  can play them in any order; results are sorted by game index before summarising. With depth
  budgets the run is identical on any machine and worker count (tested by running the same games
  in two different orders in-process). Time budgets are allowed; the report then says "time-limited:
  results depend on the machine".
- Pool: `node:worker_threads`, `--jobs` default `os.availableParallelism()`; each worker gets a
  batch message `{ format, bots, games[] }` and answers per game. The runner is started through
  `tsx` (as `bench` already is); workers inherit `process.execArgv`, so they load the TypeScript
  source the same way. `--jobs 1` plays in the main thread (no worker), used by the tests.
  If `tsx` cannot start workers, the implementation may instead run the CLI from the built `dist/`
  output; record the choice in this file.
- Limits: `--games` 2–10 000 and even, at most 8 bots, `--jobs` 1–64; refused with a message
  otherwise.

### Strength requirements as data

- `packages/palikka-bots/strength.json`: a list of
  `{ "name", "candidate", "baseline", "colours", "games", "seed", "minShare" }` (bots with optional
  budget suffix). First entry: `"greedy beats random"`, 4 colours, 40 games, seed 1, minShare 0.9
  (greedy measured ≈ 99 % game wins against three random players, so the bar is safe yet
  meaningful). `bot-search` appends "… beats greedy", minShare 0.6, 200 games.
- `strength` plays each requirement as a two-bot tournament, prints one line per requirement
  (`PASS greedy beats random: 97.5 % ≥ 90 %`) plus the full report per requirement, writes the
  JSON results, and exits 1 when any fails.

### Report and results file

- Markdown (renders on the Actions summary page and reads fine in a terminal): setup line
  (bots with budgets, format, games per pairing, first seed, jobs, version, time-limited or not),
  standings table (rank, bot, Elo, games, share, game wins, ms per move avg/max), pairing matrix
  (row bot's share against column bot, with interval).
- Version: `GITHUB_SHA` short, else `git rev-parse --short HEAD`, else `unknown`.
- JSON: `{ setup, ratings, pairings, games: [{ index, pairing, seed, swapped, seats, scores }] }`
  to `--out` (default `tournament-results/<bots>-<timestamp>.json` in the package; the folder is
  git-ignored).

### GitHub Actions: `.github/workflows/tournament.yml`

- `strength` job: on `push` to `main` and `pull_request`, filtered by paths `packages/bots/**`,
  `packages/palikka-bots/**`, `packages/rules/**`, `package-lock.json`, the workflow file. Steps:
  checkout, setup-node (`.nvmrc`, npm cache), `npm ci`, `npm run strength -w @palikka/bots`, append
  the report to `$GITHUB_STEP_SUMMARY`, upload the JSON (retention 30 days). Timeout 60 min.
- `tournament` job: `workflow_dispatch` with inputs `bots` (default `random greedy`), `games`
  (default 100), `colours` (4), `seed` (1); same steps with `npm run tournament`.
- Separate from `ci.yml`, so a failing strength check never blocks `deploy-server` (bots run in
  the client; a weaker bot is not a broken build). The job still shows red on the commit.

### Benchmark script

- `bench` keeps the per-move timing and drops its greedy-vs-random win rate (the strength check
  and the report's ms-per-move column cover it).

## How the NFRs are met

- **Tests:** every spec scenario maps to a unit test named after it (schedule, pairwise, rating,
  report, requirement check in `game-bots`; name parsing, formats, reproducibility and a small
  greedy-vs-random tournament in `@palikka/bots`). The fast `bot-play` unit test stays; heavy runs
  live only in the workflow (nfr → Testing).
- **Logging:** a developer/CI tool, not the game: plain stdout/stderr and a JSON results file; no
  pino or Axiom lines (nothing reaches production).
- **Limits:** input limits above; `timeout-minutes` on the jobs. Budget 0 €: GitHub-hosted runners
  within the free minutes.
- **Performance:** no effect on the client bundle: the tournament core is tree-shaken out of the
  client worker (not imported by `chooseMove`); the size check confirms it.

## Risks / Trade-offs

- Pairwise share ≠ "wins the game". Accepted: it is fairer and less noisy in 4-colour games; game
  wins are shown next to it.
- Time-limited bots on shared CI runners are noisy. Requirements should use depth budgets or
  generous margins; the report flags time-limited runs.
- tsx in worker threads is a moving part; fallback to the built output is noted above.
