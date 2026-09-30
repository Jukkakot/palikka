# Tasks

## 1. Client: generic motion helpers and tokens

- [ ] 1.1 `client/src/motion/`: `filledSince`, `usePrevious`, `useLastMove` (D1), `useEnded` (D6),
  `useCountUp` (D6), `prefersReducedMotion`, no Palikka names; unit tests "Bot move marked", "Next
  move moves the mark", "Several moves at once", "Undo clears the mark", "Reloaded game", `useEnded`
  seen transition vs. already finished, `useCountUp` returns the target with reduced motion or
  `run=false`
- [ ] 1.2 `ui/tokens.css`: `--frost`, `--frost-edge`, `--last-mark`, `--snow` for light and dark, and
  `--motion-fast`, `--motion`, `--motion-slow` (D7); build passes

## 2. Client: board and tray

- [ ] 2.1 `Board`: `lastMove`, `fresh`, `shake`, `pulse` props (D2, D4): static last-move ring + dot,
  settle ≤ 250 ms on fresh squares, preview shake and pulse; existing Board tests pass, a small test
  that marked squares carry `data-last`
- [ ] 2.2 `usePlacement`: fitting computed whenever the game runs and the viewer has a tray colour
  (selection still only on turn), `nudge` counter on a refused placing attempt (tap, Enter, drop);
  tests "Frozen off turn", "Illegal attempt shakes" (counter), existing tests pass
- [ ] 2.3 `PieceTray`: frozen look replaces `opacity: 0.3`, `newlyFrozen` helper (same colour only)
  with the freeze animation, placed slot fade (D3); tests "Piece lost to another move" and colour
  switch does not animate (helper level)
- [ ] 2.4 `GameScreen` wiring: `useLastMove` on `view.board` (reset on room/new game, off when
  finished) → `lastMove` + `fresh`; `nudge` → `shake`; hint index → `pulse`; `PuzzleScreen` passes
  `fresh` from its own board diff (settle, no mark); typecheck and client tests pass

## 3. Client: strip and end

- [ ] 3.1 `PlayerStrip`: `turnSeat` mark with transition, `frozen` chip and the freeze only on a seen
  out transition (D5); tests "Turn moves" (`data-turn` moves), "Seat goes out" (frozen on transition,
  static when already out at mount)
- [ ] 3.2 `Snowfall` component (square flakes, seeded, fixed overlay, `pointer-events: none`, gone
  after 2.5 s, not mounted with reduced motion) and the result wiring: count-up of scores with the
  final value in accessible text, winner-row shimmer, snowfall when the viewer won or spectates,
  none without a winner; puzzle solved panel snowfall via `useEnded(solved)`; render test "Buttons
  usable at once" / final score in accessible text, test "No winner" (no snowfall)
- [ ] 3.3 UI check (Playwright `playwright-mobile`, portrait, light and dark, `/?dev=1v3`): last-move
  mark on all four seat colours, settle visible, frozen tray pieces off turn, turn mark and a frozen
  chip, end screen with count-up and snowfall (win, e.g. by watching bots as spectator), puzzle solved;
  reduced motion via `browser_emulate_media` shows the static marks; screenshots under `.playwright-mcp/`

## 4. Docs and wrap-up

- [ ] 4.1 Wiki: `docs/architecture.md` client section (last move from the board diff, motion
  helpers), `docs/template.md` (the `motion/` helpers as template candidates),
  `openspec/context/product.md` Theme (motion: restrained in play, playful at the end, square
  snowflakes); roadmap item 10 `game-motion` marked done
- [ ] 4.2 Check chain passes: `npm run lint && npm run typecheck && npm test && npm run build && npm
  run size -w @palikka/client`
