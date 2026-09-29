# Proposal

## Why

Strong bots are the project's main focus, and the real rules engine now exists. The first real bot
is a greedy one-ply player on a heuristic evaluation: cheap, clearly better than random, and the
baseline that later search bots (`bot-search`) must beat in tournaments (`tournament-elo`). Its
"brains" start the game-independent bot library the product asks for, so the library's shape
(game adapter, budget, pluggable evaluation) is settled before search and MCTS build on it.

## What Changes

- New workspace `packages/bots`: a game-independent bot library (no Palikka names). A game plugs in
  through a small game interface (player to move, legal moves, play a move, game over). It offers a
  greedy one-ply player with a pluggable evaluation, a uniformly random player (the baseline for
  tests and tournaments), a search budget type (time and/or depth) and seeded tie-breaking.
- New workspace `packages/palikka-bots`: the Palikka adapter over `packages/rules` and the greedy
  evaluation (piece size, free corners, area control). It exposes one entry point for the bot
  worker: position + colour + budget + seed in, a placement out (none when the colour cannot move).
- `packages/rules`: small additive exports the evaluation needs (a colour's free corner squares,
  the squares it may not cover, bitboard neighbour helpers). No behaviour changes.
- Root `package.json` workspaces list and `package-lock.json`.
- Not in scope: wiring the bot into the client worker or the room (`game-room` and the
  coordinator), search/MCTS/worker harness (`bot-search`), tournament driver and Elo
  (`tournament-elo`), difficulty levels.

Workspaces touched: `packages/bots` (new), `packages/palikka-bots` (new), `packages/rules`
(additive exports only). Not server, client or protocol.

## Capabilities

### New Capabilities

- `bot-play`: how a computer player chooses its move: always a legal move of its colour, the same
  move for the same position and seed, within its budget, preferring big pieces, own free corners
  and space while blocking opponents, and measurably stronger than random play.

### Modified Capabilities

(none)

## Impact

- New packages and their tests; CI runs them through `npm test --workspaces`.
- `packages/rules/src/movegen.ts` and `index.ts` get new exports only.
- The client bot worker (coordinator / `game-room`) will import `@palikka/bots`' `chooseMove`.
- Docs: `docs/architecture.md` (workspaces, Bots), `docs/template.md` (the library as a reusable
  building block).
