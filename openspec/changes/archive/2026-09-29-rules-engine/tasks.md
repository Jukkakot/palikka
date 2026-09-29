# Tasks

## 1. Pieces

- [x] 1.1 Add `pieces.ts`: the 21 base shapes with ids `I1 … Z5`, orientation generation (8 transforms, normalise, dedupe, stable sort); verify with tests for the `pieces` spec scenarios (21 pieces, sizes, 89 squares, no duplicate shapes, symmetric/asymmetric counts, 91 orientations, closure under rotate/mirror) and a golden snapshot of the orientations

## 2. Board, configuration and the legal placement

- [x] 2.1 Add `config.ts` (`BoardConfig`, `CLASSIC` 20×20 with the four start corners) and `bitboard.ts` (row-word masks, piece row masks, edge/diagonal neighbour masks); verify with unit tests on small hand-made boards (neighbour masks at edges and corners)
- [x] 2.2 Add `position.ts`: `Position` as plain JSON, `newPosition(config, colours, first)`, a cached bitboard view, and `checkPlacement` returning one refusal code in the spec's order; verify with tests for every `placement` scenario (first piece, corner contact, edge contact, no contact, other colours, overlap/outside, piece used once, several faults)
- [x] 2.3 Add `moves.ts` (encode/decode, readable form) and `reference.ts` (naive generator: every piece × orientation × position through `checkPlacement`), exported from `@palikka/rules/testing`; verify the round-trip scenario with a property test

## 3. Fast move generation

- [x] 3.1 Add `movegen.ts`: corner-based generation with the seen-table, and `hasLegalMove` (early exit); verify: 58 opening moves; property test over random legal games (fast-check) that the fast list equals the reference list as a set, with no duplicates and deterministic order
- [x] 3.2 Add `scripts/bench.ts` and `npm run bench -w @palikka/rules`; run it and record the measured time per position in `docs/architecture.md` (Rules package section)

## 4. Turns, passing, end and scoring

- [x] 4.1 `applyMove(position, colour, move)`: validates (turn, game over, placement), places, advances the turn, marks colours out (stuck or all pieces placed), ends the game; `pass` refused with `CANNOT_PASS` while a move exists; `abort(position)` ends with no winner; verify with tests for the `game-end-and-scoring` turn, passing and end scenarios
- [x] 4.2 `scoring.ts`: score per colour (−1 per unplaced square, +15, +5 monomino last), squares on board, winners with shared wins, none when aborted; verify the score and result scenarios, and a property test that random complete games end and their scores match a recount from `placed`

## 5. Package surface and docs

- [x] 5.1 Export the new API from `packages/rules/src/index.ts` without clashing with the placeholder; bump `RULES_VERSION` to 0.2.0; verify `npm run typecheck` and the full check chain pass with the placeholder game untouched
- [x] 5.2 Update `docs/architecture.md` (Rules package: the new engine as Implemented, placeholder still wired until `game-room`) and mark `rules-engine` done in `openspec/context/roadmap.md`
