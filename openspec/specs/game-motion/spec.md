# game-motion Specification

## Purpose
Motion and last-move feedback on the game and puzzle screens, so a person can always see what just
happened: the last move marked on the board, short restrained animations in play, a playful
celebration at the end, and no movement for people who ask for reduced motion.

## Requirements

### Requirement: Last move marked on the board

Every client showing a running game (seated players and spectators) SHALL mark on the board the
squares that the most recent board update filled, until the next update fills squares. When one
update brings several moves at once, the squares of all of them SHALL be marked. An update that only
removes pieces (undo) SHALL clear the marking. The first board a client shows (opening or reloading a
game, joining as a spectator, reconnecting) SHALL have no marking. The marking SHALL be visible in
both the light and the dark theme without hiding the piece's colour, and SHALL be removed when the
game ends.

#### Scenario: Bot move marked

- **WHEN** a bot places a piece while the person waits
- **THEN** the squares of that piece are marked on the person's board until the next move is made

#### Scenario: Next move moves the mark

- **WHEN** the next colour places a piece
- **THEN** only the squares of the new piece are marked

#### Scenario: Several moves at once

- **WHEN** a board update brings two new pieces at once
- **THEN** the squares of both pieces are marked

#### Scenario: Undo clears the mark

- **WHEN** the person takes back their last move in a game against bots
- **THEN** no squares are marked

#### Scenario: Reloaded game

- **WHEN** a saved game against bots is opened again
- **THEN** no squares are marked until the next move

### Requirement: Placing animation

When squares are filled on the board, in a game or in the daily puzzle, each newly filled square
SHALL settle into place with a short animation of at most 250 ms, whoever made the move. A placed
piece SHALL leave its tray slot with a short fade. An attempt to place an illegal preview (a tap or
Enter on an illegal preview, or letting go of a drag on an illegal spot) SHALL shake the preview
briefly; no move is sent, as before.

#### Scenario: Own move settles

- **WHEN** the player's move is accepted
- **THEN** the piece's squares settle into place with a short animation and its tray slot fades out

#### Scenario: Illegal attempt shakes

- **WHEN** the player taps an illegal preview
- **THEN** the preview shakes briefly and no move is made

#### Scenario: Puzzle piece settles

- **WHEN** the player places a piece in the daily puzzle
- **THEN** its squares settle into place with the same animation

### Requirement: Turn and out in the player strip

The player strip SHALL mark the chip of the seat on turn, and the mark SHALL move to the next seat
with a short transition when the turn changes. When a seat's last colour goes out, its chip SHALL
"freeze" with a short frost animation and then keep a frosted look (with the struck-through score as
before).

#### Scenario: Turn moves

- **WHEN** the turn goes from seat 1 to seat 2
- **THEN** the turn mark moves from seat 1's chip to seat 2's chip with a short transition

#### Scenario: Seat goes out

- **WHEN** seat 3's colour has no legal move and goes out
- **THEN** seat 3's chip freezes with a short animation and stays frosted

### Requirement: Hint feedback

Each press of "Vihje" that shows a hint SHALL pulse the shown preview once.

#### Scenario: Hint pulses

- **WHEN** the player presses "Vihje"
- **THEN** the hint's preview appears on the board with a single pulse

### Requirement: Celebration at the end

When a game ends with at least one winner, the result table's scores SHALL count up to their final
values within about one second, and the winners' rows SHALL get a short frost shimmer. When the
viewer is among the winners, or when a spectator watches a game end, a short snowfall SHALL cross the
screen once (at most about 2.5 s). A game ended with no winner SHALL get no celebration. When the
daily puzzle is solved, the same snowfall SHALL run once over the solved panel. The celebration SHALL
never block the buttons under the result, and SHALL play only once per ended game or solved puzzle
(not again after a reload).

#### Scenario: Viewer wins

- **WHEN** a game ends and the viewer is a winner
- **THEN** the scores count up, the viewer's row shimmers, and snow falls across the screen once

#### Scenario: Viewer loses

- **WHEN** a game ends and the viewer is not a winner
- **THEN** the scores count up and the winners' rows shimmer, with no snowfall

#### Scenario: No winner

- **WHEN** a game ends from outside with no winner
- **THEN** the result is shown without counting up, shimmer or snowfall

#### Scenario: Buttons usable at once

- **WHEN** the snowfall is running
- **THEN** "Pelaa uudelleen" and "Alkuun" can be pressed

#### Scenario: Puzzle solved

- **WHEN** the player places the last piece of the daily puzzle
- **THEN** snow falls once over the solved panel

### Requirement: Reduced motion

When the device asks for reduced motion, no animation of this capability SHALL move: squares, tray
pieces, chips and previews SHALL change at once, scores SHALL show their final values, and there
SHALL be no snowfall. The last-move marking, the turn mark, the frosted chips and the frozen tray
pieces SHALL still be shown as static styles.

#### Scenario: Reduced motion

- **WHEN** a bot moves on a device that asks for reduced motion
- **THEN** its squares appear at once and are marked as the last move
