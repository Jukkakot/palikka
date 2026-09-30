# Proposal

## Why

A match takes 10–20 minutes and needs opponents. The product has promised a short solo reason to
open the app every day since the start ("Päivän pulma", product.md → Modes, roadmap #8): a given
shape to fill with pieces, the same for everyone on a day, with a score and a personal best on the
device. The placeholder puzzle was removed with the placeholder game, so the start screen has no
daily entry now.

## What Changes

- **Daily puzzle ("Päivän pulma")**: each calendar day (device's local date) has one puzzle, generated
  deterministically from the date, so every device shows the same puzzle that day. A puzzle is a
  connected shape of squares and a set of distinct pieces whose squares add up to exactly the shape;
  the player fills the shape with all of them. The puzzle is always solvable (it is generated from a
  solution). Difficulty follows the weekday: 5 pieces on Monday up to 8 on Sunday.
- Placing in the puzzle uses the game's piece controls (tray with only the puzzle's pieces, "Käännä",
  "Peilaa", pointer and keyboard preview) but a puzzle rule: a piece fits when all its squares are
  empty squares of the shape. There is no corner rule and no turn. A placed piece can be taken back
  by tapping it; "Tyhjennä" clears the board.
- **Score**: the solving time (active time only, paused while the screen is closed or hidden).
  Stored on the device: the day's result, the current and longest streak of consecutive days solved,
  the number of puzzles solved, and the best time per piece count (the personal best). A solved
  puzzle shows the time, whether it beat the personal best, the streak, and a share button with a
  spoiler-free text.
- Progress is saved on the device, so leaving and coming back the same day continues where the
  player was.
- The start screen gets a daily-puzzle entry, marked when today's puzzle is already solved.
- The client ships one log event when a puzzle is solved.

Workspaces touched: `packages/rules` (puzzle generator and fit rule), `packages/protocol` (one client
log event), `client` (puzzle screen, store, start screen entry). The server is not touched.

## Capabilities

### New Capabilities

- `daily-puzzle`: the daily puzzle: generation from the date, the fill rule, taking pieces back,
  solving, time, streaks and personal bests, saving progress, sharing.

### Modified Capabilities

- `start-screen`: a daily-puzzle entry.

## Non-Goals

- Online leaderboards, server-side results or anti-cheat (budget 0 €, no server work).
- An archive of past puzzles or playing another day's puzzle.
- Hints or a solver in the UI (the rules' solver exists for tests only).
- The corner rule inside the puzzle (a possible later "corner puzzle" mode).
