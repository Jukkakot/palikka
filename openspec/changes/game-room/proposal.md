# Proposal

## Why

The real rules engine exists (`rules-engine`) but nothing plays it: the server room and the games on
the device still run the placeholder "claim a cell" game. This change puts every game on the real
rules, moves bot computation to the host's browser as the product decided (the server only
validates), and deletes the placeholder, so `basic-ui` and the bot changes build on the real game.

## What Changes

- **BREAKING** The server room and the games on the device play the real rules: a move is a piece
  in an orientation at a position, validated by the rules engine; stuck colours are passed
  automatically; the game ends when no colour can move; scores and shared wins follow the rules.
- **BREAKING** Command `place` carries a placement (piece, orientation, row, col) instead of a cell;
  new rejection codes for refused placements; `CELL_TAKEN` goes.
- Turn time limit online 120 s (was 60 s); kicking after the limit stays as it is.
- Bots on empty seats (and auto-played seats) online: the host's browser (another person's when the
  host is gone) computes their moves in a Web Worker and sends them with a new command; the server
  validates them like any move. The server plays a simple fallback move only when no person can
  compute or the computing browser does not answer in time.
- A small game-independent bot interface for the worker (state + player + budget → move), with a
  trivial bot (largest piece first) from `packages/rules` until the bot library arrives.
- Games on the device (against bots, watching bots) run on the real rules; their bots go through
  the same worker. "Peru" (undo) takes back the player's own last move and the bots' moves after it.
- Interim move control until `basic-ui`: on the player's turn the free corner squares where a piece
  fits are tappable; a tap places the largest piece that fits there. The board, scores and results
  show the real game.
- **BREAKING** The placeholder daily puzzle is removed (entry hidden) until `daily-puzzle`; saved
  games of the placeholder on devices are dropped.
- The placeholder engine (`board`, `game`, `bot`, `daily`) is deleted from `packages/rules`.

## Capabilities

### New Capabilities

- `game-room`: an online game on the server: seats, start, turns and the time limit, moves and their
  rejection, leaving and kicking, the end and the result, what every client sees.
- `bot-seats`: bots in online games: computed by a player's browser, validated by the server, with
  the server's fallback; the bot interface and auto-play of a person's seat.
- `device-games`: games against bots and bot-only games that run on the device: same rules, bots,
  saving and continuing, undo, the interim move control.

### Modified Capabilities

- `game-end-and-scoring`: adds a colour leaving a running game (its squares stay, it is out and not
  in the result; the last colour standing wins).

## Impact

Workspaces: `packages/rules` (match layer, leaving, simple bot; placeholder removed),
`packages/protocol` (payloads, codes, log events), `server` (room rewired, bot runner and
fallback), `client` (view model, device games, bot worker, interim control, undo, daily puzzle
removed), `e2e` (flows updated). No new dependencies. Adds a bot Web Worker chunk to the client
build.
