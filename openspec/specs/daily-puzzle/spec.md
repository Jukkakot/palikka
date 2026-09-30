# daily-puzzle Specification

## Purpose
The daily puzzle ("Päivän pulma"): one shape per day, the same on every device, filled with a given
set of pieces; the fill rule, taking pieces back, the solving time, streaks and personal bests, and
progress kept on the device.

## Requirements

### Requirement: One puzzle per day

Each calendar day (the device's local date) SHALL have one puzzle, derived from the date alone, so
every device shows the same puzzle on the same date. A puzzle SHALL be a connected shape of squares
without enclosed holes and a set of distinct pieces whose sizes add up to the shape's size, and it
SHALL always have a solution. The number of pieces SHALL follow the weekday: 5 on Monday and
Tuesday, 6 on Wednesday and Thursday, 7 on Friday and Saturday, 8 on Sunday; all but two of them
are pentominoes and the other two have 3 or 4 squares.

#### Scenario: Same date, same puzzle

- **WHEN** the puzzle of 2026-10-01 is generated twice
- **THEN** both have the same shape and the same pieces

#### Scenario: Next day differs

- **WHEN** the puzzles of 2026-10-01 and 2026-10-02 are generated
- **THEN** their shapes or pieces differ

#### Scenario: Sunday is the hardest

- **WHEN** the puzzle of Sunday 2026-10-04 is generated
- **THEN** it has 8 pieces, six of them pentominoes

#### Scenario: Always solvable

- **WHEN** the puzzle of any date is generated
- **THEN** its pieces can be placed to cover the shape exactly

### Requirement: Filling the shape

The player SHALL fill the shape with the puzzle's pieces, each used once, rotated and mirrored
freely, with the same piece controls as in a game (tray with only the puzzle's pieces, "Käännä",
"Peilaa", pointer and keyboard preview, "Aseta"). A piece SHALL fit when all its squares are empty
squares of the shape; there is no corner rule and no turn order. A refused spot SHALL show why (off
the shape, overlapping).

#### Scenario: Off the shape

- **WHEN** a piece is aimed so that one square lies outside the shape
- **THEN** the preview is marked as not fitting with the reason "off the shape", and it cannot be placed

#### Scenario: Overlap

- **WHEN** a piece is aimed over a square already covered
- **THEN** it cannot be placed

#### Scenario: Piece already used

- **WHEN** a piece is on the board
- **THEN** its tray slot is empty and it cannot be chosen

### Requirement: Taking pieces back

A tap on a placed piece (outside the current fitting preview) SHALL lift it from the board and make
it the chosen piece in the same orientation, aimed where it was. "Tyhjennä" SHALL remove every
placed piece; it SHALL be disabled when the board is empty.

#### Scenario: Lift a piece

- **WHEN** the player taps a placed piece while no preview covers that square
- **THEN** the piece leaves the board, returns to the tray as the chosen piece, and its preview shows where it was

#### Scenario: Clear

- **WHEN** the player taps "Tyhjennä" with three pieces on the board
- **THEN** the board is empty and all pieces are back in the tray

### Requirement: Solving, time and records

The puzzle SHALL be solved when every piece is on the board. The score SHALL be the solving time,
counted only while the puzzle screen is open and visible. On solving, the device SHALL record the
day's time, the streak of consecutive days solved (continued when the previous day was solved, else
restarted at 1), the longest streak, the number of puzzles solved, and the best time per piece count.
The solved puzzle SHALL show the time, "Uusi ennätys!" when it is the best for that piece count, the
streak, and a share action with a text that does not reveal the solution. A solved puzzle SHALL stay
solved for the rest of the day and SHALL be recorded only once.

#### Scenario: Solved

- **WHEN** the player places the last piece
- **THEN** the time stops, the solved panel shows the time and the streak, and the tray and controls are gone

#### Scenario: Streak continues

- **WHEN** a player who solved yesterday's puzzle solves today's
- **THEN** the streak grows by one

#### Scenario: Streak restarts

- **WHEN** a player who last solved a puzzle three days ago solves today's
- **THEN** the streak is 1 and the longest streak is kept

#### Scenario: Personal best

- **WHEN** the player solves a 7-piece puzzle faster than any 7-piece puzzle before
- **THEN** the solved panel says "Uusi ennätys!" and the best time for 7 pieces is updated

#### Scenario: Share

- **WHEN** the player taps "Jaa" on a solved puzzle
- **THEN** the share text names the date, the piece count, the time and the streak, and no piece positions

### Requirement: Progress is kept

The pieces on the board and the time so far SHALL be saved on the device, so closing the puzzle or
the app and opening it again on the same day continues where the player was. Progress of an earlier
day SHALL be dropped; the new day's puzzle starts empty.

#### Scenario: Continue later

- **WHEN** the player places two pieces, closes the app and opens the puzzle again the same day
- **THEN** the two pieces are on the board and the clock continues from the saved time

#### Scenario: New day

- **WHEN** the player opens the puzzle the day after leaving it unfinished
- **THEN** the new day's puzzle is shown with an empty board and the clock at 0:00
