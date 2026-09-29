# Proposal

## Why

Strong bots are the project's main focus, and the only bot today looks one ply ahead: greedy on an
evaluation. It cannot see what an opponent does next. That is the classic way to lose a corner, get
blocked, or walk into a dead end. Roadmap item 6 adds search bots that look further ahead under a
time budget. The tournament driver from `tournament-elo` measures them, and the strongest one
becomes the bot people play against.

## What Changes

- `packages/bots` (`game-bots`, game-independent):
  - **Best-reply search** (`brs`): iterative deepening under the budget. The bot's own layers
    alternate with one layer in which the single strongest reply of any opponent is searched. It
    uses alpha-beta, keeps only the most promising moves at each layer (beam widths) and orders
    them by a cheap per-move key the game supplies. It always finishes the one-ply search first,
    so under any time limit it is never worse than greedy.
  - **MCTS** (`mcts`): multi-player UCT (every node keeps a value per player). Children are
    widened progressively in cheap-key order. Playouts are short and guided by the cheap key, and
    their end position is rated by the evaluation.
  - The game interface gets an optional multi-player part (the players still in, a player's moves
    when it is not on turn, and playing a move for it). Search that needs it refuses a game without
    it.
  - The budget gets a third limit, **iterations** (MCTS playouts; other bots ignore it), so MCTS
    has a machine-independent budget for tests and strength checks.
  - The **worker harness** moves here from the client: the message protocol with ids, answering in
    a Web Worker, and falling back to answering in the page when no worker can run. The client
    keeps only Palikka's answer function.
- `packages/rules`: the few helpers search needs: asking for a colour's moves or playing one when
  it is not on turn, without rebuilding the cached board view.
- `packages/palikka-bots` (`@palikka/bots`): the adapter's multi-player part and the cheap move key
  (piece size, opponents' corners covered), the registry entries `brs` and `mcts` with default
  budgets, and a new strength requirement: "search beats greedy ≥ 60 % over 200 games" for the
  chosen bot at a machine-independent budget. The **device bot** (what `chooseMove` plays by
  default) becomes whichever search bot wins a head-to-head at the real time budget, measured and
  written down in the design.
- `client`: the bot's move is computed during the pause people already see before a bot moves, in
  device games as well as online. The pause is not added on top. The bot budget rises from 500 ms
  to 800 ms (still inside the 1 s pause). The hint stays greedy (fast). The server's fallback bot
  is unchanged.
- Not in scope: difficulty levels, tuning evaluation weights, opening books, teams (two colours per
  player comes with `variants`), the "Vihje" top-3 (`mobile-ui`).

Workspaces touched: `packages/bots`, `packages/palikka-bots`, `packages/rules` (small additions),
`client` (worker harness, budget, timing). Not server or protocol.

## Capabilities

### New Capabilities

- `bot-search`: how the search bots choose a move: looking ahead at the opponents' replies, the
  anytime guarantee under a time limit, the machine-independent budgets, and that search is
  measurably stronger than greedy.

### Modified Capabilities

- `bot-play`: a budget may also be an iteration count. The bot people play against is the
  strongest bot, not the greedy one. Its move is computed during the pause before it moves.
- `bot-tournament`: bot names take an iteration budget (`mcts@i400`). The known bots include the
  search bots. The strength requirements include "search beats greedy".

## Impact

- New source and tests in `packages/bots` (`search/brs.ts`, `search/mcts.ts`, `worker/`) and
  `packages/palikka-bots` (adapter, move key, registry, `strength.json`).
- `packages/rules`: `withTurn` (or equivalent) that keeps the cached board view.
- Client: `client/src/bots/*` uses the library harness; `botMoves.ts` budget;
  `session/localRoom.ts` computes during the pause. The bot worker bundle budget in size-limit may
  grow (search code is small).
- CI: the strength job gets a second, heavier requirement. Its expected run time is written in the
  design.
- Docs: `docs/architecture.md` (Bots: search, MCTS, harness, the device bot and its measured
  strength), `docs/development.md` (bot names and budgets), `docs/template.md` (harness is
  generic), roadmap item 6 done.
