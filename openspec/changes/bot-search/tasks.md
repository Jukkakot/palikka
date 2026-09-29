# Tasks

## 1. Rules helper (`packages/rules`)

- [ ] 1.1 Add `withTurn(position, colour)` (same position with `turn` set, cached bit view carried over) and export it; verify with a unit test that moves generated and applied through it match `legalMoves`/`applyMove` on a position where that colour is on turn, and that the view is not rebuilt (same view object)

## 2. Library interface and best-reply search (`packages/bots`)

- [ ] 2.1 `Budget.iterations`; `checkBudget` accepts any non-empty combination and refuses non-positive or non-integer values; greedy ignores iterations; verify with tests incl. "Limit that does not apply" (greedy with `{ iterations: 300 }` = greedy with `{ depth: 1 }`)
- [ ] 2.2 Add `MultiplayerGame` (`players`, `movesOf`, `playAs`, `moveKey`) and a small deterministic toy multi-player game under `src/search/testing/` (three players, a move greedy likes that a best reply punishes, a player that goes out)
- [ ] 2.3 Add `bestReplyBot` in `src/search/brs.ts`: depth-1 greedy pass (same loop and tie-breaking as `greedyBot`), iterative deepening, BRS MIN layer merging all opponents still in, alpha-beta, `rootWidth`/`width`/`replyWidth` beams by `moveKey`, deadline handling (d − 1 answer, or a completed better root move); verify with tests "A move that loses to a reply is avoided", "Only colours still in reply", "Tiny time limit" and "Deeper when time allows" (injected clock), depth 1 equals greedy for the same seed, "Depth budget reproducible"
- [ ] 2.4 Add `mctsBot` in `src/search/mcts.ts`: max^n UCT, progressive widening in key order (root in depth-1 pass order), keyed playouts of `playoutPlies`, logistic rewards, iterations and deadline, most-visited answer; verify with tests: legal moves, "Iteration budget reproducible", tiny time limit, avoids the punished toy move at a moderate iteration count, out players get no reward updates as movers

## 3. Worker harness (`packages/bots`, entry `game-bots/worker`)

- [ ] 3.1 Add `src/worker/` with `serveBotWorker(answer)` and `botWorkerClient({ create, answer, onError })` (ids, lazy create, in-page fallback when no worker / on error reply / on crash for all pending and later); add the `./worker` export (source/types/default) and build it; verify with fake-worker unit tests (id matching with out-of-order replies, error reply fallback, crash fallback, no-Worker fallback)
- [ ] 3.2 Switch `client/src/bots/bot.worker.ts` and `botWorkerClient.ts` to the harness, keeping the same log events; client tests for the bot client stay green (move or adapt them to the new wrappers, not duplicated with the library tests)

## 4. Palikka search bots (`packages/palikka-bots`)

- [ ] 4.1 Extend the adapter to `MultiplayerGame`: `players`, `movesOf`/`playAs` via `withTurn`, `moveKey` (squares + 1.5 × opponent free corners covered + 0.5 × new own corner squares, bit operations, no position copy); `chooseMove` uses `withTurn`; verify with tests: `movesOf`/`playAs` agree with the rules for a colour off turn, `moveKey` ranks a bigger piece and a blocking piece higher
- [ ] 4.2 Add `brsPlayer` and `mctsPlayer`, registry entries `brs` (`{ depth: 2 }`) and `mcts` (`{ iterations: 400 }`), `parseBot` `@i<n>`; verify with tests "Iteration budget" (tournament name), both bots playing legal moves through a whole 4-colour game on small budgets (`brs@d2`, `mcts@i50`), a 2-colour game
- [ ] 4.3 Extend `scripts/bench.ts` with a bot argument (`greedy`, `brs@d2`, `mcts@i400`, `brs@800ms`, …) reporting ms per move and, for time budgets, the average depth or iterations reached; record the numbers in design.md → Measured
- [ ] 4.4 Choose the device bot: run the head-to-head tournaments from design.md (`@200ms` and `@800ms`, 100 games, 4 jobs); tune widths/`moveKey`/`c`/`scale` with tournaments if neither search bot reaches 60 % against greedy; export `devicePlayer` and make it `chooseMove`'s default; record ratings, settings and the choice in design.md
- [ ] 4.5 Add "search beats greedy" to `strength.json` (device bot at its machine-independent budget vs `greedy`, 4 colours, 200 games, seed 1, minShare 0.6); run `npm run strength -w @palikka/bots` locally, record share and duration in design.md; verify the "Search requirement listed" scenario with a test that reads `strength.json`

## 5. Client timing and budget (`client`)

- [ ] 5.1 `BOT_BUDGET = { timeMs: 800 }`; `LocalRoom.playBot` asks the bot when its turn begins and plays at `max(delay, compute)`, dropping stale answers as today; verify with LocalRoom tests "Pause not stretched" (fake clock: an answer ready before the delay lands at the delay) and a slow answer landing when it arrives, plus the existing undo/new-game staleness tests
- [ ] 5.2 Check the bot worker bundle with `npm run build && npm run size -w @palikka/client`; raise its size-limit only if needed (measured + 5 kB); UI check (Playwright mobile, portrait, light) of a `/?dev=1v3` game: bots move after about a second each, no stall, the game ends normally; run `npm run e2e` (device game smoke covers the critical path)

## 6. Docs and roadmap

- [ ] 6.1 Update `docs/architecture.md` (Bots: search and MCTS Implemented, `MultiplayerGame`, iterations budget, worker harness in the library, the device bot and its measured strength, client timing), `docs/development.md` (bot names `brs`/`mcts` with `@i<n>`, bench usage), `docs/template.md` (worker harness is generic); mark roadmap item 6 `bot-search` done
