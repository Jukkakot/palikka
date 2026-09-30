# Tasks

Implement after `variants` is archived (reads Duo, the variant choice and the viewer's colours).

## 1. Bots: top moves

- [ ] 1.1 `packages/bots`: `rankMoves(game, evaluate, state, player, n, rng?)` (one ply, best `n`,
  seeded tie-break); toy-game tests (order, `n` larger than the move count, seeded ties)
- [ ] 1.2 `@palikka/bots`: `topMoves(position, colour, n, seed, viewpoint?)`; test: the first equals
  `greedyPlayer`'s move for the same seed; `npm test -w @palikka/bots` passes

## 2. Client: models (pure, tested)

- [ ] 2.1 `game/boardView.ts`: `ViewTransform`, `toScreen` / `toBoard`, `screenOrientation`,
  `mirrorOnScreen`, screen arrows, `turnsFor`; tests: round trips for all turns, shapes as seen,
  "Seat 2 on a phone" turns, Duo starts
- [ ] 2.2 `usePhoneLayout()` (the wide layout's media query negated) and settings `boardZoom`
  (default on) and `lastVariant`; tests for the settings defaults and storage
- [ ] 2.3 Zoom box (pure): free corners → box with margin 2, minimum 10, clamped, whole board at 16 or
  more, widened by a preview; tests "Zoom on turn" at model level
- [ ] 2.4 `usePlacement`: corner mode (tap corner, filtered `fitting`, placements covering the
  corner, "‹ ›" stepping with wrap, switching corners, leaving by square, R/F or the chosen piece);
  tests "Tap a corner", "Step through spots", "Place from corner mode", "Leave corner mode"
- [ ] 2.5 `usePlacement`: drag aims (start, live landing spot with short-range snap (≤ 1 square), recomputed per aimed square, release over the board keeps the spot legal or not, cancel) and the
  hint cycle over `topMoves` cached per turn; tests "Drag from the tray", "Live landing spot", "No far jumps", "Move the preview", "Drop
  outside", "Second best", and the existing hint tests updated

## 3. Client: components

- [ ] 3.1 `Board`: `view` prop (screen order, board indexes out), the zoom box transform (animated,
  none with reduced motion), `touch-action: none` only while dragging; existing Board tests pass
- [ ] 3.2 Floating piece while dragging (touch: 1.5 squares above the finger; full colour over a legal spot, faded and dashed over an illegal one); `PieceTray` drag start
  with the 8 px threshold; tray and `PieceShape` draw screen orientations
- [ ] 3.3 Control bar: "‹ n/m ›" in corner mode; "Vihje n/3"; zoom toggle in the phone layout;
  "Peilaa" and arrows as seen; fi/en texts in the Kuura voice (locale parity test passes)
- [ ] 3.4 `GameScreen` wiring: the transform from `turnsFor` (phone layout, seated, the first
  colour), the zoom on the viewer's turn, corner taps; a render test "What you see is what you place"
  (a turned board places the shape shown)
- [ ] 3.5 Start screen: the variant default and remembering it; render tests "First time on a phone",
  "Remembered choice"
- [ ] 3.6 UI check (Playwright `playwright-mobile`, portrait, light and dark): the turned board for
  seat 2 (`/?dev=1v3` as seat 1 and a watched game unturned), corner mode with "‹ ›", a drag in
  progress (the floating piece above the finger), the zoom on turn and off, "Vihje 2/3", the start
  screen's Duo default; landscape and a narrow desktop once (the layout changes); screenshots under
  `.playwright-mcp/`

## 4. Docs and wrap-up

- [ ] 4.1 Wiki: `docs/architecture.md` client section (board view transform, corner mode, drag,
  zoom, hint top 3, `rankMoves` in the bot library); `openspec/context/product.md` Mobile ideas →
  decided and built, TV mode removed; roadmap item 9 marked done
- [ ] 4.2 Check chain passes: `npm run lint && npm run typecheck && npm test && npm run build && npm
  run size -w @palikka/client`
