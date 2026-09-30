# Design

## Context

See proposal.md for the why. Today the rules are already board-parametric (`BoardConfig` with size
and start squares, bitboards up to 32 wide, move codes per size), but everything above the engine
assumes **seat = colour**: `Game.seats[].seat` is the colour, `Game.winners` are colours,
`GameState.turnSeat` doubles as the colour on turn, `botPlace { seat }`, the client's `GameView`,
the tray (the viewer's colour), `ResultTable` (one row per colour) and the bots' evaluation (own
colour vs. every other colour). The variants break that assumption in two ways: a seat can play
two colours (Tuplaväri) and a colour can be played by different seats in turn (Kolmikko).

## Goals / Non-Goals

**Goals:**

- One place (the rules) defines each variant; server, device games and bots only read it.
- Classic (Perus) behaves and scores exactly as today; existing rules, room and client tests stay
  green with at most mechanical updates (seat vs. colour naming).
- Bots are sensible in every variant (side-aware evaluation, no partner treated as an opponent),
  within the same time budget.

**Non-Goals:**

- New strength requirements per variant (a Duo tournament format is added for measuring only).
- Duo as the phone default, own start corner at the bottom, zoom (roadmap `mobile-ui`).
- Other official variants (Junior, 3-player-with-empty-corner as its own variant, team play of 4
  people as 2 teams). Perus with 3 players stays as today (empty corner).
- Changing the online turn clock per colour: the 120 s clock runs per turn, whoever plays it.

## Decisions

### D1. Variant ids, names and definitions live in `packages/rules`

`variants.ts` exports `VariantId = "classic" | "duo" | "double" | "trio"` and `VARIANTS: Record<VariantId,
Variant>` with `{ board: BoardConfig; minPlayers; maxPlayers; colourGroups(n): number[][]; shared?: number }`.
`colourGroups(n)` gives the colours of the 1st…n-th seated player (classic: `[[seat]]` is special:
classic uses the seat numbers themselves, so gaps like seats 1, 2, 4 keep colours 1, 2, 4 as today).
New board `DUO: BoardConfig = { size: 14, starts: { 1: {row: 4, col: 4}, 2: {row: 9, col: 9} } }`.

UI names (fi / en): Perus / Classic, Duo / Duo, Tuplaväri / Double, Kolmikko / Trio. Ids are English
and stable; names only in i18n. *Alternative:* name the ids after the Finnish names — rejected
(English identifiers rule).

### D2. `Position` gets `sides`; scoring and winners per side stay in the engine

`Position.sides: Readonly<Record<number, number>>` maps each colour to its side (a side = the seat
that owns the colour; `0` = shared, scores for no one). `newPosition(config, colours, first, sides?)`
defaults to `side = colour`, so classic positions are unchanged in meaning. New
`sideScores(position)` sums colour scores per side (shared excluded); `winners(position)` returns
winning **sides**. Classic: sides = colours, so `winners` returns the same numbers as today.

Why in `Position` and not only in `Game`: the bots receive only a `Position` in the worker (plain
JSON) and must evaluate per side; keeping sides in the position keeps `chooseMove`'s signature
small and the worker message unchanged in shape. *Alternative:* pass a side map next to the
position to every bot call — rejected, easy to forget and duplicates the game layer.

### D3. The match layer maps colours to seats

`Game` gains `variant: VariantId` and `control: Readonly<Record<number, number>>` (colour → seat; the
shared colour maps to `0`). `startGame(seed, seats, variant = "classic")` validates the player count
(`NOT_ENOUGH_PLAYERS` / `TOO_MANY_PLAYERS` as a thrown `RangeError` in rules; the room checks first
and answers with the code), builds colours, `control` and `sides`, and colour 1 (classic: lowest
colour) starts.

`controllerOf(game, colour)`: `control[colour]`, or for the shared colour the rotation from the
spec: `staying[placed[shared].length % staying.length]`, `staying` = seats not in `left`, ascending.
`seatOnTurn(game)` = `controllerOf(game, position.turn)` (0 when ended). `playMove(game, seat, move)`
checks `seat === seatOnTurn(game)` (`NOT_YOUR_TURN`) and plays `position.turn`'s colour. The
rotation is computed from the position, so nothing extra is saved or synced. *Alternative:* count
shared turns in a separate counter — rejected, `placed[shared].length` is exactly that count (a
shared colour never passes a turn while it can move; once stuck it is out).

`removeSeat(game, seat)` resigns every colour in `control` owned by that seat; "last one standing"
counts seats, as the spec says. `Game.winners` becomes seats (= sides): `withResult` takes
`sideScores` among sides not in `left`. Classic: seat = colour, identical numbers.

### D4. Protocol and room

- `VARIANT_IDS` in `game-codes.ts`; command `setVariant { variant }` (schema in `game-schema.ts`);
  new error code `TOO_MANY_PLAYERS`. Join options stay strict and unchanged: a game is created as
  classic and the host switches in the waiting room. Rematch copies the variant.
- `GameState` gains `variant` (string, default `"classic"`) and `turnColour` (uint8); `turnSeat`
  keeps meaning **the seat that plays the turn** (so kick, autoplay, bot runner, clock and
  `NOT_YOUR_TURN` keep working on seats). `ColourState` gains `seat` (0 = shared). `cells` length
  follows the board size.
- Seat capacity: `maxClients` in the waiting room becomes `VARIANTS[v].maxPlayers - bots`; the free
  seat search looks in `1..maxPlayers`. `setVariant` removes bots on seats above the new max, refuses
  when people sit there (`TOO_MANY_PLAYERS`), and updates the metadata (`variant`), which the lobby
  listing shows.
- Start: `NOT_ENOUGH_PLAYERS` when fewer than `minPlayers` (classic 2).
- `botPlace { seat }` unchanged: accepted when `seat === turnSeat` and bot-played. The fallback plays
  `simpleBotMove` for `turnColour`.
- Logs: `setVariant` gets the normal `cmd.accepted`/`cmd.rejected` audit line; `phase.changed` to
  `play` carries `variant`; `turn` logs carry `colour` next to `seat`.

### D5. Client

- `SyncedState`/`GameView` gain `variant`, `boardSize`, `turnColour`, per-seat `colours`, and
  `myColours` (all colours the viewer plays, plus the shared colour when it is their turn). The
  board reads the size from the view.
- Tray colour (spec): the turn colour when the viewer plays it now, else the first of the viewer's
  own colours after the turn colour in turn order that is not out; falls back to their first colour.
- Turn line: "Puolukka · Aino" for a normal turn; for the shared colour "Kuusi (yhteinen) · Aino".
- Waiting room: the host gets a variant picker (four chips, one line of description under it);
  others see the chosen variant as text. Seats shown only up to the variant's max.
- Start screen bot way: a variant chip row above the bot count; the count row is shown only in
  Perus. Device ids and saves carry the variant. The local save format version is bumped (old saves
  dropped, per the existing requirement).
- Result table rows from the rules' side scores: one row per seat with its colour marks; a shared
  colour row after them, "ei lasketa".
- Hint: greedy for the turn colour from the viewer's side (D6).

### D6. Bots

- `game-bots` `MultiplayerGame` gains an optional `opponents?(state, player): readonly P[]`; BRS
  uses it for its reply layers when present (else `players(state)` minus root, as today). MCTS is
  unchanged: max^n with a side-aware evaluation already makes partners cooperate. Generic, no
  Palikka names.
- `palikkaGame.opponents` = active colours whose side differs from the player's side (the shared
  colour counts as an opponent of everyone: most of its turns are played by someone else).
- `evaluate(position, colour)` rates for `colour`'s side: score = the side's score, corner and area
  terms = sum over the side's active colours minus the average over opposing active colours;
  result term by `winners` (sides).
- The shared colour: `chooseMove(position, colour, budget, rng, bot, viewpoint?)`. When `colour` is
  shared (side 0), the bot chooses among the shared colour's moves the one maximising
  `evaluate(next, viewpointColour)` one ply deep (greedy, seeded tie-break), where `viewpoint` is a
  colour of the seat that plays this turn. *Alternative:* full search for the shared colour —
  rejected for now: whose side the shared colour plays for changes every turn, which breaks the
  search's assumption that a player keeps its goal. One ply is honest and cheap; measured later if
  wanted.
- Callers (LocalRoom, `useBotRunner`, hint) pass the viewpoint colour from `controllerOf`.
- Tournament: a `duo` format (Duo board, colours 1 and 2; `FORMATS` keyed `2 | 4 | "duo"`, CLI `--colours duo`) so Duo strength can be measured with the
  existing CLI; no new entry in `strength.json`.

### D7. Tests (nfr → Testing)

- Rules: one test per `variants` spec scenario (variant starts, Duo start squares and edges,
  rotation incl. leaver, side scores and winners, leaving); a fast-check property: random games in
  every variant keep the colour count, sides and legality (existing reference generator on the Duo
  board).
- Bots: partner not searched as an opponent (a spy on `movesOf` or a crafted position), shared-colour
  move legal and chosen for the viewpoint, a Duo bot-vs-bot game ends.
- Server: room tests for `setVariant` (host only, waiting only, `TOO_MANY_PLAYERS`, bots removed,
  metadata), start count, Tuplaväri move in colour 3 by seat 1, shared-colour `NOT_YOUR_TURN`,
  leaver in Tuplaväri ends the game, rematch keeps the variant.
- Client: view model (turn colour, tray colour, result rows per side, shared row), LocalRoom
  (Tuplaväri undo, Kolmikko bot turns), start screen render test (Duo hides the bot count).
- E2E smoke test unchanged (classic critical path); UI check of the variant picker, Duo board and a
  Tuplaväri result in light and dark.

### D8. Performance and limits

Move generation is per colour and unchanged; the side-aware evaluation loops over a side's colours
(at most two), so its cost stays within today's. The Duo board is smaller, so bots search deeper in
the same 800 ms. No new limits; `setVariant` goes through the same command wrapper (zod, audit).

## Risks / Trade-offs

- [Seat vs. colour confusion in hot files (`GameRoom.ts`, `viewModel.ts`, `localRoom.ts`)] → rename
  the ambiguous fields (`turnColour` next to `turnSeat`), keep classic tests green after each step,
  and route every "who plays now" question through the rules' `seatOnTurn`/`controllerOf`.
- [Shared-colour bot plays only one ply] → accepted; its moves matter less than own moves, and the
  choice is recorded here for a later tournament.
- [`winners` switching from colours to sides] → identical in classic; bots' `evaluate` and the
  room/client read sides by name after this change.
- [A 3-person Perus game and Kolmikko look alike in the lobby] → the listing shows the variant.

## Migration Plan

No server data persists. Device saves of the old format are dropped (existing behaviour). An old
client (cached PWA) joining a non-classic room could mis-render it; the PWA's auto-update service
worker replaces it on the next load, so this is accepted (no version handshake is added). Bump
`RULES_VERSION` to 1.1.0 (shown in the start screen footer and `/health`).

## Decisions made during implementation

- **Join options gain `variant?`** (deviation from D4's "unchanged"): a rematch is created through
  `matchMaker.createRoom` with join options, so it passes the finished game's variant there (strict
  schema, one of `VARIANT_IDS`). A client never sends it; new rooms are still Perus.
- **`startGame(seed, seats, variant, board?)`**: the optional `board` override exists only for
  rules tests (the tiny 3×3 board); the room and `LocalRoom` never pass it.
- **`setVariant` refusal**: `TOO_MANY_PLAYERS` also when a person sits in a seat above the new
  maximum (seats are not renumbered) or joins are pending beyond it. `addBot` on a seat above the
  variant's maximum answers `SEAT_TAKEN` (no new code). A new log event `variant.changed`.
- **Device ids unchanged**: the variant lives in the saved `Game`; the "save format bump" is the
  load check requiring `variant`, `control` and `sides` (older saves dropped).
- **Tournament `4` format keeps one side per colour** (partners not told they are a team), so
  existing strength measurements stay comparable; only `duo` is new.
- **Turn line names the colour only in Tuplaväri and Kolmikko** ("Puolukka · …",
  "Kuusi (yhteinen) · …"); Perus and Duo keep the plain text. Colour names are the same in English.
- **`errors.NOT_ENOUGH_PLAYERS`** reads "Pelaajia ei ole vielä tarpeeksi" (Kolmikko needs 3); the
  waiting room hint says "Tarvitaan 3 pelaajaa" there.
- **Phone layout** (UI check): the variant picker is 2×2 on a phone (four in a row from 26rem of
  width); a Tuplaväri player's two colour marks stack in the result table, result names end in an
  ellipsis after 5.5em (as in the player strip), and the game layout's column never grows past the
  screen (`minmax(0, 1fr)`), so the table and the strip fit 360 px.

## Open Questions

- None blocking. Whether the shared colour deserves a full search, and Duo strength numbers, are
  measured later with the tournament CLI.
