## ADDED Requirements

### Requirement: Daily puzzle entry

The start screen SHALL offer the daily puzzle ("Päivän pulma") below the two ways in, as a
secondary entry that needs neither a valid nickname nor the server. When today's puzzle is already
solved, the entry SHALL say so with the time and the streak, and still open the puzzle.

#### Scenario: Open the puzzle

- **WHEN** a player taps "Avaa pulma" while the server is still waking up
- **THEN** today's puzzle opens

#### Scenario: Already solved

- **WHEN** today's puzzle was solved in 2:34 with a streak of 3
- **THEN** the entry shows the time 2:34 and the streak 3, and its button opens the solved puzzle
