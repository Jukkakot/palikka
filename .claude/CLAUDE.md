# Labyrinth – working instructions

## Knowledge base

The project wiki is [docs/README.md](../docs/README.md): architecture, operations (environments,
deploy, logs, bug runbook), development (run, test, debug, conventions). Start any planning or
investigation there, then verify against the code. Keep it current: every change updates the wiki
pages it affects (enforced by `openspec/config.yaml` rules and archive guidance).

## Session start

At the start of every session, before doing anything else: read `openspec/context/roadmap.md` and
run `openspec list`, then tell the user in two or three lines where the project stands (last
finished change, active change and its task progress, the natural next step).

## OpenSpec workflow (use it proactively)

This project is spec-driven with OpenSpec. Use the OpenSpec skills/commands on your own
initiative whenever they fit; do not wait to be asked. When unsure whether one fits, suggest it.

- New feature or behaviour change → `openspec-propose` (proposal, specs, design, tasks),
  then stop for the user's review before implementing.
- Idea still unclear, or a question that affects several changes → `openspec-explore`.
- Plan changes mid-way → `openspec-update-change`.
- User approves a proposal → `openspec-apply-change`.
- Change implemented, verified and committed → suggest `openspec-archive-change`.
- **Fast lane** ("pikakaistalla", or a change with no new UX or rule decisions, e.g. a pure
  refactor or technical fix): propose and apply in one go without stopping for review, then stop
  at the end with the summary, a short "what to look at" list and "How to check". If a real
  decision turns up while working, stop and ask instead of deciding.
- Pure tooling or refactoring with no behaviour change needs no change; just do it (and still
  update the wiki if it affects it).
- After finishing a step, name the natural next OpenSpec step.

## Autopilot (ON again since 2026-09-27, also for refinement round 1)

While we are building roadmap features for the first time ("laying foundations"), the user trusts
Claude's judgement and does not want to approve every step. This overrides the review stops above:

- Run the loop without asking: propose → apply → verify (checks + UI check where visible) →
  commit → archive (sync specs, update roadmap and wiki) → commit → propose the next roadmap item
  → apply → …
  This also overrides the "planning only, stop after the artifacts" boundary in the OpenSpec skills.
- Make UX and rule decisions yourself, using the rules of the original board game, the memory
  notes and the existing specs. Record each non-obvious one in the change's `design.md` and list
  them in the summary so the user can revisit them later.
- Stop and ask only for: spending money or creating external accounts/services, anything
  irreversible outside the repo, a decision that would force rework of already built features, or
  failing checks you cannot fix.
- At each archived change, give a one-paragraph summary (what was built, decisions made, How to
  check) and keep going. When the session gets long, finish the current change, then recommend a
  new session with a handover instead of starting the next one.

Autopilot ends when the user says so. (The user switched it back on for refinement round 1 on
2026-09-27: refinements run the loop too; list every decision in the summary for later review.)

## Working agreements

- Commit and **push to `main`** yourself (this overrides the global "never push" rule): at the
  latest before giving a summary, not necessarily after every commit. Do not wait for CI or the
  deploy; list any production checks for the user in the summary instead.
- End every summary that changed something visible or runnable with a short "How to check"
  (a few steps: which command, which URL, what to tap, what you should see). Keep it cheap: no
  extra work just to produce it; skip it when nothing user-visible changed.
- Bug reports ("around 14:30 in game brave-otters-sing, X happened"): follow
  [docs/operations.md → Investigating a reported bug](../docs/operations.md#investigating-a-reported-bug).
- UI checks: Playwright MCP `playwright-mobile` (Galaxy S24), **portrait only** by default. To
  reach a running bot game directly, open `/?dev=1v3` (1v1–1v3; development only). Check
  landscape and a narrow desktop only when a change reshapes a layout (new screen, new layout
  structure); this narrows the global default. Save screenshots under `.playwright-mcp/`.
- Dev servers stay running locally (the user's wish). Before a UI check or E2E run, check that
  this checkout's `npm run dev` listens on 2567/5173 and use it (it reloads by itself); otherwise
  start, restart or stop servers as needed (also the user's) following
  [docs/development.md → Local dev servers](../docs/development.md#local-dev-servers), say so in
  the summary, and leave them running.
- Before committing, run the check chain **once**, right before the commit (not after every task
  group; while working, run only the tests of the workspace you touch; quick fixes skip it):
  `npm run lint && npm run typecheck && npm test && npm run build && npm run size -w @labyrinth/client`.
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

Parallel work is opt-in per situation: sometimes the user saves tokens, sometimes they have tokens
but little time. Modes (the user switches them with a word; default **ask**):

- **ask**: when a clear chance turns up (a roadmap or backlog item that touches other files than
  the current work), ask once with AskUserQuestion: parallel or one after another, with a
  one-line estimate of the extra cost. Do not ask again for the same items.
- **säästö** ("säästötila"): never offer parallel work; sequential only.
- **rinnakkain** ("rinnakkaistila"): do not ask; run every suitable item in parallel (up to 3 jobs).

What fits: items whose files barely overlap (e.g. `packages/rules` only vs. client screens). Not
parallel: items that share hot files (`GameRoom.ts`, `GameScreen.tsx`, `useGameSession.ts`,
`viewModel.ts`, `game-schema.ts`) or where one needs the other's decisions.

How to run it (coordinator, job briefs, merge and archive): the project skill `parallel-work`.
Load it before starting a job.
