# Palikka – working instructions

## Knowledge base

The project wiki is [docs/README.md](../docs/README.md): architecture, operations (environments,
deploy, logs, bug runbook), development (run, test, debug, conventions), and
[docs/template.md](../docs/template.md) (the game template and how improvements reach it). Start any planning
or investigation there, then verify against the code. Keep it current: every change updates the
wiki pages it affects (enforced by `openspec/config.yaml` rules and archive guidance).

Theme: **Kuura** (`openspec/context/product.md` → Theme). Every UI change and every text follows
it; check light and dark.

## Session start

At the start of every session, before doing anything else: read `openspec/context/roadmap.md` and
run `openspec list`, then tell the user in two or three lines where the project stands (last
finished change, active change and its task progress, the natural next step).

## OpenSpec workflow (use it proactively)

This project is spec-driven with OpenSpec. Use the OpenSpec skills/commands on your own
initiative whenever they fit; do not wait to be asked. When unsure whether one fits, suggest it.

- New feature or behaviour change → `openspec-propose` (proposal, specs, design, tasks).
- Idea still unclear, or a question that affects several changes → `openspec-explore`.
- Plan changes mid-way → `openspec-update-change`.
- Change approved → `openspec-apply-change`; implemented, verified and committed →
  `openspec-archive-change`.
- Pure tooling or refactoring with no behaviour change needs no change; just do it (and still
  update the wiki if it affects it).

## Two phases: spec phase, then autopilot

The user specs a lot up front, then runs implementations on autopilot during the day without
watching. So every change must be implementable **without asking**: clear acceptance criteria
(tests, typecheck, lint, E2E where a critical path changes), decisions written into `design.md`,
scope and non-goals explicit.

**Spec phase** (while writing the backlog): write proposal, design, specs and tasks for one change,
then **stop for the user's review** before the next. Ask the user opinion questions freely (with
AskUserQuestion); they want to be asked during spec work.

**Autopilot** (implementation phase; **ON since 2026-09-29**, also for proposing the roadmap items not yet specced): this overrides the review stops.

- Run the loop without asking: apply → verify (check chain + UI check where visible) → commit →
  archive (sync specs, update roadmap and wiki) → commit → push → next specced change → …
- Make UX and rule decisions yourself from the specs, `product.md` and the memory notes. Record
  each non-obvious one in the change's `design.md` and list them in the summary.
- Stop and ask only for: spending money or creating external accounts/services, anything
  irreversible outside the repo, a decision that would force rework of built features, or failing
  checks you cannot fix.
- At each archived change, give a one-paragraph summary (what was built, decisions made, How to
  check) and keep going. When the session gets long, finish the current change, then recommend a
  new session with a handover instead of starting the next one.

## Working agreements

- Commit and **push to `main`** yourself (standing permission for this repo; overrides the global
  "don't push" rule): at the latest before giving a summary. Do not wait for CI or the deploy;
  list any production checks for the user in the summary instead.
- End every summary that changed something visible or runnable with a short "How to check"
  (which command, which URL, what to tap, what you should see).
- Bug reports ("around 14:30 in game brave-otters-sing, X happened"): follow
  [docs/operations.md → Investigating a reported bug](../docs/operations.md#investigating-a-reported-bug).
- UI checks: Playwright MCP `playwright-mobile` (Galaxy S24), **portrait only** by default, light
  and dark when colours or surfaces change. To reach a running bot game directly, open
  `/?dev=1v3` (1v1–1v3; development only). Check landscape and a narrow desktop only when a change
  reshapes a layout. Save screenshots under `.playwright-mcp/`.
- Dev servers run on this game's own ports, **server 2577, client 5183** (Labyrinth keeps 2567/5173),
  and stay running locally (the user's wish). Before a UI check or E2E run, check that this
  checkout's `npm run dev` listens there and use it; otherwise start it following
  [docs/development.md → Local dev servers](../docs/development.md#local-dev-servers) and leave it
  running.
- Before committing, run the check chain **once**, right before the commit (while working, run only
  the tests of the workspace you touch; quick fixes skip it):
  `npm run lint && npm run typecheck && npm test && npm run build && npm run size -w @palikka/client`.
- Changes may be large (a whole roadmap item at once); the user prefers progress over small steps.

## Handover (overrides the global handover format)

The next session rebuilds the state itself (session start: roadmap, `openspec list`, the change's
`tasks.md`), so a handover repeats none of it. It is at most two lines:

```
Jatka: /opsx:apply <change> (seuraava <task no.>)      ← or /opsx:propose <roadmap item>, /opsx:archive <change>
Huom: <only what is not in the repo: a half-formed idea, a bug seen, an open question>
```

Keep the `Huom` line empty by writing decisions into `design.md` and notes into `tasks.md` as they
happen. Commit and push before handing over, so the working tree is clean.

## Parallel work

Parallel work is opt-in per situation. Modes (the user switches them with a word; default **ask**):

- **ask**: when a clear chance turns up (a roadmap item that touches other files than the current
  work), ask once with AskUserQuestion: parallel or one after another, with a one-line estimate of
  the extra cost. Do not ask again for the same items.
- **säästö** ("säästötila"): never offer parallel work; sequential only.
- **rinnakkain** ("rinnakkaistila"): do not ask; run every suitable item in parallel (up to 3 jobs).

What fits: items whose files barely overlap (e.g. the bot library package vs client screens). Not
parallel: items that share hot files (`GameRoom.ts`, `GameScreen.tsx`, `useGameSession.ts`,
`viewModel.ts`, `localRoom.ts`, `GameState.ts`, `game.ts` in rules) or where one needs the other's
decisions.

How to run it (coordinator, job briefs, merge and archive): the project skill `parallel-work`.
Load it before starting a job.
