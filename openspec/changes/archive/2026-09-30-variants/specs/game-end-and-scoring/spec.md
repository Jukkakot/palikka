## MODIFIED Requirements

### Requirement: Result

When the game ends, the player or players with the highest score SHALL win; equal highest scores
SHALL share the win. With one colour per player, a player's score is their colour's score, so the
colour or colours with the highest score win; in variants where a player plays several colours or a
colour is shared, a player's score is set by the variant. A game ended from outside SHALL have no
winner.

#### Scenario: Shared win

- **WHEN** colours 1 and 3 both end with −4 and the others lower
- **THEN** colours 1 and 3 are both winners

#### Scenario: Aborted game

- **WHEN** a game is ended from outside
- **THEN** it has no winner

### Requirement: A colour leaves the game

A colour SHALL be able to leave a running game (its player left or was removed). Its placed pieces
SHALL stay on the board, it SHALL be out from then on, and when it was on turn the turn SHALL go to
the next colour that can move. A colour that left SHALL keep its score but its player SHALL NOT be
among the winners: the result is decided among the players who did not leave. When only one player
who did not leave remains, the game SHALL end at once with that player as the winner.

#### Scenario: Leaver on turn

- **WHEN** colours 1, 2 and 3 play, colour 2 is on turn and leaves
- **THEN** colour 2's squares stay, colour 2 is out and colour 3 is on turn

#### Scenario: Last one standing

- **WHEN** colours 1 and 2 play and colour 1 leaves
- **THEN** the game has ended and colour 2 is the only winner

#### Scenario: Leaver cannot win

- **WHEN** the game ends with the highest score belonging to a colour that left
- **THEN** the winners are the colours with the highest score among those that did not leave
