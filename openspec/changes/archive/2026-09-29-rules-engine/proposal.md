# Proposal

## Why

Everything in Palikka (rooms, UI, and above all the bots) stands on a correct and fast rules engine.
The bots need legal moves thousands of times per second, so move generation must be fast from the
start (bitboards, corner-based generation), and correctness must be proven beyond hand-written
examples (property-based tests against a simple reference).

## What Changes

- New real rules engine in `packages/rules`, pure and deterministic:
  - the 21 pieces and their distinct orientations (rotation and mirroring);
  - board configuration (size, colours, start corners) so variants can plug in later;
  - placement rules: inside the board, no overlap, first piece on the start corner, corner
    contact with the own colour, no edge contact with the own colour;
  - fast legal move generation (bitboards, corner-based) and a compact move encoding;
  - turn order, automatic passing (a colour with no legal move is out), game end, scoring
    (−1 per unplaced square, +15 for all pieces, +5 more when the monomino was last), results
    with placed squares shown too, shared wins;
  - a reference (naive) move generator used only by tests, and a benchmark script.
- The placeholder "claim a cell" engine stays in place and in use; nothing is wired to the new
  engine yet (`game-room` switches server and device games, `basic-ui` the screens).

## Capabilities

### New Capabilities

- `pieces`: the piece set of a colour and the distinct orientations of each piece.
- `placement`: where a piece may be placed and the complete list of legal moves in a position.
- `game-end-and-scoring`: turn order, automatic passing, the end of the game, scores and the result.

### Modified Capabilities

None.

## Impact

Workspace: `packages/rules` only (new modules, tests, a benchmark script). No change to server,
client, protocol or the running game. No new runtime dependencies.
