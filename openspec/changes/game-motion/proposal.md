# Proposal

## Why

Nothing on the game screen moves: a placed piece just appears, and nothing marks the last move. When
three bots play in a row, a person cannot see what happened last, which breaks the "What happened
last?" rule of the UI principles. The tray's "fits nowhere" dimming exists only on the player's own
turn and is faint, so players still reach for pieces they can no longer place. All roadmap items are
done; this is the first polish pass the user asked for (restrained motion in play, playful at the end).

## What Changes

- **Last move on the board**: the squares that the latest move(s) filled are marked until the next
  move, and a newly placed piece "settles" into place with a short frost animation. Works for every
  move (own, bot, online opponent) and wherever the board is drawn (games, spectating, puzzle).
- **Own move feedback**: the placed piece settles the same way the moment the move is accepted; an
  illegal drop or placing attempt shakes the preview briefly.
- **Turn and out**: the turn marker in the player strip slides to the next player; a colour that goes
  out "freezes" (its chip frosts over with a short animation).
- **Tray**: a piece that fits nowhere is dimmed **at all times** (also off turn), gets a frosted
  "frozen" look instead of a plain fade, and freezes with a short animation at the moment it is lost.
  A placed piece leaves its slot with a short fade. "Vihje" pulses once when a hint is shown.
- **End of the game (playful)**: the result table's scores count up, and the winner gets a short
  frost/snowflake celebration; the daily puzzle's "solved" panel gets the same celebration.
- **Reduced motion**: with `prefers-reduced-motion`, nothing moves, but the last-move marking and the
  frozen look stay as static styles.
- No change to the bots' pace: bots already move after a pause of about one second (device and
  online), which leaves time for the animation. No protocol or server change.

## Capabilities

### New Capabilities
- `game-motion`: motion and last-move feedback in games and the puzzle: last move marked on the board,
  placing animation, turn and out animations, end-of-game and puzzle-solved celebration, reduced
  motion.

### Modified Capabilities
- `piece-controls`: the tray's "fits nowhere" dimming holds off turn too, with the frozen look and
  the freeze at the moment a piece is lost.

## Impact

- Workspaces: **client only** (`rules`, `protocol` and `server` untouched; the client already has
  `fittingPieces` from `@palikka/rules`).
- Client: `game/Board.tsx` and its CSS (last-move marks, settle animation), `game/PieceTray.tsx`
  (always-on fitting, freeze), `game/usePlacement.ts` (fitting off turn), `game/PlayerStrip.tsx`,
  `game/ResultTable.tsx`, `game/HintButton.tsx`, `puzzle/PuzzleScreen.tsx`, `ui/tokens.css` (frost
  tokens, light and dark), a small generic helper module for board diffs and motion.
- No new dependencies; CSS animations only, so the bundle size stays within `size-limit`.
- Docs: `docs/architecture.md` (client section), `docs/template.md` (generic motion helpers),
  `openspec/context/product.md` (Theme: motion), roadmap item 10.
