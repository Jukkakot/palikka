# Palikka wiki

Palikka is a browser game in the spirit of the classic corner-touching polyomino territory game
(own name, own look: theme "Kuura"), for 1–4 players against people and strong bots, mobile first
(Android primary). Everything you need to know about the solution starts here.

- Play: https://jukkakot.github.io/palikka/
- Server health: `<VITE_SERVER_URL>/health` (see [operations.md](operations.md))

## Where to find what

| Question | Go to |
|---|---|
| How is it built? How do the parts fit together? | [architecture.md](architecture.md) |
| How is it deployed, configured, monitored and debugged in production? | [operations.md](operations.md) |
| How do I run, test and debug it locally? Conventions? | [development.md](development.md) |
| What exactly does the game do (requirements)? | [`openspec/specs/`](../openspec/specs/): one folder per capability |
| What has been decided but not built yet? | [`openspec/context/`](../openspec/context/): [product](../openspec/context/product.md), [nfr](../openspec/context/nfr.md), [roadmap](../openspec/context/roadmap.md) |
| What is being worked on now? | [`openspec/changes/`](../openspec/changes/) (active changes) |
| Why was something done this way? | [`openspec/changes/archive/`](../openspec/changes/archive/): proposal and design of every finished change |
| Which files are generic and could move to a shared template repo? | [template.md](template.md) |

## Sources of truth

1. **Code** is the truth for details.
2. **Specs** (`openspec/specs/`) are the truth for behaviour; a mismatch with code is a bug.
3. **This wiki** describes the solution as built, plus clearly marked planned parts. It is kept
   current by every change (see below). Planning starts here and verifies against code.
4. **Context** (`openspec/context/`) holds decisions not yet specified; once a spec exists, the
   spec wins.

## Keeping the wiki current

Every OpenSpec change updates the wiki pages its work affects, as part of its own task list, and
archiving checks this (`openspec/config.yaml`). Write here what changes rarely (structure, flows,
contracts, conventions, environments, procedures), not what changes constantly (function lists,
APIs, UI texts, component behaviour) — that stays in code and specs. Keep pages short. Sections describing something not built yet are marked
**Planned** with the roadmap item that delivers them.
