# Design

## Context

See proposal.md for the why. Today (`basic-ui`, extended by `variants`): `usePlacement` holds the
choice (piece, orientation, aimed square, snap). `placing.ts` turns an aim into a preview (a pointer
snaps to the legal spot covering the square whose reference square is nearest). `Board` renders a
square grid and reports pointer, click and arrow keys. `PieceTray` shows the pieces of the colour
the viewer plays now or next. The hint is `hintMove` (greedy, 100 ms, seeded by the turn). The
phone layout is the stacked one; the wide layout starts at `min-width: 900px` and landscape.

This change must come after `variants`: it reads the colour the viewer plays now, Duo's start
squares and the start screen's variant choice.

## Goals / Non-Goals

**Goals:** fewer mis-taps on a phone; every new way of placing ends in the same preview and the same
"place" step as today; nothing changes for mouse and keyboard users on a wide screen except the
hint's top 3.

**Non-Goals:** see proposal.md.

## Decisions

### D1. "Phone" means the stacked layout

One hook, `usePhoneLayout()`, answers from `matchMedia("not ((min-width: 900px) and (orientation:
landscape))")`, the negation of the wide layout's media query. The turned board, the zoom and Duo
first all use it, so they switch together with the layout. *Alternative:* `pointer: coarse` was
rejected. A tablet in landscape gets the wide layout and does not need turning, and a narrow desktop
window behaves like a phone, which the UI check can exercise.

### D2. The view transform: board space vs. screen space

A pure module `client/src/game/boardView.ts` holds `ViewTransform = { turns: 0 | 1 | 2 | 3 }`, the
number of quarter turns clockwise applied to the board for display. It provides:

- `toScreen(square, size, t)` / `toBoard(screenSquare, size, t)`: index mapping.
- `screenOrientation(piece, orientation, t)`: the orientation index whose cells equal the piece
  turned `turns` times. Used by the tray and `PieceShape`, so a piece looks on screen the same in
  the tray as on the board.
- `turnOnScreen` / `mirrorOnScreen(piece, orientation, t)`: "Käännä" turns clockwise *as seen*
  (a rotation commutes with the view's rotation, so this is `turnOrientation`). "Peilaa" mirrors
  left to right *as seen*. With an odd number of turns that is a top-to-bottom mirror in board
  space, computed by shape lookup: mirror the screen shape, then map it back.
- The arrow keys move in screen directions (mapped back to board directions).

`turnsFor(startSquare, size)`: the quarter turns that bring the square to the bottom-left
quadrant. Start squares: seat 1 top-left → 3 turns (270° clockwise), seat 2 top-right → 2, seat 3
bottom-right → 1, seat 4 bottom-left → 0. Duo: start (4,4) → 3, start (9,9) → 1. With several
colours (Tuplaväri) the viewer's **first** colour decides, so the board does not spin between turns.
In Kolmikko the viewer's own colour decides. Spectators and the wide layout get `turns: 0`.

`Board` gets an optional `view` prop. It renders cells in screen order and reports board indexes,
so `usePlacement` and `placing.ts` stay in board space and are untouched except the arrow mapping.

### D3. Corner first

`usePlacement` gets a `corner?: number` (board index) in its state:

- Tap on a free corner (dot) with **no piece chosen** → `corner` is set. The tray's `fitting`
  becomes the pieces with at least one legal move covering that square. Other pieces are dimmed as
  "fits nowhere" is today, but with the status line "Nämä sopivat tähän kulmaan".
- Choosing a piece while `corner` is set → the preview is that piece's first legal move covering
  the corner (engine order), and the control bar shows "‹ 1/7 ›" in place of "Käännä" / "Peilaa".
  The arrows cycle through the piece's legal moves covering the corner, in engine order, wrapping
  around.
- Placing works as today (tap inside the preview, Enter, "Aseta").
- Tapping another free corner switches the corner. With the piece still chosen, the list restarts
  on the new corner. If the piece does not fit there, the piece is dropped.
- A tap on a square that is not a free corner, or tapping the chosen piece again, leaves corner
  mode. The normal flow continues, keeping the piece and its current orientation.
- R / F while in corner mode leave corner mode and turn or mirror (keyboard users keep today's
  flow).

The legal moves covering a square come from the existing per-position move grouping in `placing.ts`
(`legalMovesOf` generalised to "all legal moves of a colour", then filtered). Cost: one
`legalMoves` list per position, as today.

### D4. Drag with snap

Pointer events, no library (`@use-gesture` was considered; the need is small: one pointer, move and
release).

- **From the tray:** `pointerdown` on a fitting piece starts a potential drag. Moving more than 8 px
  starts the drag and chooses the piece; a smaller movement is a tap, as today.
- **From the board:** `pointerdown` inside the current preview starts a drag of the preview.
- While dragging, a floating copy of the piece (screen orientation, seat colour, square size of the
  board) follows the pointer. For touch it is drawn with its reference square 1.5 squares above the
  finger; for a mouse, under the pointer. The aimed square is the board square under the floating
  piece's reference square.
- **Live landing spot (user's wish, 2026-09-30):** on every pointer move, the board shows exactly
  where the piece would land if let go now, as the preview. A legal spot is drawn in the seat
  colour with the preview outline. A spot that is not legal is drawn in the warning style (dashed
  outline, as an illegal preview today), and the status line gives the reason. The floating piece
  shows the same: full colour over a legal spot, faded with a dashed warning outline over an
  illegal one. The landing spot is recomputed only when the aimed square changes (at most once per
  square, not per pixel), so it stays cheap.
- **Snapping while dragging is short-range:** the landing spot snaps only to a legal spot whose
  reference square is at most one square (including diagonally) from the aimed square. Otherwise
  it is the exact spot under the piece, marked illegal. The preview therefore never jumps far away
  from the finger, and what is shown is where the piece really goes. Tapping and pointing keep
  today's full snapping (any legal spot covering the square). *Alternative:* full snapping while
  dragging. Rejected: the landing spot could jump several squares away from the finger, which is
  exactly what the live view should avoid.
- **Release:** over the board the landing spot stays as the preview, legal or not; nothing is sent.
  A legal one is placed by a tap inside it or "Aseta". An illegal one keeps its reason visible and
  can be dragged again. Outside the board the drag is cancelled: the piece stays chosen and the
  preview returns to where it was, or none. In corner mode a drag leaves corner mode.
- The board sets `touch-action: none` only while a piece is being dragged, so page scrolling
  still works otherwise.

### D5. Zoom to your corners

Phone layout, the viewer's turn, zoom on (setting `boardZoom`, default on, remembered in
`palikka.settings`). The zoom box is the bounding box of the viewer's free corners in screen space,
plus 2 squares of margin. It is grown to a square of at least 10 squares and clamped to the board.
It is shown by a CSS `transform: scale()` + `translate()` on the grid inside the board frame
(`overflow: hidden` on the frame, which is intentional clipping). The move is animated over 200 ms,
none with `prefers-reduced-motion`. Off turn, at the end, or with no free corners, the whole board
shows. If the box is 16 squares or more wide, the whole board shows (zooming would barely help). A
preview or a dragged piece that reaches outside the box widens the box to include it, so nothing
you place is clipped.

The toggle is an icon button in the control bar ("Lähennä" / "Koko lauta", `IconZoomIn` /
`IconZoomOut`), shown only in the phone layout.

### D6. Hint top 3

The library (`packages/bots`) gets `rankMoves(game, evaluate, state, player, n, rng?)`: one ply, the
`n` best moves by `evaluate` for the mover, ties broken by the seeded RNG. It is game-independent
and tested with the toy game. Palikka: `topMoves(position, colour, n, seed, viewpoint?)` in
`@palikka/bots`. The hint calls it once per turn with `n = 3` and caches the result on the turn.
"Vihje" steps 1 → 2 → 3 → 1. The button reads "Vihje 2/3" after the first press. With fewer legal
moves the count is smaller. The cost is the greedy player's cost (one ply), within the current
100 ms budget.

### D7. Duo first on a phone

The bot way's variant choice starts at the last variant the player picked on this device (setting
`lastVariant` in `palikka.settings`). If none was picked yet, it starts at Duo in the phone layout
and Perus otherwise. Online games are not affected: the host picks in the waiting room as today.

### D8. TV mode dropped

Removed from `product.md` (Mobile ideas) and from the roadmap text for item 9.

### D9. How it meets nfr.md

- **Logging:** nothing new on the wire. The corner, drag and zoom actions are UI only. A placed
  move is logged as today.
- **Tests:**
  - `boardView` (mapping round trips for all four turns; the screen orientation matches the shape;
    mirror as seen; `turnsFor` for all seats and Duo).
  - `usePlacement` (the corner mode scenarios; drag aims snapping; the hint cycle).
  - `rankMoves` in the library (toy game) and `topMoves` (the best equals `greedyPlayer`'s move).
  - The zoom box (pure function: minimum 10, the 16 cut-off, a preview widening the box).
  - The start screen's variant default (render test with the phone media query mocked).
  - The UI check covers the look: the turned board, the floating piece, the zoom.
  - E2E smoke unchanged.
- **Limits:** no new bundle dependency; the size limit is kept (check chain). Corner filtering reuses
  the cached legal-move list.

### D10. As few taps as possible, but no accidental moves (user, 2026-09-30)

Guiding rule for every placing flow: minimise taps, but a move is only sent after a deliberate
confirmation. So letting go of a drag never places. The confirmation is one tap, either inside the
legal preview or on "Aseta"; "Aseta" stays. Counts this change aims at (a legal spot, on a phone):

- Drag: drag + let go + 1 tap = one gesture and one tap.
- Corner first: corner + piece + (stepping only when the first spot is not the one wanted) + 1 tap.
- Tray + tap: piece + aim + 1 tap (as today).

Small savings that follow from the rule and are part of this change:

- In corner mode, when exactly one piece fits the corner, it is chosen at once (its first spot is
  the preview). With one legal spot, "‹ ›" is hidden.
- After a drag is released on a legal spot, the status line says "Napauta palikkaa tai paina
  Aseta", so the one-tap way is visible.

Considered and left for later: an optional setting "Aseta heti kun päästät irti" (off by default).
The user wants to keep the confirmation for now.

## Risks / Trade-offs

- The turned board could confuse players who also play on a desktop → only the view turns, and the
  own colour's corner is always bottom-left, which is easy to learn. It turns only on the phone.
- Zooming while the player looks can feel jumpy → it zooms only at the start of their turn and when
  a preview leaves the box, and the toggle turns it off.
- Drag and tap on the same element → the 8 px threshold. The tray's tap behaviour stays as it is.

## Implementation notes (2026-09-30)

- Zoom frame uses `overflow: clip` (fallback `hidden`): a hidden frame was scrolled by
  `scrollIntoView` in the UI check, showing the wrong part of the board.
- The floating piece uses the board's square pitch (board width / size), so it lines up with the
  landing spot under a zoom.
- Status texts: in corner mode, while dragging and after a drop the legal-preview line is "Napauta
  palikkaa tai paina Aseta" (no "uudelleen": the piece was never tapped).
- `touch-action: none` sits on the draggable tray pieces (on the viewer's turn) and the preview's
  squares, since a browser decides scrolling at the press; the whole board gets it while dragging.
- `boardZoom` is toggled only from the control bar, not the settings screen.
- The hint's `rankMoves` has no time limit (it rates all moves); measured 5–30 ms on a desktop
  mid-game, computed once per turn on the first press.
