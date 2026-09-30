# Tasks

## 1. Rules: the puzzle

- [x] 1.1 `puzzle.ts` in `packages/rules`: `PUZZLE_VERSION`, date seed (FNV-1a), weekday piece
  counts and piece draw, packing generator (contact ≥ max − 1, hole check, retries), crop and centre;
  exported from the index. Tests "Same date, same puzzle", "Next day differs", "Sunday is the
  hardest" pass
- [x] 1.2 `puzzleFits` (`PIECE_USED`, `OFF_SHAPE`, `OVERLAP`) and `puzzleSolved`; tests "Off the
  shape", "Overlap", "Piece already used" and solved-by-solution pass
- [x] 1.3 Property test (fast-check) over random dates 2020–2040: solution fits and solves, shape
  connected and hole-free, sizes add up, board ≤ 16 ("Always solvable"); 365 days generate in < 2 s;
  `npm test -w @palikka/rules` passes

## 2. Protocol

- [x] 2.1 `client.puzzle.solved` in the client log events and key events; protocol tests pass

## 3. Client

- [x] 3.1 `puzzleStore.ts`: load/save progress, record a solve (streak, longest, solved count, best
  per piece count, once per day), version drop, broken storage; tests "Streak continues", "Streak
  restarts", "Personal best", "Continue later", "New day" at store level pass
- [x] 3.2 `puzzlePlacing.ts`: preview with snap / exact and refusal reason, greedy colouring; tests
  pass
- [x] 3.3 `usePuzzle.ts`: choose, turn, mirror, point, click (place / lift), clear, clock (visible
  only), save, solve recorded once and logged; tests "Lift a piece", "Clear", "Solved" pass
- [x] 3.4 `Board` `outside` prop and `PieceTray` `pieces` prop (optional; existing tests unchanged)
- [x] 3.5 `PuzzleScreen.tsx` (+ CSS module): top bar with back and time, status line, board,
  controls bar, tray; solved panel with time, record, streak and "Jaa" (`shareOrCopy`); fi/en texts
  in the Kuura voice; render test for the solved panel ("Share" text has no positions)
- [x] 3.6 Start screen entry (lazy-loaded screen), solved state with time and streak; render test
  "Open the puzzle" and "Already solved"
- [x] 3.7 UI check (Playwright `playwright-mobile`, portrait, light and dark): start entry, puzzle
  in progress with a refused preview, solved panel; screenshots under `.playwright-mcp/`

## 4. Docs and wrap-up

- [x] 4.1 Wiki: `docs/architecture.md` (rules puzzle module, client `puzzle/`, daily puzzle
  Planned → Implemented), `openspec/context/product.md` (daily puzzle decided); roadmap item 8
  marked done
- [x] 4.2 Check chain passes: `npm run lint && npm run typecheck && npm test && npm run build && npm
  run size -w @palikka/client`

Note: 4.1 wiki and product.md are done on the branch; the roadmap row is marked done at the merge
into `main` (the branch runs in parallel with `variants`, which edits the roadmap too).
