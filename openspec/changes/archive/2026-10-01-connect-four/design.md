# Design

## Context

The kit repo (`../game-kit`, `Jukkakot/game-kit`, newest release `v0.1.0`) holds `template/` and
`tools/create-game.mjs` (`game-template` change). A generated game is Palikka's shape with the
placeholder game Ristinolla, autopilot OFF in its `CLAUDE.md`, a neutral "Placeholder" theme and a
starter roadmap (`theme`, `rules-engine`, `game-ui`, `bot-v1`, `first-deploy`). Its CI (`ci.yml`:
check, e2e, deploy-server) and `deploy-client.yml` run on every push to `main`; on a repo without
the setup checklist done (no Pages source, no `VITE_SERVER_URL`, no `RENDER_DEPLOY_HOOK_URL`) the
deploy steps fail. Known ports: Labyrinth 2567/5173, Palikka 2577/5183, template 2597/5203, kit CI
game 2700.

User decisions in the spec phase (2026-10-01): name "Neljän suora" / `neljan-suora` (first `connect-four`, changed during apply: see Implementation notes); this change
creates the game and its own spec base only, the game is built through its own changes; the
GitHub repo may be created and pushed during apply.

## Goals / Non-Goals

**Goals:** `../neljan-suora` exists, passes its check chain and E2E as generated, lives in
`Jukkakot/neljan-suora` with green CI, and its `product.md` and `roadmap.md` describe Neljän suora
well enough that its first spec change (`theme`) can start right away. Everything the template got
wrong for a non-Palikka game is fixed in the kit or written down.

**Non-Goals:** see proposal.md.

## Decisions

### D1 Generation

`npm run create-game -- neljan-suora --port 2587 --title "Neljän suora"` from the kit checkout,
default `--dir` (`../neljan-suora`) and `--kit` (newest tag). 2587/5193 are free (see Context). If
the kit needs a package fix before the push (D5), cut a patch release and switch the game to it
with its own `npm run kit:use -- <version>`; the game never stays on `local`.

### D2 The game in our own words (new repo's `product.md` → "The game")

Replaces the TODO section; Ristinolla stays in the code until the game's `rules-engine`.

- Two seats. A grid of 7 columns and 6 rows, standing upright.
- A move is choosing a column that is not full; the disc drops to the lowest free cell of it.
- Four of the mover's discs in a row horizontally, vertically or diagonally win at once (the
  winning row is shown). A full grid without a row is a draw. No passing, no scores beyond
  win/draw/loss.
- Who starts is drawn from the game's seed (the template's pattern); a rematch lets the other seat
  start. Recorded as a decision for `rules-engine` to confirm.
- Name and look are our own; "Connect Four" is a trademark and never appears in the UI, icons or
  texts (nfr → Legal). The technical name is `neljan-suora`; `connect-four` is only the name of this Palikka change.

Other `product.md` entries:

- **Controls:** column first. A tap anywhere in a column shows a ghost disc in its landing cell;
  a second tap on the same column (or the confirm button) drops it; another column moves the ghost.
  Swipe/drag not needed. Fits the "few taps, one deliberate confirm" rule.
- **Bots:** the game is solved (the first player wins with perfect play), so strong play is
  reachable in the browser: bitboard negamax with alpha-beta, a transposition table, centre-first
  move ordering and iterative deepening within the time budget. Whether the kit's generic search is
  fast enough or the game needs its own searcher is decided in `bot-v1` with measurements. One bot
  offered, as in the template.
- **Later, to consider (not now):** larger grids (8 × 7, 9 × 7), a "pop out" rule, a perfect-play
  bot with an opening book, a "hint" that shows whether the position is won.

### D3 The new repo's roadmap

From the starter roadmap, with Neljän suora content; all `planned`, in this order:

| # | Change | What |
|---|---|---|
| 0 | `create` | done (generated from game-kit v<x>) |
| 1 | `theme` | theme with light and dark mockups (concept, palette, the two disc colours, drop and win motion, voice and bot names) |
| 2 | `rules-engine` | 7 × 6 gravity rules on bitboards, win/draw detection with the winning row, seeded start; property tests |
| 3 | `game-ui` | upright grid, column-first controls with ghost disc and confirm, drop animation, winning row; E2E smoke on real moves |
| 4 | `bot-v1` | searching bot (D2), strength requirement in `strength.json`, tournament green |
| 5 | `first-deploy` | the setup checklist: Pages, Render, Axiom, prod smoke (user's go-ahead) |

The "Later" list of D2 goes under the roadmap's "Later, to consider". The new repo's `CLAUDE.md`
keeps autopilot OFF (template default); the user turns it on there when the backlog is specced.

### D4 GitHub repo

`gh repo create Jukkakot/neljan-suora --public --source . --push` (checklist step 1 only). After
the push, `ci.yml`'s check and e2e jobs must be green; deploy jobs must skip, not fail (D5).
Render, Axiom, Pages and secrets are left for `first-deploy`.

### D5 Kit fixes from being the first outside user

Rule: each friction met while generating, checking or pushing the game is fixed in the kit's
`template/` or `create-game` when cheap, and the same fix is applied to `../neljan-suora` (it is a
copy, never re-generated); bigger ones become a kit TODO in this change's `tasks.md` (and the kit
README's TODO list if it has one). Known up front:

- **Deploys before setup:** `deploy-client.yml` and `ci.yml`'s `deploy-server` fail on a fresh
  repo. They skip with a notice when the setup is missing: the client job when
  `vars.VITE_SERVER_URL` is empty, the server job when `RENDER_DEPLOY_HOOK_URL` is empty.
  `prod-smoke.yml` likewise if it runs on a schedule. The template's `docs/operations.md`
  checklist says so.

Kit commits follow the kit's own check (`npm run check`, `npm run template:check` when the template
changes) and are pushed to its `main`. A kit package change gets a patch release (D1); a
template-only change needs none (the template is read from the checkout).

### D6 nfr

- Logging: the generated game keeps the kit's events and Palikka's audit, client-log and HTTP
  logging unchanged; its Axiom dataset `neljan-suora` is created in `first-deploy`, until then the
  server logs to stdout only.
- Tests: no new tests here; acceptance is the generated game's own check chain and E2E smoke
  locally and in its CI, plus the kit's `template:check` after a template fix.
- Limits, versioning: template defaults (size budget, turn time, rate limits; the server reports
  its own version).
- Legal: D2 (no trademark in UI or assets).

## Risks / Trade-offs

- [More template gaps than expected] → fix the blocking ones, list the rest (D5); the change is
  done when the game is green, not when the kit is perfect.
- [Public repo with a placeholder game for a while] → accepted; nothing is deployed yet.
- [Two places to fix (template and the game)] → accepted; the upkeep rule already works this way.

## Migration Plan

Kit fixes first (so the generated game starts from them), then generate, tailor the docs, push the
new repo, then Palikka's wiki and roadmap. Rollback: delete `../neljan-suora` and the GitHub repo
(with the user's go-ahead); revert kit commits.

## Implementation notes (decisions made while building)

- Technical name changed from `connect-four` to `neljan-suora` (user, during apply): "Connect Four"
  is a trademark and nfr → Legal keeps it out of the repo too. The first generated folder was
  deleted before any push; this Palikka change keeps its roadmap name.
- The deploy-skip fix (D5) touched only workflows and docs, so the kit's `template:check` (which
  runs no workflows) was not run for it; the new repo's first CI run verified it instead: check and
  e2e green, `deploy-server` printed the skip notice, a dispatched "Deploy client" ran only its gate.
- No kit package changed, so no kit release; the game uses v0.1.0.
