# game-end-and-scoring Specification

## Purpose
Defines how turns pass between colours, when a colour is out, when the game ends, how scores are
counted and who wins, so every screen, room and bot reads the same result.

## Requirements

### Requirement: Turn order

Colours SHALL play in ascending colour order (1, 2, 3, 4), wrapping around, among the colours in
the game. A game SHALL start with a given colour on turn. After a colour places a piece, the turn
SHALL go to the next colour in order that is not out.

#### Scenario: Three colours

- **WHEN** colours 1, 2 and 4 play and colour 2 places a piece
- **THEN** colour 4 is on turn

### Requirement: Automatic passing

A colour with no legal placement when its turn comes SHALL be out for the rest of the game: it is
skipped from then on, without any action. A colour SHALL NOT be able to pass while it has a legal
placement. A colour that has placed all its pieces SHALL also be out.

#### Scenario: Stuck colour is skipped

- **WHEN** the turn would pass to colour 2 and colour 2 has no legal placement
- **THEN** colour 2 is out and the next colour with a legal placement is on turn

#### Scenario: Out for good

- **WHEN** a colour has been marked out
- **THEN** it never gets the turn again in that game

#### Scenario: No voluntary pass

- **WHEN** a colour with a legal placement asks to pass
- **THEN** the request is refused

### Requirement: End of the game

The game SHALL end as soon as every colour is out. A game SHALL also be endable at once from outside
(for example when all players left), with no winner.

#### Scenario: Last colour stuck

- **WHEN** the only colour still in the game places a piece and then has no legal placement
- **THEN** the game has ended

### Requirement: Score

Each colour's score SHALL be computed as: minus one point for every square of its unplaced pieces;
plus 15 points if it placed all 21 pieces; plus 5 more points if, in addition, the last piece it
placed was the single square. The number of squares the colour placed on the board SHALL be
reported alongside the score.

#### Scenario: Pieces left over

- **WHEN** a colour ends with the 5-square I, the 4-square O and the single square unplaced
- **THEN** its score is −10 and it has 79 squares on the board

#### Scenario: All pieces placed

- **WHEN** a colour places all 21 pieces and its last piece is not the single square
- **THEN** its score is +15 and it has 89 squares on the board

#### Scenario: Single square last

- **WHEN** a colour places all 21 pieces with the single square last
- **THEN** its score is +20

### Requirement: Result

When the game ends, the colour or colours with the highest score SHALL win; equal highest scores
SHALL share the win. A game ended from outside SHALL have no winner.

#### Scenario: Shared win

- **WHEN** colours 1 and 3 both end with −4 and the others lower
- **THEN** colours 1 and 3 are both winners

### Requirement: A colour leaves the game

A colour SHALL be able to leave a running game (its player left or was removed). Its placed pieces
SHALL stay on the board, it SHALL be out from then on, and when it was on turn the turn SHALL go to
the next colour that can move. A colour that left SHALL keep its score but SHALL NOT be among the
winners: the result is decided among the colours that did not leave. When only one colour that did
not leave remains, the game SHALL end at once with that colour as the winner.

#### Scenario: Leaver on turn

- **WHEN** colours 1, 2 and 3 play, colour 2 is on turn and leaves
- **THEN** colour 2's squares stay, colour 2 is out and colour 3 is on turn

#### Scenario: Last one standing

- **WHEN** colours 1 and 2 play and colour 1 leaves
- **THEN** the game has ended and colour 2 is the only winner

#### Scenario: Leaver cannot win

- **WHEN** the game ends with the highest score belonging to a colour that left
- **THEN** the winners are the colours with the highest score among those that did not leave
