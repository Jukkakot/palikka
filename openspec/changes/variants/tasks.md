# Tasks

## 1. Rules: variants, sides and colour control

- [x] 1.1 Add `variants.ts` (`VariantId`, `VARIANTS`, `DUO` board, colour groups, shared colour) and
  export it; tests for each variant's board, start squares, player counts and colour groups (spec
  `variants` → Variants, Duo board) pass
- [x] 1.2 `Position.sides` with the classic default in `newPosition`; `sideScores` and side-based
  `winners` in `scoring.ts`; existing scoring tests unchanged and new tests for "Tuplaväri score" and
  "Shared colour does not count" pass
- [x] 1.3 `Game.variant`, `Game.control`, `startGame(seed, seats, variant)`, `controllerOf`,
  `seatOnTurn`; `playMove` checks the controlling seat and `removeSeat` resigns all of a seat's
  colours; winners are seats; tests for every `variants` scenario (seats with a gap, wrong count,
  rotation, rotation after a leaver, Tuplaväri and Kolmikko leavers) and the modified
  `game-end-and-scoring` scenarios pass
- [x] 1.4 Property test: random games in all four variants stay legal against the reference
  generator and end with winners among the staying seats; bump `RULES_VERSION` to 1.1.0;
  `npm test -w @palikka/rules` and the rules benchmark still run

## 2. Bots: sides and the shared colour

- [x] 2.1 `game-bots`: optional `opponents(state, player)` in `MultiplayerGame`, used by BRS reply
  layers; a library test with a toy game shows a non-opponent is never searched as a reply
- [x] 2.2 `@palikka/bots`: `palikkaGame.opponents` by side, side-aware `evaluate`; test "Partner
  colour is not an opponent" and classic evaluation tests unchanged
- [x] 2.3 `chooseMove(..., viewpoint?)` for the shared colour (one ply for the viewpoint's side,
  seeded); tests "Shared colour for its player" and "Duo" (two bots finish a Duo game)
- [x] 2.4 Tournament `duo` format (`FORMATS` keyed by `2 | 4 | "duo"`, CLI `--colours duo`); a short
  run `npm run tournament -w @palikka/bots -- --colours duo --games 4 greedy random` finishes and the
  tournament tests pass; `strength.json` unchanged

## 3. Protocol and server room

- [x] 3.1 Protocol: `VARIANT_IDS`, `setVariant` payload schema, `TOO_MANY_PLAYERS` code, listing
  metadata `variant`; protocol tests pass
- [x] 3.2 `GameState`: `variant`, `turnColour`, `ColourState.seat`; `cells` sized by the board; the
  room mirrors the rules' `Game` (turn seat from `seatOnTurn`)
- [x] 3.3 `setVariant` command (host, waiting, `TOO_MANY_PLAYERS`, bots above the max removed, seat
  capacity and metadata updated); start refuses below `minPlayers`; rematch keeps the variant; room
  tests for every `game-room` "Choosing the variant" scenario and "Kolmikko needs three" pass
- [x] 3.4 Moves, bot moves and fallback by controlling seat; room tests "Second colour", "Shared
  colour's turn", "Bot plays the shared colour", Tuplaväri leaver ends the game, and logs carry
  `variant` / `colour`; `npm test -w server` passes

## 4. Client

- [x] 4.1 View model: `variant`, `boardSize`, `turnColour`, seat colours, viewer's colours, tray
  colour rule, result rows per side with the shared row; view model tests for Tuplaväri, Kolmikko
  and classic (unchanged) pass
- [x] 4.2 Board, tray, turn line and result table read the view model (14×14 board renders; shared
  colour label); `ResultTable` and `TurnLine` tests updated
- [x] 4.3 Waiting room variant picker for the host (others see the variant; seats up to the max)
  and `useGameSession.setVariant` with `errors.TOO_MANY_PLAYERS` in fi/en; a render test for the
  host's picker
- [x] 4.4 Start screen: variant chips in the bot way, bot count only in Perus, lobby rows show the
  variant; render test "Duo against a bot" passes
- [x] 4.5 `LocalRoom` and the local save: variant in ids and saves, save format bumped, bots and
  undo by controlling seat, bot viewpoint for the shared colour; LocalRoom tests "Tuplaväri on the
  device", "Undo in Tuplaväri", a Kolmikko game with two bots runs to the end; `useBotRunner` and
  the hint pass the viewpoint (tests updated)
- [x] 4.6 "Näin pelaat" variants section (fi/en, locale parity test passes); render test shows the
  section
- [x] 4.7 UI check (Playwright `playwright-mobile`, portrait, light and dark): start screen variant
  chips, a Duo game on the device, a Tuplaväri turn on colour 3 and its result table, the waiting
  room picker; screenshots under `.playwright-mcp/`

## 5. Docs and wrap-up

- [x] 5.1 Wiki: `docs/architecture.md` (rules package variants and sides, match layer control, state
  sync fields, game flow `setVariant`, bots' sides and shared colour, client variant picker);
  `openspec/context/product.md` (variants decided, names); roadmap item 7 marked done
- [x] 5.2 Check chain passes: `npm run lint && npm run typecheck && npm test && npm run build && npm
  run size -w @palikka/client`
