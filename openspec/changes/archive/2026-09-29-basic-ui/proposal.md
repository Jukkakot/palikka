# Proposal

## Why

The game runs on the real rules, but a player still cannot choose a piece: the interim control
places "the largest piece that fits" on a tapped corner square, the 17 px corner squares are hard to
hit on a phone, and the end of the game shows only the winner. `basic-ui` makes Palikka a real game
to play on a desktop and usable on a phone, and trims the start screen to the two ways in the
product wants.

## What Changes

- **Piece tray:** the viewer's 21 pieces under (phone) or beside (wide screen) the board, drawn in
  their colour; placed pieces leave an empty slot, pieces that fit nowhere now are dimmed.
- **Choose, turn and flip:** on the own turn a tap picks a piece; "Käännä" (quarter turn clockwise)
  and "Peilaa" (mirror) change its orientation, also with the keys R and F.
- **Placing with a preview:** pointing at or tapping a board square shows the chosen piece there as a
  preview, snapped to a legal spot covering that square when one exists; an illegal preview says
  why. A second tap inside a legal preview, a mouse click, Enter or "Aseta" places it. Arrow keys
  move the preview on a keyboard.
- **Hint** ("Vihje") now picks the bot's move into the preview (piece, orientation and spot) instead
  of only ringing squares, so the player can place it or change it.
- **End of game:** a result table (rank, colour, name, score, squares on the board, pieces left) and
  the winner line; "Pelaa uudelleen" and "Alkuun" stay.
- **Start screen:** two equal ways in, "Pelaa botteja vastaan" (1–3 bots, or watch 2–4 bots) and
  "Luo peli kavereille" (always a new game with an invite link). The open and running games lists
  stay as a secondary section, shown only when there is something in them. **BREAKING (UI):** the
  quick-play "Pelaa" button, which joined any open game, goes away.
- **Rules page pictures:** "Näin pelaat" gets small board pictures of the start corner, corner
  contact (allowed) and edge contact (not allowed).
- **Removed:** the interim corner-tap control (`game-room` requirement "Interim move control").

Workspaces: `packages/rules` (orientation stepping, pieces that fit), `client` (all screens), `e2e`
(smoke tests move with the new controls). The server and the protocol do not change.

## Capabilities

### New Capabilities
- `piece-controls`: the piece tray, choosing, turning and flipping a piece, the placement preview
  with snapping and the refusal reason, placing by tap, click or keyboard, and the hint as a
  preview.
- `result-screen`: what a finished game shows: the ranked result table and the ways on.
- `start-screen`: the two ways in (bots, a game for friends), the secondary open and running games,
  the nickname.
- `how-to-play`: the rules page with pictures.

### Modified Capabilities
- `pieces`: turning and mirroring step from one orientation of a piece to another.
- `game-room`: the interim move control is removed.

## Impact

- `packages/rules`: `pieces.ts` (orientation stepping), `movegen.ts` (pieces that fit); tests.
- `client`: `game/` (tray, preview, board input, results), `screens/GameScreen.tsx`,
  `screens/StartScreen.tsx`, `session/useGameSession.ts` (create a game), `session/viewModel.ts`
  (pieces left), `howto/`, i18n fi/en, tips; `game/interimMoves.ts` goes.
- `e2e`: smoke and production smoke place a piece through the tray; the smoke's host creates the
  game and the guest joins by the invite link.
- Bundle size: no new dependencies; stays within the 200 kB budget.
