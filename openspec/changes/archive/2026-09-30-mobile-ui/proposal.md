# Proposal

## Why

Palikka is mobile first (Android primary), but the 20×20 board is small on a phone: a square is
about 17 px wide, so aiming by tapping takes precision. The piece controls were built for the mouse
first (`basic-ui`). The product ideas for the phone have been waiting since the start
(product.md → Mobile ideas, roadmap #9). This change makes placing on a phone fast and hard to get
wrong.

## What Changes

- **Corner first**: with no piece chosen, tapping one of your free corners (the dots) narrows the
  tray to the pieces that can cover that corner. Choosing one shows its first legal spot there.
  "‹" and "›" then step through only the legal spots of that piece on that corner ("3/7"). Tapping
  the preview or "Aseta" places it. This runs alongside the current flow (piece first, then aim).
  Both always work, and neither is the default.
- **Drag with snap**: a piece can be dragged from the tray onto the board, and a preview on the
  board can be dragged to move it. While dragging, the piece is drawn above the finger so the finger
  does not hide it, and it snaps to the nearest legal spot of its orientation. Letting go leaves it
  as the preview; it is placed only by a tap inside it or "Aseta" (no accidental moves).
- **Board turned to you (phone)**: in the stacked phone layout, a seated player sees the board turned
  so their own start corner (Duo: start square) is at the bottom-left. Only the view turns: the tray,
  "Käännä" and "Peilaa" work as seen on screen. Wide layouts and spectators see the board unturned.
- **Zoom to your corners (phone)**: on the player's turn in the phone layout, the board zooms to the
  area around their free corners (never fewer than 10×10 squares). It zooms back out to the whole
  board off turn. A "Koko lauta" / "Lähennä" toggle turns the zoom off and on for the device.
- **Hint top 3**: "Vihje" shows the bot's best move as the preview (as now). Pressing it again steps
  to the second and third best, shown as "Vihje 2/3".
- **Duo first on a phone**: on a phone, the bot way's variant starts at Duo until the player picks a
  variant; the last picked variant is remembered on the device.
- **TV mode is dropped** from the plans (the user's decision, 2026-09-30).

Workspaces touched: `packages/bots` (a generic top-N move ranking), `packages/palikka-bots` (the
hint's top 3), `client`. Rules, protocol and server are not touched.

**Depends on `variants`** (Duo, the variant choice on the start screen, the colour the viewer plays
now). Implement after `variants` is archived.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `piece-controls`: corner-first choosing, dragging, the turned board and the zoom on a phone, and
  the hint's top 3.
- `start-screen`: Duo first on a phone, the last variant remembered.

## Non-Goals

- TV mode (dropped).
- Pinch zoom and free panning (the automatic zoom plus the toggle is enough for now).
- Haptics, sounds for dragging, and landscape-phone-specific layouts beyond what the current wide
  layout does.
- Changes to the rules, the server or the online protocol.
