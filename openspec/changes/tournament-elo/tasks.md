# Tasks

## 1. Tournament core (`packages/bots`, npm `game-bots`)

- [ ] 1.1 Add `src/tournament/` with `schedule` (round robin, seed pairs, swap, odd games refused), `pairwise` (different-bot seats only, 1/½/0 by score), `summarize` (pairing shares, seed-pair 95 % intervals, per-bot totals and game wins) and export them from `index.ts`; verify with unit tests named after the scenarios "Seat swap with the same seed", "Round robin", "4-colour game", "2-colour game drawn"
- [ ] 1.2 Add `rate` (Bradley–Terry MM iteration, one virtual draw per pairing, anchor at 1000); verify with tests "Equal bots", "Three quarters of the points", "Order does not matter", "Clean sweep" and the anchor choice (`random` if present, else the first bot)
- [ ] 1.3 Add `markdownReport` (setup, standings by rating, pairing matrix with intervals, time-limited note) and `checkRequirement` (pass/fail with measured share); verify with tests "Two-bot tournament" (report part), "Requirement met", "Requirement missed"

## 2. Palikka glue (`packages/palikka-bots/src`, browser-safe)

- [ ] 2.1 Add `src/tournament.ts`: bot registry (`random`, `greedy`, default `{ depth: 1 }`), `parseBot` (`@<n>ms`, `@d<n>`, errors listing known bots, duplicates refused at tournament level), formats 4 and 2, `playTournamentGame` (seats per format and swap, final scores, per-move timing); verify with tests "Budget in the name", "Unknown bot", seats per format, and "Same run twice" (the same games played in two different orders in-process give identical results)
- [ ] 2.2 Add `strength.json` with "greedy beats random" (4 colours, 40 games, seed 1, minShare 0.9)

## 3. Command-line runner (`packages/palikka-bots/cli`, Node-only)

- [ ] 3.1 Add `tsconfig.cli.json` (Node types; `@types/node` dev dependency if missing), include it in the package `typecheck` script; add `pool.ts` + `worker.ts` (worker_threads, `--jobs`, in-thread for `--jobs 1`) and verify by hand that `--jobs 1` and `--jobs 4` give the same JSON games for a depth-budget run (record the tsx-in-workers outcome in design.md)
- [ ] 3.2 Add `tournament.ts` (args: bots, `--games`, `--colours`, `--seed`, `--jobs`, `--out`; limits; version; prints the Markdown report; writes JSON under git-ignored `tournament-results/`) and `strength.ts` (plays `strength.json`, PASS/FAIL lines + reports, JSON, exit 1 on a miss, `--summary <file>` appends the report); scripts `tournament` and `strength` in package.json; add `tournament-results/` to `.gitignore`
- [ ] 3.3 Trim `scripts/bench.ts` to per-move timing only; run `npm run strength -w @palikka/bots` and a `random greedy` 100-game tournament locally, record the measured shares, Elo and run time in design.md

## 4. GitHub Actions

- [ ] 4.1 Add `.github/workflows/tournament.yml`: `strength` job (push to main / pull_request, path filter on bots, palikka-bots, rules, lock file, the workflow), `tournament` job (workflow_dispatch inputs bots, games, colours, seed), report to `$GITHUB_STEP_SUMMARY`, JSON as artifact (30 days), timeouts; check the YAML with `npx --yes action-validator` or a careful read if not available

## 5. Docs and roadmap

- [ ] 5.1 Update `docs/architecture.md` (Bots: tournament core, registry, ratings, strength requirements), `docs/development.md` (running a tournament and the strength check), `docs/operations.md` (the tournament workflow and where its report is), `docs/template.md` (tournament core is generic); mark roadmap item 5 `tournament-elo` done
