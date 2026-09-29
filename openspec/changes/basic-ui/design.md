# Design

## Context

- The game screen (`client/src/screens/GameScreen.tsx`) renders `Board` (400 cells; on the viewer's
  turn the tappable squares are `<button>`s) and `PlaceControls` ("Vihje", "Peru"). A move comes
  from `game/interimMoves.ts` (largest piece on a tapped free corner). The hint rings the bot's
  squares (`hintSquares`, greedy `chooseMove`, 100 ms on the UI thread, seeded by the turn).
- `GameView.position` is the engine's `Position`, so the client can run `legalMoves`,
  `checkPlacement` and `freeCorners` itself; the server validates every `place` anyway.
- Orientations: `ORIENTATIONS[piece][index]`, indexes sorted by shape key (stable, golden-tested);
  `rotateShape` / `mirrorShape` exist but nothing maps an index to its turned or mirrored index.
- Start screen: nickname, "Pelaa" (`joinOrCreate`, joins any open game of the pool), the bot group
  (1v1–1v3 or watch 2–4 with "Pelaan itse"), always-shown open games and running games lists.
- The phone reference is 360×780 CSS px (Galaxy S24); a board square is about 17 px there.

## Goals / Non-Goals

**Goals:** any piece in any orientation on any legal spot, by touch, mouse and keyboard; usable at
360 px wide with 17 px squares (snapping carries the precision); a wide-screen layout; the result
table; the simpler start screen; rules pictures.

**Non-Goals** (`mobile-ui`): choosing from legal moves first (corner → piece → orientation), dragging
with the piece above the finger, zoom, the three-best-moves hint, TV mode, Duo on a phone.
Animations beyond the existing ones. No server or protocol change. Moving the hint into the worker.

## Decisions

### Rules: orientation stepping and fitting pieces (`packages/rules`)

- `pieces.ts`: `TURN_CW[piece][index]` and `MIRROR[piece][index]` tables built at load from
  `rotateShape` / `mirrorShape` and the shape keys, exported through `turnOrientation(piece, index)`
  and `mirrorOrientation(piece, index)`. Tables, not per-call shape work, because the UI calls them
  on every key press and the golden orientation order stays untouched.
- `movegen.ts`: `fittingPieces(position, colour): Set<number>`, the pieces with at least one legal
  move (from `legalMoves`). One call per turn; the tray dims the rest.
- Alternative considered: keeping this in the client. Rejected by the project rule "rule logic
  goes to packages/rules", and the bots may use `fittingPieces` later.

### Placement model (`client/src/game/placing.ts`, pure)

- State while placing: `{ piece, orientation, square, snap }` where `square` is the pointed board
  square and `snap` says whether it came from a pointer (true) or the keyboard/hint (false).
- **Reference square** of an orientation: its cell nearest the centre of its bounding box (ties:
  first in row-major order). It is what sits under the pointer and what the arrow keys move.
- `previewAt(position, colour, state) → { move, squares, legal, reason? }`:
  - snap: among the legal moves of this piece and orientation that cover `square`, the one whose
    reference square is nearest to `square` (squared distance; ties: engine move order). None →
    the reference square on `square`, shifted inside the board, `legal: false`, `reason` from
    `checkPlacement` (so the reason is the rules' own, in their order).
  - exact: the reference square on `square`, shifted inside the board; legality and reason from
    `checkPlacement`.
- Legal moves per turn are decoded once and grouped by piece and orientation (memoised on the
  position object), so a pointer move costs a filter over at most a few hundred moves.
- Turning or mirroring keeps `square` and recomputes the preview, so the piece turns "under the
  finger".

### Input on the board

- Board cells stay plain `<span data-cell>`; the grid element handles `pointermove` (mouse only:
  hover sets `square`), `pointerleave` (mouse: clears the hover preview unless the keyboard or a tap
  set it) and `click` (reads `data-cell` of the target).
- **Click rule, the same for every pointer:** a click on a square inside a legal preview places it;
  any other click moves the preview there (snapped). With a mouse the hover already made the
  preview, so one click places; on touch the first tap shows, the second places. One rule, so no
  pointer-type branches and E2E clicks behave like taps.
- **Keyboard:** the board is focusable while a piece is chosen; arrow keys move `square` (exact,
  clamped), Enter/Space place a legal preview. R turns, F mirrors, Escape clears, handled on the
  game screen when focus is not in a text field. A visually hidden live region announces the
  preview ("Rivi 3, sarake 5: sopii" or the reason).
- The free-corner dots stay on the viewer's turn as orientation help (no longer buttons).
- Preview look (theme Kuura, flat): legal = the seat colour at reduced opacity with a thin inset
  outline in `--text`; illegal = `--cell` with a dashed `--danger` inset outline. New tokens
  `--preview-ok-outline`, `--preview-bad` in light and dark.

### Piece tray and controls

- `PieceShape` draws an orientation as a small CSS grid of seat-coloured squares (reused by the
  tray, the rules pictures and nowhere else yet). `PieceTray` = 21 fixed slots in piece-id order
  (sizes 1→5, stable muscle memory): 7 columns on a phone (≈ 50 px slots ≥ 44 px tap target), each a
  `<button aria-pressed>` labelled "Palikka I5, 5 ruutua". Placed → empty slot; not fitting →
  dimmed and disabled on the own turn; off turn every slot is disabled but visible. The chosen
  slot shows the current orientation, the others their first.
- `PlaceControls` becomes one bar: the status line (what to do, or the preview's reason), then
  "Käännä", "Peilaa" (icon + short label), "Aseta" (primary, disabled without a legal preview),
  "Vihje", and "Peru" where it exists. Wraps to two rows at 360 px.
- `usePlacement(view)` hook owns the state; it resets when `view.turn` changes or the move is
  accepted, keeps the choice on a refusal (the notice shows the code's text as now).
- **Hint:** `hintMove(position, colour, turn) → Placement | undefined` (the old `hintSquares`
  without the square mapping); "Vihje" sets `{ piece, orientation, square: reference square of the
  move, snap: false }`, so the preview is exactly the bot's move. The old ring style goes.

### Layout

- Phone portrait: turn line, player strip, board (`min(100%, 60dvh, 640px)` as now), control bar,
  tray. The page may scroll a little on short phones; the board never scrolls sideways.
- Wide screens (`min-width: 900px` and landscape): two columns, the board left (as tall as the
  viewport allows, max 720 px) and a side column with turn line, strip, controls and tray (tray
  slots larger). One CSS Module media query in `GameScreen.module.css`; no JS layout.

### Result screen

- `viewModel` gains `results: ResultRow[]` for finished games: one row per colour of the game
  (from `position.colours`), with `seat`, `name` (from the seated player; a colour whose player left
  has no player any more, so the row says "Lähti metsään" with the colour mark), `score`, `squares`,
  `piecesLeft` (21 − placed), `left`, `winner`, `rank` (competition ranking: 1, 1, 3). Pure and
  unit-tested; `SeatView` gains `piecesLeft` too.
- `ResultTable` renders it under the winner line, above the existing `GameOverControls`; the tray
  and control bar are not shown when finished.

### Start screen

- Two equal cards, stacked on a phone, side by side from 640 px: **"Pelaa botteja vastaan"**
  (the existing count buttons and the "Pelaan itse" switch move in here) and **"Luo peli
  kavereille"** (one button; disabled while the server wakes; the wake status sits in this card).
- "Luo peli kavereille" uses a new connector call `create(options)` → Colyseus `create("game",
  { nickname, pool })`, so it never lands in someone else's waiting room. `useGameSession` gets
  `createGame(nickname)`; the old quick play `play` (`joinOrCreate`) is removed with its button.
  The server already allows `create` (no server change).
- The open and running games lists move into one secondary section "Liity peliin" rendered only
  when one of the lists has entries ("no games" and "list unavailable" texts go).
- Invite mode and "Jatka peliä" keep their current behaviour.

### Rules pictures

- `howto/RulePicture.tsx`: a 5×5 mini board drawn with the same cell styles, from fixed data
  (the start corner with a piece on it; two own pieces meeting at a corner, marked "Sallittu";
  two meeting along an edge, marked "Ei sallittu"). New sections "Palikan asettaminen" and
  "Pisteet" with the texts in fi/en. No new rule logic.

### How it meets the NFRs

- **Logging:** no new events; a refused `place` is audited by the server as before and the client
  shows the existing notice. No client log for previews (UI-only state never crosses the network).
- **Tests:** rules unit tests for the stepping tables (every orientation: four turns and two
  mirrors return; plus-shaped stays) and `fittingPieces` (equals the pieces in `legalMoves`,
  property-checked along random games). Client unit tests for `placing.ts` (snap, fallback,
  reason, exact/clamp, reference square), `usePlacement` transitions, `results` in the view model.
  Render tests: tray select → "Aseta" sends `place`; illegal preview not sent; start screen's two
  ways; the result table. E2E smoke and production smoke place a piece through the tray.
- **Performance:** no per-frame work beyond recomputing the preview on a new square; memoised legal
  moves per position; no new dependency, bundle stays under 200 kB (checked by `npm run size`).
- **Error UX:** a refused move shows the existing localised notice; an illegal preview explains
  itself before anything is sent.
- **Accessibility (basic):** tray buttons ≥ 44 px on a phone, labelled; "Käännä"/"Peilaa" have text
  labels; the live region voices the preview; keyboard play works end to end.

## Risks / Trade-offs

- [17 px squares on a phone are still small] → snapping makes any tap near the target legal; a
  second tap anywhere inside the preview places. Drag and zoom are `mobile-ui`'s.
- [A mouse click places at once: a slip places a piece] → the hover preview shows the exact spot
  before the click; "Peru" exists against bots. Online moves are final, as in the board game.
- [The tray plus controls make the phone page taller than 780 px] → accepted to scroll slightly;
  the board and the bar stay together at the top; checked in the UI check.
- [Removing quick play: strangers no longer meet by one tap] → the open games section still lists
  waiting games; product.md allows cutting the list, keeping it costs little.

## Migration Plan

Client-only release. The server keeps accepting `joinOrCreate` from old cached clients until they
update (the PWA auto-updates). After the deploy the production smoke (updated here) must pass:
check the `Production smoke` workflow run on `main`.
