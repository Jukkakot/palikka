# Spec Delta

## ADDED Requirements

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
