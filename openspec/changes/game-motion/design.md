# Design

## Context

- The board (`client/src/game/Board.tsx`) is a CSS grid of one `<span>` per square, coloured by
  `--seat-n`; the preview is drawn in the same squares. It is used by the game screen and the daily
  puzzle. Only the zoom has a transition today.
- `GameView.board` is the synced owner array; a new array arrives with every state patch. Undo in
  device games rewrites it to an earlier board.
- Bots already move after `BOT_DELAY_MS` (1 s) divided by the watching speed (so 250 ms at 4×), on
  the device and online. The pace needs no change; animations must just fit in 250 ms.
- The tray's `fitting` set comes from `usePlacement`, computed only while `active` (the viewer's
  turn). `PieceTray` dims non-fitting pieces with `opacity: 0.3`.
- `index.css` already has a global `prefers-reduced-motion` rule that cuts every animation and
  transition to 0.01 ms.
- Result table (`ResultTable.tsx`) and puzzle solved panel (`PuzzleScreen.tsx` → `SolvedPanel`)
  are plain static markup.

## Goals / Non-Goals

**Goals:**
- Every motion in plain CSS (keyframes, transitions) driven by `data-*` attributes and classes set
  from small, unit-tested pure helpers.
- Keep the generic helpers free of Palikka names so they can move to the shared template (E).

**Non-Goals:**
- No animation library, no canvas, no sound.
- No piece flying from the tray to the board (the squares animate in place).
- No change to the bots' pace, the protocol or the server.
- No settings toggle for motion: `prefers-reduced-motion` is the switch.

## Decisions

### D1. Last move from a board diff, in the client
A pure helper `filledSince(prev, next): Set<number>` returns the squares that are empty in `prev` and
filled in `next`. A hook `useLastMove(board, resetKey)` keeps the previous board in a ref and the
last non-empty diff in state: a diff with new squares replaces the mark; a diff that only removes
(undo, puzzle lift) clears it; an identical board keeps it. The first board seen (and any change of
`resetKey`: room id, variant, a new game) sets no mark. When `finished`, the mark is not passed to the
board.
*Alternative:* sync the last move from the server. Rejected: protocol change, and device games would
need the same; the diff covers both and catch-up updates (several moves) for free.

### D2. Board rendering
`Board` gets two optional props: `lastMove?: ReadonlySet<number>` (static mark, class `last`) and
`fresh?: ReadonlySet<number>` (settle animation, class `settle`). The game screen passes the same
set for both; the puzzle passes only `fresh`. Animation restart: the settle class is keyed with a
`data-settle` counter per update so React re-applies it (a square only settles once anyway, since it
was empty before).
- **Settle** (≤ 250 ms, `ease-out`): the square scales from 0.6 and from a frost-white tint to its
  colour. No bounce (restrained in play).
- **Last-move mark**: an inset ring of 2 px in `--last-mark` (light: white at high opacity; dark:
  near-black), plus a small centred frost dot, so it reads on every seat colour and never replaces
  it. Static, so it survives reduced motion.

### D3. Tray: fitting at all times, frozen look, freeze animation
`usePlacement` computes `anywhere = fittingPieces(position, trayColour)` whenever the game runs and
the viewer has a tray colour, not only when `active`; selection stays gated on `active`. This is
safe off turn: only the colour's own moves create new corners, so a piece that fits nowhere now
cannot fit on the next own turn.
`PieceTray` gets a pure helper `newlyFrozen(prevFitting, nextFitting, colour)` result: pieces that
were fitting for **the same colour** and are no longer fitting and not placed. They get the `freeze`
animation (~300 ms: colour drains to the frost tone, a brief frost-white flash); a colour switch (the
tray changing colour in Tuplaväri) never animates. The frozen look: `--frost` fill with a 1 px
`--frost-edge` outline, no seat colour (replaces `opacity: 0.3`). Corner mode keeps its own dimming
(plain opacity), so "does not fit on this corner" and "lost for good" look different.
A placed piece's slot fades out (150 ms) instead of vanishing: the slot keeps its size, so nothing
shifts.

### D4. Illegal attempt shake, hint pulse
`usePlacement` exposes a `nudge` counter that increments on a refused placing attempt (tap or Enter
on an illegal preview, drop on an illegal spot) and a `hints.index` that already changes per press.
`Board` takes `shake?: number` and `pulse?: number`; a change of either re-keys a wrapper class on
the preview squares (`shake` 200 ms horizontal 3 px; `pulse` one 250 ms scale 1 → 1.06 → 1).

### D5. Player strip: turn mark and freeze
`PlayerStrip` takes `turnSeat` and marks that chip (`data-turn`): a 2 px underline bar in the seat's
colour. The bar animates with a transition on the chip (opacity + scaleX from the left) rather than
physically sliding between chips — the chips wrap on phones, so a shared sliding element would jump.
A chip whose seat went `out` gets `frozen` (frost overlay, the existing struck-through score); the
freeze animation runs only when `out` changes from false to true while mounted (previous value in a
ref).

### D6. End celebration
- **Only on a seen transition**: a hook `useEnded(finished)` returns true only when the client saw
  `finished` go from false to true. A reload or a spectator joining a finished game sees `true` at
  once, so no celebration and no count-up (satisfies "only once", no storage needed). The puzzle uses
  the same hook on its `solved` flag.
- **Count-up**: `useCountUp(target, ms = 900, run)`: `requestAnimationFrame` from 0 (or from the
  lowest negative score to the target — scores can be negative) with ease-out; with reduced motion or
  `run` false it returns the target at once. Aria stays on the final value (the table cell's visible
  number is `aria-hidden` during the count, the final value in an sr-only span).
- **Shimmer**: winners' rows get a one-shot frost gradient sweep (700 ms).
- **Snowfall**: a `Snowfall` component with ~24 absolutely positioned **square** flakes (Kuura:
  nothing round), CSS keyframes with randomised delay/drift from a seeded list, `pointer-events:
  none`, `position: fixed` over the screen (over the solved panel in the puzzle), removed after
  2.5 s. Shown when the viewer is among the winners or is a spectator; never on a game without a
  winner.
- Reduced motion: the global rule already stops keyframes; in addition the components check
  `matchMedia('(prefers-reduced-motion: reduce)')` and do not mount the snowfall or count up.

### D7. Tokens and theme
New tokens in `ui/tokens.css`, light and dark designed separately:
`--frost` (light: pale blue-white `#dfe7ef`; dark: cold slate `#2a3340`), `--frost-edge`
(light `#b9c6d4`; dark `#46546a`), `--last-mark` (light `rgba(255,255,255,.9)`; dark
`rgba(8,11,16,.85)`), `--snow` (light: `#9fb4cc` so it shows on the pale ground; dark `#e6ebf2`).
Durations as tokens: `--motion-fast: 150ms`, `--motion: 250ms`, `--motion-slow: 700ms`, so every
in-game motion stays ≤ 250 ms and the end is the only slow one.

### D8. Generic helpers
`client/src/motion/` holds `filledSince`, `useLastMove`, `useEnded`, `useCountUp`, `usePrevious`,
`prefersReducedMotion` and `Snowfall` without Palikka names; listed in `docs/template.md` as
candidates for the shared template.

## NFR

- **Tests** (client unit tests, per nfr.md): `filledSince` (add, several, remove, identical),
  `useLastMove` (first board, replace, undo clears, reset key), `newlyFrozen` (same colour, colour
  switch, placed piece), `useEnded` (seen transition vs. already finished), `useCountUp` (reduced
  motion and `run=false` return the target), `usePlacement` fitting off turn and the `nudge`
  counter. One render test: result table with count-up shows final values in accessible text. Look
  and feel via the Playwright MCP UI check (portrait, light and dark: last-move mark on each seat
  colour, frozen tray pieces, snowfall). No new E2E test.
- **Logging**: none needed (no new server events or errors).
- **Performance/size**: CSS only plus ~24 DOM nodes for the snowfall for 2.5 s; `size-limit`
  must pass unchanged. The board keeps one span per square; no per-frame JS in play (only the
  count-up at the end).
- **Accessibility**: reduced motion honoured (D6); the last-move mark does not rely on motion; the
  board's live region is unchanged.

## Risks / Trade-offs

- [Settle animation on a zoomed, transformed board looks off] → animate `transform: scale` on the
  square itself only (inside the grid cell), never the board.
- [Mark contrast on some seat colour in one theme] → the mark is a ring plus a dot in a neutral
  token; checked on all four seat colours in both themes during the UI check.
- [Off-turn `fittingPieces` costs CPU on every update] → it is already computed every own turn and is
  bitboard-fast; memoised on `position` and colour.
- [Several state patches for one move (board, then turn) re-trigger the settle] → the diff of an
  unchanged board is empty and keeps the mark, and a square only settles when it was empty before.
