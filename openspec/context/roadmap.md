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
| 5 | `tournament-elo` | planned | Tournament driver and Elo; bot strength as a measurable requirement (e.g. "v2 beats v1 ≥ 60 % over 200 games"); heavy runs in GitHub Actions |
| 6 | `bot-search` | planned | Search bots: paranoid or best-reply search and MCTS, time budget (difficulty levels possible later) |
| 7 | `variants` | planned | Duo 14×14, 2 players with two colours each, 3 players |
| 8 | `daily-puzzle` | planned | Daily puzzle: fill a given shape with pieces |
| 9 | `mobile-ui` | planned | The mobile ideas in product.md (legal-move-driven picking, drag with snap, zoom, hint top 3, TV mode, Duo on phone) |

## Later, to consider (not now)

- Hugging Face Spaces (Docker, 2 vCPU / 16 GB free) could replace Render and compute bots on the
  server. Needs a trial first (WebSockets, waking up, terms of use).
- Extract the generic parts to a shared template repo (see `docs/template.md`).
