# Design

## Context

See proposal.md for the why. The rules package already has the 21 pieces and their orientations,
the seeded RNG (`createRng`, `shuffle`) and the `Placement` type; the client has the board, the
piece tray, the placement model (`placing.ts`: reference square, snapping preview) and shared UI
parts. The puzzle needs none of the match machinery (turns, corner rule, bots, server).

This change runs in parallel with `variants`, which touches the same packages. To keep merges easy
it adds new files and only small, optional props to shared components (Board, PieceTray); it does
not touch the hot files (`GameScreen.tsx`, `useGameSession.ts`, `viewModel.ts`, `localRoom.ts`,
`game.ts`).

## Goals / Non-Goals

**Goals:** a daily, deterministic, always-solvable puzzle; placing that feels the same as in a
game; progress and stats on the device only; a start-screen entry.

**Non-Goals:** see proposal.md (leaderboards, past puzzles, hints, corner rule).

## Decisions

### D1. The puzzle lives in `packages/rules/src/puzzle.ts`

Pure and deterministic like the rest of the rules, so it is unit- and property-tested there and
could later run on the server. Exports:

- `PUZZLE_VERSION = 1`: part of the seed; bump it only when puzzles are meant to change.
- `dailyPuzzle(date: string): Puzzle` for a local date `YYYY-MM-DD`. `Puzzle = { date, size, shape:
  readonly number[] (board indexes, ascending), pieces: readonly number[] (ascending), solution:
  readonly Placement[] }`. The board is `size × size` (square, like the game board); squares
  outside `shape` are not part of the puzzle.
- `puzzleFits(puzzle, placements, placement): PuzzleRefusal | undefined`: refusals `PIECE_USED`
  (already on the board or not in the puzzle), `OFF_SHAPE` (a square outside the board or the shape),
  `OVERLAP`.
- `puzzleSolved(puzzle, placements)`: every piece placed (the squares then cover the shape exactly,
  because the pieces' sizes add up to the shape's).

*Alternative:* put everything in the client. Rejected: the generator is rule logic ("Rule logic goes
to packages/rules first") and wants property tests.

### D2. Seed and difficulty from the date

Seed = FNV-1a 32-bit hash of `` `palikka-puzzle-${PUZZLE_VERSION}-${date}` ``. The weekday is taken
from the date string itself (UTC parse), never from the clock, so a date always gives the same
puzzle. Piece count by weekday: Mon 5, Tue 5, Wed 6, Thu 6, Fri 7, Sat 7, Sun 8. The pieces: `n − 2`
distinct pentominoes and 2 distinct pieces of size 3–4, drawn with `shuffle`. Sizes: 21–38 squares.

The date is the device's local date (`YYYY-MM-DD` from local time). Players in other time zones
see "today" shift at their midnight; accepted (the players are in Finland).

### D3. Generation packs the pieces into a compact, hole-free shape

On a 16×16 work grid: the first piece (in a random orientation) goes to the middle. Each next piece:
all orientations × positions that do not overlap and share at least one edge with the shape so far;
each candidate's *contact* = number of shared edges; pick uniformly (RNG) among candidates with
contact ≥ max − 1. That makes compact but irregular shapes (a puzzle, not a rectangle). If the final
shape encloses a hole (an empty square not reachable from outside), the attempt is thrown away and
the next attempt continues with the same RNG (deterministic); after 50 failed attempts the last
shape is used anyway (never seen in tests; the property test counts attempts). Then the shape is
cropped to its bounding box and centred in a square board of size `max(height, width)`; the
solution is shifted the same way.

The puzzle is solvable by construction (the solution is the packing). Uniqueness is not required;
any exact cover counts.

### D4. Client: its own screen, store and placement, reusing the components

`client/src/puzzle/`:

- `puzzleStore.ts`: localStorage key `palikka.puzzle`, `{ v: 1, progress?: { date, placements,
  elapsedMs }, stats: { lastSolved?, streak, longestStreak, solved, best: Record<pieceCount, ms> },
  results: Record<date, ms> (only today's is kept) }`. A save of another `v` is dropped; every read
  and write is wrapped in try/catch (private mode). Streak: solving on day D continues the streak
  when `lastSolved` is D − 1, else it restarts at 1; solving the same day again never happens (a
  solved puzzle is shown as solved).
- `puzzlePlacing.ts`: the preview for the puzzle rule, the same shape as `placing.ts` (reference
  square via `referenceCell`; a pointer snaps to the fitting spot of the orientation that covers the
  square with the reference square nearest; keyboard aims exactly). Kept separate from `placing.ts`
  because that one is built on the game's legal-move list.
- `usePuzzle.ts`: the state (placements, chosen piece, orientation, aim), the clock and saving.
- `PuzzleScreen.tsx`: top bar (back, time), status line, board, controls bar ("Käännä", "Peilaa",
  "Aseta", "Tyhjennä"), tray; when solved, the result panel instead of the controls and tray.

Shared components get optional props only: `Board` gets `outside?: ReadonlySet<number>` (squares
drawn as ground, not cells, and not clickable; the puzzle passes its own owner array for colours);
`PieceTray` gets `pieces?: readonly number[]` (only these slots
are shown). Existing callers do not change.

### D5. Taking a piece back

A click or tap on a placed piece's square, when it is not inside the current legal preview, lifts
that piece: it leaves the board and becomes the chosen piece in the same orientation, aimed where it
was (so it can be moved with one more tap). "Tyhjennä" removes all pieces (enabled when any is
placed). There is no undo stack; lifting is the undo.

### D6. Colours on the puzzle board

Each placed piece gets one of the four seat colours, chosen greedily in placement order as the
lowest colour not used by an edge-neighbouring piece (so neighbours differ almost always; with four
colours and small shapes a clash is rare and harmless). The tray and the preview use Järvi.

### D7. Time

The clock runs while the puzzle screen is open, the page is visible and the puzzle is unsolved; it
starts at the first open of the day's puzzle. `elapsedMs` is saved with the progress on every
placement and when the screen closes or the page hides. The display is `m:ss`, updated once a
second. The score is the time; the personal best is per piece count (Sunday's 8 pieces are never
compared with Monday's 5).

### D8. Solved panel and sharing

Title "Kuvio kuurassa!" (fi) / "Frosted over!" (en), the time, "Uusi ennätys!" when it beat the
best for the piece count (or it is the first), the streak ("Putki: 3 päivää"), and "Jaa" using
`shareOrCopy`: `Palikka · Päivän pulma 30.9.2026 · 7 palaa · 2:34 · putki 3 ❄️` plus the app URL.
No board picture (spoiler-free). The screen then keeps showing the solved board; the next day's
puzzle appears after midnight on the next open.

### D9. Start-screen entry

A third, smaller section below the two ways in: "Päivän pulma" with a one-line body and a button
"Avaa pulma"; when today's puzzle is solved the body says the time and streak and the button is
"Katso" (secondary). It needs neither a nickname nor the server. The screen opens like the settings
and rules screens (state inside `StartScreen`), and is loaded lazily (`React.lazy`) to keep the main
bundle within the size limit.

### D10. How it meets nfr.md

- **Logging:** one new client key event `client.puzzle.solved` with `date`, `pieces`, `seconds`
  (added to the protocol's catalogue and key events first; the server accepts it after its deploy).
  No nickname is sent (the puzzle has none).
- **Tests:** rules: every `daily-puzzle` rule scenario (determinism, weekday counts, fit refusals,
  solved) plus a fast-check property over random dates (solution fits and solves, shape connected
  and hole-free, sizes add up, size ≤ 16). Client: store (streaks, bests, version drop, broken
  storage), `puzzlePlacing` (snap, exact, refusal), `usePuzzle` (place, lift, clear, solve records
  once); one render test for the start-screen entry and one for the solved panel. No server tests
  (no server change); E2E smoke unchanged.
- **Limits:** generation takes well under 50 ms on a phone (≤ 8 pieces, ≤ 8 orientations, 16×16);
  a rules test bounds 365 days at < 2 s in CI.

## Risks / Trade-offs

- A puzzle with many solutions is easier than intended → contact ≥ max − 1 keeps shapes compact;
  the weekday ladder adds pieces. Tuning later changes `PUZZLE_VERSION`.
- Merge with `variants`: Board, PieceTray, StartScreen, i18n files, protocol log events and the
  rules index are touched by both; the edits here are additive, conflicts are resolved at merge.

## Decisions made during implementation

- The start-screen entry's button is always secondary ("Avaa pulma" / "Katso"), so the two ways in
  keep the primary weight (UI check).
- The shape's empty squares get an inset outline in the board's frame colour; squares outside the
  shape are bare ground. Without the outline the shape vanished into the light ground (UI check).
