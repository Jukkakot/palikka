# Tasks

## 1. Rules: orientation stepping and fitting pieces

- [ ] 1.1 Add `turnOrientation` / `mirrorOrientation` (tables built at load) to `packages/rules/src/pieces.ts`; tests named after the `pieces` scenarios (four turns, mirror twice, plus-shaped) pass and the golden orientation snapshot is unchanged
- [ ] 1.2 Add `fittingPieces(position, colour)` to `movegen.ts`; unit test on the first move (X5 does not fit the corner, I5 does) and a fast-check property that it equals the pieces of `legalMoves` along random games; `npm test -w @palikka/rules` passes

## 2. Client: placement model

- [ ] 2.1 `client/src/game/placing.ts`: reference square, legal moves grouped by piece/orientation (memoised per position), `previewAt` (snap, fallback with the rules' reason, exact with clamping), `hintMove`; unit tests for the `piece-controls` preview scenarios ("Snap to a legal spot", "No legal spot") and clamping; remove `interimMoves.ts` and its test
- [ ] 2.2 `usePlacement(view)` hook: choose/clear, turn, mirror, point (snap), move by arrows (exact), hint, reset on a new turn or an accepted move, keep on refusal; hook tests cover "Four turns", "Not my turn", reset on turn change

## 3. Client: board, tray and controls

- [ ] 3.1 `Board`: pointer hover (mouse), click rule (inside a legal preview → place, else move the preview), keyboard (arrows, Enter/Space), free-corner dots, legal/illegal preview styles with new Kuura tokens in light and dark, live region; drop the button cells and the hint ring
- [ ] 3.2 `PieceShape` and `PieceTray` (21 stable slots, placed = empty, dimmed not-fitting pieces, aria-pressed, labels) and the new `PlaceControls` bar (status/reason line, Käännä, Peilaa, Aseta, Vihje, Peru); R/F/Escape on the game screen
- [ ] 3.3 Wire it in `GameScreen` with the phone and wide layouts (`GameScreen.module.css`); render tests: choosing a piece, a tap and "Aseta" send `place` with the preview's move; an illegal preview sends nothing
- [ ] 3.4 Texts fi/en (turn line, place bar, tray labels, reasons reuse `errors.*`), first-game tips for the tray; locale parity test passes

## 4. Client: result screen

- [ ] 4.1 `viewModel`: `piecesLeft` on seats and `results` rows (rank with shared ranks, winner, left colours without a player); unit tests for "Ranked rows", "Shared rank", "Leaver"
- [ ] 4.2 `ResultTable` under the winner line in a finished game, tray and bar hidden; one render test for the table

## 5. Client: start screen and rules page

- [ ] 5.1 Connector `create` and `useGameSession.createGame`; remove quick play `play`; session test: `createGame` creates (never joins) and waits for the wake-up
- [ ] 5.2 Start screen: the two cards ("Pelaa botteja vastaan" with counts and "Pelaan itse", "Luo peli kavereille" with the wake status), the secondary "Liity peliin" section only when non-empty; update `screens.test.tsx` for the two ways and the hidden empty section
- [ ] 5.3 "Näin pelaat": `RulePicture` mini boards (start corner, corner contact allowed, edge contact not allowed) and the placement and scoring sections, fi/en; `HowToPlay.test.tsx` checks the three captions

## 6. E2E, UI check, docs

- [ ] 6.1 E2E: helpers create a game (host) and join by the invite link (guest); smoke and production smoke place I5 on the start corner through the tray (tap the piece, tap square 0 twice) and check the sync; `npm run e2e` passes against the local dev servers
- [ ] 6.2 UI check (Galaxy S24 portrait, light and dark; wide desktop once): start screen, a game against bots through several moves including an illegal preview and the hint, the end table; screenshots under `.playwright-mcp/`
- [ ] 6.3 Wiki: `docs/architecture.md` (client: piece controls instead of the interim control, results, start screen, rules additions), `docs/development.md` if the E2E helpers or checks changed; `openspec/context/product.md` start-screen note (list kept as secondary); mark `basic-ui` done in `openspec/context/roadmap.md`
- [ ] 6.4 Check chain passes: `npm run lint && npm run typecheck && npm test && npm run build && npm run size -w @palikka/client`
