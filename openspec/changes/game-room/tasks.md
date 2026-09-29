# Tasks

## 1. Rules: match layer, leaving, simple bot; placeholder removed

- [x] 1.1 Add `resign(position, colour)` to `play.ts` and the match layer in `game.ts` (`startGame`, `playMove`, `removeSeat`, `endGame`, winners among colours that did not leave); tests named after the `game-end-and-scoring` delta scenarios and the room's start/turn scenarios pass (`npm test -w @palikka/rules`)
- [x] 1.2 Rewrite `bot.ts` as `simpleBotMove` + `botRng` (largest piece first, seeded); tests: always legal, always a largest piece, deterministic per seed
- [x] 1.3 Delete `board.ts`, `daily.ts`, the placeholder parts of `testing.ts` and their tests; `TURN_TIME_LIMIT_SECONDS` = 120; rules tests and typecheck pass

## 2. Protocol

- [x] 2.1 Placement payload for `place`, new `botPlace` payload, piece constants mirrored, error codes updated, `client.daily.*` removed; protocol tests cover the payload bounds (`npm test -w @palikka/protocol`)

## 3. Server room on the real rules

- [x] 3.1 Synced schema: `colours` (pieces, out, left), `winners`, `botRunnerSeat`; `Player.placed` removed
- [x] 3.2 `GameRoom` on the match layer: start (lowest seat first), `place`, leaving/kick/timeout via `removeSeat`, finish with winners, 120 s clock; room tests (move accepted and seen, refusal codes, stuck colour shown out, leaving, result) pass
- [x] 3.3 Bot runner selection, `botPlace` command with its rejection order, server fallback timers (`noRunner`, `runnerSilent`) and logs; room tests for runner changes, `botPlace` rejections and both fallbacks pass
- [x] 3.4 Update the remaining server tests (autoplay, spectators, rematch, lobby, turn rules) to the real moves; `npm test -w @palikka/server` passes

## 4. Client: engine view, bots, device games, interim control

- [x] 4.1 Bot interface, Palikka adapter, module worker and worker client (in-thread fallback); unit test of the adapter and the in-thread path
- [x] 4.2 View model builds `position`, scores, squares, out, winners, runner seat; view-model tests pass
- [x] 4.3 `LocalRoom` on the match layer with async bots, undo history, new save format (old saves dropped); daily puzzle removed from session, store and start screen; `localRoom` tests (bots answer, undo, saving, old save dropped, watch game) pass
- [x] 4.4 `useBotRunner` in the session (runner computes and sends `botPlace` after the pause, drops stale results); session test with a fake room passes
- [x] 4.5 Interim control (`interimMoves`), board with tappable corner squares, hint as squares, undo button for device games, result line with shared wins, texts fi/en (errors, turn, tips, rules screen); screen tests and locale parity pass; `npm run build -w @palikka/client` and `npm run size -w @palikka/client` pass (worker with its own budget)

## 5. E2E, docs, final checks

- [x] 5.1 Update `e2e/tests/smoke.spec.ts` and `e2e/tests/prod.spec.ts` to the corner tap and the new texts (not run here: no dev servers in this job)
- [ ] 5.2 Update `docs/architecture.md` (Overview bots, Game flow, State sync, Rules package, Client) and any other wiki page the change affects, short
- [ ] 5.3 `npm run lint`, `npm run typecheck`, touched workspaces' tests and the client build pass; decisions recorded in design.md
