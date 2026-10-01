# Design

## Context

See proposal.md → Why. The kit repo (`../game-kit`, `Jukkakot/game-kit`, release `v0.1.0`) has
four packages, `tools/pack.mjs` and `tools/release.mjs`, CI (check chain + pack) and a release
workflow; no OpenSpec, no wiki (its `.claude/CLAUDE.md` says kit changes are specced in a game
repo, so this change is specced here). Palikka's `docs/template.md` lists which of its files are
generic ("as is"), generic with known edits ("adapted") or game-specific. Palikka and Labyrinth use
server/client ports 2577/5183 and 2567/5173 (client = server + 2606).

## Goals / Non-Goals

**Goals:** one command gives a new folder with a game that runs (`npm run dev`), passes its check
chain and E2E smoke, is deployable after the printed checklist, and is ready for spec work
(OpenSpec, wiki, `.claude`). The kit's CI keeps the template green.

**Non-Goals:** see proposal.md. Also: no interactive prompts (all input as arguments, so CI and
Claude can run it); no Windows-only or bash-only tooling (Node scripts only).

## Decisions

### D1 Template = Palikka's layout with a placeholder game

`template/` mirrors Palikka: `packages/rules`, `packages/protocol`, `packages/starter-game-bots`
(the game's bot adapter + tournament CLI + `strength.json`), `server`, `client`, `e2e`,
`tools/kit`, `tools/axiom`, `docs`, `openspec`, `.claude`, `.github/workflows`, `.vscode`,
`render.yaml` and the root files. It is a complete project, not a set of fragments, so a generated
game is the same shape as Palikka and Palikka's docs and habits carry over.

What goes in follows `docs/template.md`: "as is" files are copied, "adapted" files are copied with
the Palikka parts replaced by the placeholder game or neutral text, game-specific files are
rewritten for the placeholder game. Dropped entirely: variants, daily puzzle, how-to-play, piece
tray/drag/placement, Palikka's rules and bots. `StartScreen` keeps the two ways in, nickname, open
games and "continue", without the variant and puzzle parts; `GameScreen` keeps its generic shell
(player strip, turn line, timer, controls, result) around the placeholder board.

### D2 Placeholder game: Ristinolla

Tic-tac-toe on 3×3, 2 seats, first to three in a row, draw when full. Small enough to delete in
one go, but it exercises the whole contract: `GameRules` in `packages/rules/src/contract.ts` (same
pattern as Palikka), move and options zod schemas in protocol, the server definition and synced
child schema, the client definition, a tappable board with the one-confirm move pattern, the bot
adapter over `@game-kit/bots` with an evaluation, device games with undo, and a tournament.
`strength.json` holds one requirement the placeholder bot meets reliably (the apply picks it from
what the bots library offers, e.g. the search bot never loses to greedy over 100 games); it shows
the format, not real strength. Connect Four is not used, because `connect-four` will be a real
game made from this template and the kit's own test game lives in `@game-kit/protocol/testing`.

### D3 Names: one placeholder, replaced in every form

The template is written as a game called **Starter Game** with these forms, which `create-game`
replaces everywhere (file contents and file/folder names):

| Form | Template | Example result |
|---|---|---|
| kebab | `starter-game` | `connect-four` |
| camel | `starterGame` | `connectFour` |
| Pascal | `StarterGame` | `ConnectFour` |
| title (UI, docs) | `Starter Game` | `Neljän suora` |
| server port | `2597` | `2587` |
| client port | `5203` | `5193` |
| theme name | `Placeholder` | `Placeholder` until the theme change |

The kebab form is the npm scope (`@starter-game/server`), the storage prefix, the Render service
(`starter-game-server`), the Axiom dataset, the Pages path (`/starter-game/`) and the GitHub repo
name in the checklist. The forms are distinctive, so plain text replacement is safe; a generated
project is checked for leftovers (D6). Binary files (icons) are copied unchanged.

### D4 `create-game`

`node tools/create-game.mjs` (root script `create-game`) in the kit repo, Node built-ins only:

```
npm run create-game -- <kebab-name> --port <server-port> [--title "<UI title>"]
                       [--theme <name>] [--dir <path>] [--kit <version>|local]
```

- `<kebab-name>` must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`; `--port` is required (no registry
  of used ports exists; the error message lists the known ones, 2567 and 2577); client port =
  port + 2606. `--title` defaults to the name in title case; `--dir` defaults to
  `../<name>` next to the kit checkout; `--kit` defaults to the newest `v*` tag of the kit checkout.
- Refuses a `--dir` that exists and is not empty. Copies `template/` (skipping `node_modules`,
  `dist`, `.release`), replaces the D3 forms, then sets the kit dependencies with the generated
  project's own `npm run kit:use -- <version>|local` (`local` points at the kit checkout that ran
  the script), which also runs `npm install`.
- `git init -b main`, first commit `chore: create <name> from game-kit template v<version>`.
- Prints the setup checklist (D7) and the next steps (`npm run dev`, open the client port, then
  the first spec change `theme` in Claude).
- Creates nothing outside `--dir`: no GitHub repo, no services.

### D5 OpenSpec, wiki and `.claude` in the template

- `openspec/config.yaml`: Palikka's `rules` and `operations` as is; `context` rewritten for a
  generic game on the kit (workspaces, knowledge-base map, always-rules).
- `openspec/context/product.md`: skeleton with the generic parts filled in from Palikka (modes,
  lobby and seats, device games, bots and names, mobile-first UX, light/dark) and placeholders for
  rules and theme. `nfr.md`: Palikka's, with game-specific performance targets and legal notes
  made neutral. `roadmap.md`: starter roadmap — `theme` (agree the theme with light/dark mockups,
  tokens, voice), `rules-engine` (replace Ristinolla), `game-ui`, `bot-v1`, `first-deploy` (the
  checklist, done with the user's go-ahead); all `planned`.
- `openspec/specs/`: generic specs of what the kit and the copied screens already do —
  `start-screen`, `game-room` (seats, turns, time limit, leaving, end), `bot-seats`,
  `device-games` — written game-neutrally from Palikka's specs (no variants, puzzle or piece
  texts), so a new game's spec work starts from the behaviour it already has. Each states the
  Ristinolla specifics only where unavoidable, marked as placeholder.
- `docs/`: `README.md`, `architecture.md`, `development.md`, `operations.md` from Palikka with
  names, ports and URLs replaced and the Palikka-only sections removed; `operations.md` holds the
  checklist (D7). No `template.md` (that page is about extracting; it lives in the kit README now).
- `.claude/`: `CLAUDE.md` from Palikka (session start, OpenSpec workflow, two phases with
  **autopilot OFF** by default, working agreements with the template's ports and check chain, hot
  files of the template, parallel work), `settings.json`, `hooks/lint-edited.mjs`, the OpenSpec
  skills and `commands/opsx` as is (refreshable with `openspec update`), `skills/parallel-work`.

### D6 Kit CI keeps the template working

New job `template` in the kit's `ci.yml` (and `npm run template:check` for local use, same steps):
`npm run pack -- --local`, `create-game ci-game --port 2700 --dir $RUNNER_TEMP/ci-game --kit local`,
then in the generated project: `npm run lint`, `typecheck`, `test`, `build`, `size`, Playwright
Chromium install and `npm run e2e`. A leftover check fails the job when the generated project
contains `starter-game`, `StarterGame`, `starterGame`, `Starter Game`, `2597`, `5203`, or any of
`palikka`, `Palikka`, `Kuura`, `labyrinth` (case-insensitive for the last group). The kit's own
lint, typecheck and workspaces exclude `template/`; the `kit:use local` setup check is skipped in
this job (it refuses `file:` specs on purpose).

### D7 Setup checklist (printed and in `docs/operations.md`)

1. `gh repo create Jukkakot/<name> --public --source . --push`.
2. GitHub Pages: source "GitHub Actions"; repo variable `VITE_SERVER_URL`.
3. Render: new Blueprint from `render.yaml`; copy the deploy hook URL into repo secret
   `RENDER_DEPLOY_HOOK_URL`; check `ALLOWED_ORIGINS`.
4. Axiom: dataset `<name>` (EU), ingest token into Render's `AXIOM_TOKEN`; import
   `tools/axiom/dashboard.json`.
5. Run `prod-smoke` once by hand.
Each step says where it is used, so it can be done later or skipped (a game can run locally only).

### D8 Upkeep

A generic improvement made in a game (a CI step, a screen fix, a doc rule) is ported to the
template in the same piece of work when it is cheap, otherwise noted as a kit TODO in the game's
`tasks.md`. The kit's `CLAUDE.md` gets this rule and the template's hot spots; Palikka's
`docs/template.md` shrinks to that rule plus the list of Palikka files that still map to template
files. Existing games are never re-generated.

### D9 nfr

- Logging: the template keeps the kit's event names and Palikka's audit, client-log and HTTP
  logging; only the dataset name differs per game. The Ristinolla move is logged by the kit's
  command audit like any move.
- Tests: the template ships the tests a game needs from day one — Ristinolla rules unit tests,
  the contract test, the bot adapter test, the copied infra tests (errors, cors, httpAudit,
  clientLogs, buildInfo), client logic and key render tests, E2E smoke (bot game on the device and
  a two-player online game to the end). The kit CI runs them all on every kit push (D6), so a kit
  change that breaks a game template fails before release.
- Limits: the client size budget starts at Palikka's value; the turn time limit and rate limits
  come from the kit defaults.
- Versioning: the generated server reports its own version as in Palikka; the kit version is in
  the generated `package.json` files.

## Risks / Trade-offs

- [The template drifts from Palikka] → upkeep rule (D8); the CI keeps it working but not current.
  Accepted: hobby scale.
- [Kit CI gets slower by a full game build + E2E, a few minutes] → separate job, runs in
  parallel with `check`.
- [Copy-heavy: the "as is" components exist in Palikka, the template and every game] → a later
  change may move them to a `@game-kit/ui` package once two real games share them (after
  `connect-four`); noted in the kit README.
- [Placeholder text replacement hits the wrong thing] → distinctive forms (D3) and the leftover
  check (D6).

## Migration Plan

Kit: add `template/` and `create-game`, CI job, README and CLAUDE.md sections; push; CI green.
Palikka: wiki and roadmap. Rollback: revert the kit commits; nothing else depends on them yet.
