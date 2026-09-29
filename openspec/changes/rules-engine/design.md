# Design

## Context

`packages/rules` holds the placeholder engine (`board.ts`, `game.ts`, `bot.ts`, `daily.ts`) that the
server and client use today. The real engine is built next to it and not wired in; `game-room`
switches the server and device games to it and deletes the placeholder (see proposal.md).
Requirements are in `specs/`; this page is about how.

## Goals / Non-Goals

**Goals:** a correct, allocation-light engine fast enough for search bots in a Web Worker; plain
JSON game state for sync, saving and replay; configuration for other boards (variants later).

**Non-Goals:** wiring into server/client, bots (beyond a random-move helper for tests), undo (a
session concern: `game-room` keeps state history), variants' configurations (only the classic one
is defined), daily puzzle.

## Decisions

### Modules (all new)

`pieces.ts` (the 21 shapes, ids, orientations), `geometry` helpers, `bitboard.ts` (board masks),
`config.ts` (`BoardConfig { size, starts }`, `CLASSIC`), `position.ts` (the engine state and
`applyMove`), `movegen.ts` (fast generation), `moves.ts` (encoding), `scoring.ts`,
`reference.ts` (naive generator, exported only through `@palikka/rules/testing`). The new public
API is exported from the package entry under names that do not clash with the placeholder
(`Position`, `Move`, `legalMoves`, `applyMove`, `scores` …). The placeholder files are removed by
`game-room`.

### Piece ids and orientations

Ids are the usual polyomino letters: `I1 I2 I3 V3 I4 O4 T4 L4 Z4 F5 I5 L5 N5 P5 T5 U5 V5 W5 X5 Y5
Z5` (order = id index 0–20; `I1` = the single square). Orientations are generated at module load
from one base shape per piece: 8 transforms, normalised to the bounding box's top-left, deduplicated,
sorted by a fixed key, so orientation indexes are stable. A golden test pins the 91 orientations.

### Bitboard representation

A board is one bit per square in a `Uint32Array`, one 32-bit word per row (boards up to 32 wide;
the classic 20×20 uses 20 words; Duo 14×14 fits). A piece orientation at column `c` is a small
array of row masks shifted left by `c`. Per colour the position keeps:
- `occupied` (all colours) and `own[colour]`;
- derived on demand per colour: `forbidden = occupied | edgeNeighbours(own)` and
  `corners = diagonalNeighbours(own) & ~forbidden` (the start square when nothing is placed yet).
Neighbour masks are row shifts (`(r << 1) | (r >>> 1)` within the row, rows above/below), masked to
the board width. Alternative considered: `BigInt` 400-bit boards; rejected (slow in V8, allocates).

### Corner-based move generation

For each corner square of the colour and each unplaced piece orientation, try every cell of the
orientation as the one landing on that corner; the anchor fixes the position. A placement is legal
iff it is inside the board and `pieceRows & forbidden == 0` for every row (corner contact is given
by construction). Duplicates (the same move found from two corners or two cells) are removed with a
per-call `Uint8Array` seen-table indexed by the move code. Precomputed per orientation: its cells,
row masks, height/width. Order: corners in row-major order, pieces by id, orientations by index,
cells by index; deterministic.

### Move encoding

`code = ((pieceId * 8 + orientation) * size + row) * size + col` for the top-left of the
orientation's bounding box; fits in 32 bits for any board ≤ 32. Also a readable form `{ piece,
orientation, row, col }` for JSON/protocol.

### Position (game state) as plain data

```
Position {
  config: BoardConfig; colours: number[];      // colours in this game, ascending
  cells: number[];                             // owner colour per square (0 empty), row-major
  placed: Record<colour, pieceId[]>;           // in placement order (last = monomino bonus)
  out: colour[]; turn: colour | 0; moveNumber; ended: boolean; aborted: boolean
}
```
JSON-serialisable so it syncs, saves and replays; the bitboards are rebuilt from `cells` in a small
cached `BitPosition` helper (not stored). `applyMove(position, colour, move)` validates with the
spec's refusal order and returns `{ ok, position } | { ok: false, code }`; after each move it
advances the turn, marking stuck colours out (this runs move generation for the next colours, the
cost of "automatic passing").

Refusal codes (for the protocol later): `PIECE_USED`, `OFF_BOARD`, `OVERLAP`, `EDGE_CONTACT`,
`NOT_ON_START`, `NO_CORNER_CONTACT`, plus `NOT_YOUR_TURN`, `GAME_OVER`, `CANNOT_PASS`.

### Testing

- Unit tests named after spec scenarios (`placement › A legal placement › Edge contact …`).
- fast-check: random legal games (random move each turn from `legalMoves`) → at each position the
  fast generator equals the reference generator as sets, with no duplicates; applying any listed
  move is accepted; every move from the reference-refused set is refused with a code; games always
  end; scores match a straightforward recount.
- Golden counts: 21 pieces, 91 orientations, 58 opening moves.

### Performance target and benchmark

`npm run bench -w @palikka/rules` (a plain `tsx` script, not in CI) plays seeded random 4-colour
games and reports moves generated per second and average generation time per position. Target on
the developer desktop: average under 0.5 ms per position for a full move list over random
mid-game positions; the measured number is recorded in `docs/architecture.md`. Not enforced in CI
(timing is flaky); bots measure themselves in `tournament-elo`.

### Decisions made during implementation

- `applyMove`, `pass` and `abort` live in `play.ts`, not `position.ts`: `position.ts` would
  otherwise import `movegen.ts` (automatic passing) while `movegen.ts` imports the bit view from
  `position.ts`, an import cycle.
- The duplicate filter is one module-level `Uint32Array` of stamps (a new stamp per call) instead
  of a fresh `Uint8Array` per call: same result, no 67 kB allocation per move list.
- One more refusal code, `INVALID_MOVE`, for malformed input (unknown piece or orientation index,
  non-integer position, colour not in the game). It is checked before the spec's order; legal
  input never gets it.
- `winners` returns an empty list while the game runs, not the current leaders.
- Test fixtures `placement(id, drawing, row, col)` and `positionWith(pieces)` (a board set up
  without rule checks) are exported from `@palikka/rules/testing` for later changes.
- Measured speed: 0.034 ms per full move list (see `docs/architecture.md`), well under the target.

## Meeting nfr.md

Pure package: no logging (the room logs rule outcomes). Tests as above; bundle impact small (piece
data generated at load). No I/O, no randomness except an injected rng in test helpers.

## Risks / Trade-offs

- [Automatic passing runs generation on every move] → it only needs "any legal move" per colour:
  an early-exit variant `hasLegalMove` stops at the first hit.
- [32-bit row limit] → boards over 32 squares wide are out of scope (none planned).
- [Two engines side by side until `game-room`] → names do not clash; the placeholder is deleted in
  `game-room`'s first task group.
