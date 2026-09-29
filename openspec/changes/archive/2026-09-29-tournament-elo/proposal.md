# Proposal

## Why

Bot strength is the project's main focus and must be measured, not guessed (nfr → Testing). Today
the only measurement is a small benchmark script and one unit test (greedy vs three random players).
Before `bot-search` adds paranoid/best-reply search and MCTS, we need a reproducible way to say
"bot B is stronger than bot A by this much": a tournament driver, Elo ratings, and strength
requirements that are checked automatically, with the heavy runs in GitHub Actions instead of the
unit test run.

## What Changes

- `packages/bots` (`game-bots`, game-independent): a tournament core with no game names. It builds
  a round-robin schedule of pairings over named bots with seat rotation, plays each game through a
  callback the game provides, turns every game's final scores into pairwise results, and computes
  Elo ratings (order-independent maximum likelihood with a small draw prior, one bot anchored) plus
  each pairing's score share with a 95 % interval.
- `packages/palikka-bots` (`@palikka/bots`): a registry of named bots with a budget in the name
  (`random`, `greedy`, `greedy@200ms`; `bot-search` adds its bots here), the Palikka game callback
  (4-colour classic games with two bots on alternating corners, or 2-colour games), a command-line
  tournament runner that spreads games over CPU cores (worker threads), prints a Markdown report
  (standings, pairing matrix) and writes the results as JSON.
- Strength requirements as data: a checked-in list of "candidate beats baseline by at least X %
  over N games" requirements. A `strength` command plays exactly those matches and fails when one
  is not met. The first requirement is "greedy beats random"; `bot-search` adds "search beats
  greedy ≥ 60 % over 200 games".
- GitHub Actions workflow `tournament.yml`: runs the strength requirements when the bot packages or
  the rules change on `main` (and on pull requests touching them), and a free tournament on manual
  dispatch (bots, games, format as inputs); the report goes to the job summary and the JSON to an
  artifact. It does not block deploys.
- The existing benchmark script folds into the runner (`bench` stays for per-move timing).
- Not in scope: new bots or evaluation changes (`bot-search`), difficulty levels, storing a rating
  history across runs, variant boards (`variants` adds its formats), any UI.

Workspaces touched: `packages/bots`, `packages/palikka-bots`, `.github/workflows`, docs. Not rules,
protocol, server or client.

## Capabilities

### New Capabilities

- `bot-tournament`: how bot strength is measured: reproducible seeded matches between named bots
  with seat rotation, how a game becomes pairwise results, how Elo ratings and score shares are
  computed and reported, and how checked-in strength requirements pass or fail.

### Modified Capabilities

(none — `bot-play`'s fast "greedy beats random" check stays in the unit tests as it is.)

## Impact

- New source and tests in `packages/bots` and `packages/palikka-bots`; new scripts
  (`tournament`, `strength`) in `@palikka/bots`; a checked-in requirements file.
- New workflow `.github/workflows/tournament.yml` (GitHub-hosted runners within the free
  minutes; 0 € budget holds).
- Docs: `docs/architecture.md` (Bots: tournament and ratings), `docs/development.md` (how to run a
  tournament and the strength check), `docs/operations.md` (the workflow), `docs/template.md` (the
  tournament core is generic), roadmap item 5 done.
