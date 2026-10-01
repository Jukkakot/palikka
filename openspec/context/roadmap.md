# Roadmap

Planned changes in order. Each is an OpenSpec change (`/opsx:propose <name>`), specified ahead in
the spec phase and then implemented on autopilot. Status: **done**, **specced** (proposal, design,
specs and tasks written), **planned**.

| # | Change | Status | What |
|---|---|---|---|
| 0 | `bootstrap-foundation` | done | Labyrinth's generic parts, placeholder "claim a cell" game, theme Kuura, docs, CI/deploy |
| 1 | `rules-engine` | done | Pieces and orientations (rotation, mirror), start corners, corner rule, move generation (bitboards, corner-based), passing, end and scoring (+15/+5); property-based tests |
| 2 | `game-room` | done | Room on the real rules: turns, time limit and passing, 2–4 seats, bots on empty seats computed by the host's browser (Web Worker) and validated by the server |
| 3 | `basic-ui` | done | Playable on desktop, at least usable on mobile: board, piece tray, rotate/mirror, placing, scores; simplified start screen |
| 4 | `bot-greedy` | done | Bot v1: greedy heuristic (free corners, piece size, area control) in the new game-independent bot library package |
| 5 | `tournament-elo` | done | Tournament driver and Elo; bot strength as a measurable requirement (e.g. "v2 beats v1 ≥ 60 % over 200 games"); heavy runs in GitHub Actions |
| 6 | `bot-search` | done | Search bots: paranoid or best-reply search and MCTS, time budget (difficulty levels possible later) |
| 7 | `variants` | done | Duo 14×14, 2 players with two colours each, 3 players |
| 8 | `daily-puzzle` | done | Daily puzzle: fill a given shape with pieces |
| 9 | `mobile-ui` | done | The mobile ideas in product.md (corner-first picking, drag with snap, board turned to the player, zoom, hint top 3, Duo on phone; TV mode dropped); after `variants` |
| 10 | `game-motion` | done | Motion and feedback: last move marked, placing/turn/out animations, frozen tray pieces at all times, playful end (count-up, square snowfall) |
| 11 | `game-contract` | done | Game contract: the generic room, lobby, bot runner, session and device games in `@game-kit/*` workspaces, and Palikka implements the contract. Gameplay unchanged; wire renamed (`move`, `setOptions`, `state.game`) |
| 12 | `game-kit` | specced | Move the kit packages (and `game-bots` and the generic infra) to their own GitHub repo. Palikka depends on a git tag, and the kit gets its own CI. Creating the repo needs the user's go-ahead |
| 13 | `game-template` | planned | `template/` in the kit repo with the full infra (docs wiki, OpenSpec, `.claude`, CI/deploy, E2E, tournament) and `create-game` (names, ports, theme, Render/Axiom/Pages checklist). Labyrinth stays as it is |
| 14 | `connect-four` | planned | Neljän suora as a real project of its own (own repo, theme and roadmap), made with `create-game`: the kit's first outside user |

## Later, to consider (not now)

- Hugging Face Spaces (Docker, 2 vCPU / 16 GB free) could replace Render and compute bots on the
  server. Needs a trial first (WebSockets, waking up, terms of use).
