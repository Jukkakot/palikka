# Proposal

## Why

Every game today is the same 20×20 board with one colour per player, so two players play a
half-empty board and three players leave a corner unused. The classic game has well-known variants
that fix exactly that, and they are the next roadmap item (#7): Duo on a small board for two, two
colours each for two players on the full board, and three players with a shared fourth colour.

## What Changes

- A game has a **variant**, chosen before it starts; the default is today's game:
  - **Perus** (classic): 20×20, 2–4 players, one colour each (unchanged, a three-player game keeps
    its empty corner).
  - **Duo**: 14×14, exactly 2 players, one colour each, start squares inside the board (row 5,
    column 5 and row 10, column 10 counted from 1) instead of corners.
  - **Tuplaväri** (two colours each): 20×20, exactly 2 players; the first plays Järvi and
    Puolukka, the second Lakka and Kuusi; a player's score is the sum of their two colours.
  - **Kolmikko** (three players): 20×20, exactly 3 players with one colour each; the fourth
    colour, Kuusi, is shared: the players play its turns in rotation, and its score counts for no
    one.
- **BREAKING (internal)**: a seat is no longer always its colour. The rules gain the variant
  definitions and a match layer where each colour has a controlling seat (or rotates, when shared);
  results and winners are per player (seat), scored over the colours the player owns.
- Online: the host picks the variant in the waiting room; the seat count follows the variant (bots
  on seats beyond it are removed, more people than it allows refuse the switch). A rematch keeps
  the variant; the start screen's game list shows it.
- On the device: the bot way of the start screen gets a variant choice; fixed-size variants set the
  number of bots themselves. Watching bots works for every variant.
- Playing several colours: the turn line names the colour on turn and who plays it; the tray shows
  the pieces of the colour the viewer plays now (or next). Undo, hint, autoplay and kicking follow
  the controlling seat.
- Bots play teams and the shared colour: a bot's evaluation scores its whole side, search does not
  treat a partner colour as an opponent, and a shared-colour move is chosen for the player whose
  turn it is to play it.
- The result table ranks players (sides) with their colours, and shows the shared colour as not
  counted.
- The rules page gets a short section on the variants.

Workspaces touched: `packages/rules`, `packages/protocol`, `packages/bots` (a small generic
extension), `packages/palikka-bots`, `server`, `client`.

## Capabilities

### New Capabilities

- `variants`: the variants' boards and start squares, which seat plays which colours, the shared
  colour's rotation, scoring and winners per player, and leaving in multi-colour games.

### Modified Capabilities

- `game-end-and-scoring`: the result and leaving are decided per player (a player's colours
  together); one colour per player stays exactly as today.
- `game-room`: seats and the start depend on the variant; the host chooses it; the player on turn is
  the one who plays the colour on turn.
- `bot-seats`: a bot move is validated against the seat that plays the colour on turn.
- `bot-play`: bots play for their side and play a shared colour.
- `device-games`: games against bots and watched bot games take a variant.
- `start-screen`: the bot way offers the variant; listed games show it.
- `piece-controls`: the tray shows the colour the player plays now or next.
- `result-screen`: rows per player with their colours; the shared colour is not counted.
- `how-to-play`: the rules page explains the variants.

## Impact

- Rules: new variant module, `Position` gains colour → side mapping, `Game` gains the variant and
  colour control; `winners` per side. Existing classic behaviour and tests stay green.
- Protocol: `setVariant` command and code(s), variant ids, listing metadata field.
- Server: `GameState` gains `variant`, `turnColour` and per-colour seat; seat logic uses the variant.
- Client: start screen, waiting room, turn line, tray, board size, result table, local game save
  format (older saves dropped), bot calls with the side's viewpoint.
- Bots: optional opponent predicate in the `game-bots` search interface; Palikka's evaluation per
  side; a Duo tournament format.
- Docs: architecture (rules, state sync, game flow), product.md, roadmap.
