# Tasks

## 1. Rules helpers (additive)

- [ ] 1.1 Export `freeCorners(position, colour)` and `forbiddenSquares(position, colour)` from `movegen.ts` (reusing the private helpers, no behaviour change) and the bitboard neighbour helpers from `index.ts` (one block at the end); verify with a rules unit test that the opening position's free corner of colour 1 is its start square and that after a first piece the corners are its diagonal free squares

## 2. Game-independent library (`packages/bots`, npm `game-bots`)

- [ ] 2.1 Create the workspace (package.json, tsconfigs, vitest), add it to the root workspaces list after `packages/protocol`, run `npm install` to update the lock file
- [ ] 2.2 Add `Game`, `Evaluate`, `Budget`, `Rng`, `Bot` types, `greedyBot` (seeded shuffle, strict best, time cut-off with injectable clock, depth ≥ 1) and `randomBot`; verify with toy-game unit tests: best-rated move chosen, seeded ties (same seed same move, different seeds reach several best moves, never a worse one), time runs out → best so far and at least one rated, no move when over or no moves, invalid budget refused, random bot legal and deterministic

## 3. Palikka adapter and greedy evaluation (`packages/palikka-bots`, npm `@palikka/bots`)

- [ ] 3.1 Create the workspace (package.json with `@palikka/rules` and `game-bots`, tsconfigs with the `source` condition, vitest config), add it after `packages/bots`, update the lock file
- [ ] 3.2 Add the adapter (`palikkaGame`), `evaluate` (size, free corners, area control, end result), `greedyPlayer`, `randomPlayer` and `chooseMove(position, colour, budget, rng | seed)`; verify with tests named after the `bot-play` scenarios: first move covers the start corner, legal moves through a whole game, no move available, repeated question, seed breaks ties, time runs out, bigger piece preferred, blocking an opponent's corner counts
- [ ] 3.3 Strength check: one greedy bot vs three random players over a fixed seeded set, seat rotating; assert ≥ 90 % wins; keep the run to a few seconds; record the measured rate in design.md
- [ ] 3.4 Add `scripts/bench.ts` (`npm run bench -w @palikka/bots`): average time per greedy move on the classic board; record it in design.md and docs

## 4. Docs

- [ ] 4.1 Update `docs/architecture.md` (workspaces table, a short Bots section: library, adapter, entry point, measured strength and speed) and `docs/template.md` (the library as a reusable building block)
