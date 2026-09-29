## 1. Import and rename

- [x] 1.1 Import Labyrinth's tracked files (without its specs, changes and generated OpenSpec skills) as the first commit
- [x] 1.2 Rename labyrinth → palikka everywhere (packages, service, dataset, texts)

## 2. Placeholder game

- [x] 2.1 Rules: board, claim-a-cell engine, bot, daily puzzle, testing fixtures; unit and property tests
- [x] 2.2 Protocol: `place` command, phases, `CELL_TAKEN`, no looks; schema tests
- [x] 2.3 Server: synced cells, `place`, one-step bot turn; room tests adapted
- [x] 2.4 Client: view model, board, seat marks, place controls, hint, LocalRoom, daily puzzle, tips, how-to, texts; tests adapted
- [x] 2.5 E2E smoke: two players, host starts, a square syncs

## 3. Theme and environment

- [x] 3.1 Kuura tokens (light and dark), icon and PWA colours; UI check in both themes
- [x] 3.2 Own dev ports 2577/5183; health URL from the repo variable

## 4. Instructions and docs

- [x] 4.1 `.claude/CLAUDE.md`, OpenSpec init, `openspec/config.yaml` context
- [x] 4.2 `openspec/context` nfr adapted, product and roadmap written for Palikka
- [x] 4.3 Wiki pages, one-time setup steps, `docs/template.md`
