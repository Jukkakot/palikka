## Context

Starting point: Labyrinth at `726698c` (monorepo, Colyseus server, lobby, bots, device games,
Axiom logging, CI + Render/Pages deploy). Target: the same chain for Palikka with no Labyrinth
rules left, minimal work.

## Decisions

- **Copy, then strip.** `git archive` of Labyrinth, a mechanical rename, then the game-specific
  parts replaced. The first commit is the untouched import, so `git diff` shows exactly what
  Palikka changed.
- **Placeholder game "claim a cell".** Same engine shape as the real game will need (a JSON
  `GameState`, one command, rejection codes, a `BotStrategy`, a daily puzzle from the date) so
  server, `LocalRoom`, view model and screens keep their structure. Five turns each; ties go to
  the lowest seat. The daily puzzle claims six seeded target cells (par 6).
- **Bots still on the server** for online games in the placeholder; moving them to the host's
  browser is `game-room`'s job (it needs the real move generation first).
- **No pawn looks:** a seat is its colour (Järvi, Lakka, Puolukka, Kuusi in turn order). Pawn
  looks and the shift/move confirmations went away with their UI.
- **Theme Kuura** in `ui/tokens.css`, light and dark, as picked from the theme mockups (flat
  squares, northern colours). System font for now; a theme font can come with `basic-ui`.
- **Ports 2577/5183** so Palikka's dev servers run beside Labyrinth's.
- **Health URL from `vars.VITE_SERVER_URL`**, so the Render URL is set once as a repo variable.
- **No specs** for the placeholder (archived with `--skip-specs`).

## Meeting nfr.md

Logging and audit unchanged (every command one audit line; `game.setup`/`treasure.collected`
removed, `game.finished` reason `complete`). Tests: rules unit + property tests for the placeholder
engine, room tests for wiring, client logic tests, one E2E smoke (two players, a square syncs).
Bundle 168 kB gzip of 200 kB.

## Non-goals

Real rules, piece UI, the bot library, tournaments: later roadmap changes.

## Risks

- The placeholder's 20×20 board has cells of ~16 px on a phone (below 44 px taps); accepted for a
  placeholder, solved by `basic-ui` / `mobile-ui`.
