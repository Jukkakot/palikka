# Spec Delta

## Purpose

Defines the game variants (Perus, Duo, Tuplaväri, Kolmikko): each one's board and start squares,
how many players it takes, which colours each player plays, the shared colour's rotation, and how
players are scored and win.

## ADDED Requirements

### Requirement: Variants

Every game SHALL have exactly one variant, fixed when the game starts:

| Variant | Board | Players | Colours |
|---|---|---|---|
| Perus | 20×20, start corners as today | 2–4 | one colour per player: the seat's own colour |
| Duo | 14×14 | exactly 2 | the first player colour 1, the second colour 2 |
| Tuplaväri | 20×20, start corners as today | exactly 2 | the first player colours 1 and 3, the second colours 2 and 4 |
| Kolmikko | 20×20, start corners as today | exactly 3 | the players colours 1, 2 and 3 in seat order; colour 4 is shared |

"First", "second" and "in seat order" SHALL mean the seated players in ascending seat order. In
every variant the colours play in ascending colour order among the colours in the game, and colour
1 moves first. A variant with no stated variant SHALL be Perus.

#### Scenario: Default

- **WHEN** a game starts without a variant being chosen
- **THEN** it is Perus on the 20×20 board and every player plays their seat's colour

#### Scenario: Tuplaväri colours

- **WHEN** a Tuplaväri game starts with players in seats 1 and 2
- **THEN** the player in seat 1 plays colours 1 and 3, the player in seat 2 plays colours 2 and 4,
  and colour 1 is on turn

#### Scenario: Seats with a gap

- **WHEN** a Duo game starts with players in seats 1 and 3
- **THEN** the player in seat 1 plays colour 1 and the player in seat 3 plays colour 2

#### Scenario: Wrong number of players

- **WHEN** a Kolmikko game is to start with two players
- **THEN** the start is refused

### Requirement: Duo board

The Duo board SHALL be 14×14 squares. Colour 1's start square SHALL be row 5, column 5 and colour
2's start square row 10, column 10 (counted from 1 at the top-left). All placement rules SHALL be
the same as on the classic board: the first piece covers the start square, later pieces touch their
own colour corner to corner and never edge to edge.

#### Scenario: Duo first move

- **WHEN** colour 1 places its first piece in a Duo game
- **THEN** it is legal only when it covers row 5, column 5

#### Scenario: Board edge

- **WHEN** a Duo placement would reach column 15
- **THEN** it is refused as off the board

### Requirement: The shared colour

In Kolmikko, colour 4 SHALL be played by the players in turn: its first piece by the first player
still in the game (not left), its second piece by the next one, and so on in seat order, wrapping
around, counted over the players who have not left the game at that moment. A player whose own
colour is out but who is still in the game SHALL keep taking the shared colour's turns. The shared
colour SHALL follow the same placement rules and SHALL be passed automatically when it cannot move,
like any colour.

#### Scenario: Rotation

- **WHEN** colour 4 is on turn in a Kolmikko game of seats 1, 2 and 3 for the fourth time
- **THEN** the player in seat 1 plays it (seats 1, 2, 3, then 1 again)

#### Scenario: A player left

- **WHEN** the player in seat 2 has left and colour 4 has placed three pieces
- **THEN** the player in seat 3 plays its fourth piece (seats 1 and 3 remain; three pieces placed,
  so the second of them)

### Requirement: Score and winners per player

A player's score SHALL be the sum of the scores of the colours they play, each colour scored by
the classic rule (−1 per unplaced square, +15 for all pieces, +5 more for the single square last);
the shared colour SHALL count for no player. The player or players with the highest score among
those who did not leave SHALL win; equal scores SHALL share the win. With one colour per player
this is exactly the classic result.

#### Scenario: Tuplaväri score

- **WHEN** a Tuplaväri game ends with colour 1 on −4, colour 3 on −10, colour 2 on −6 and colour 4
  on −7
- **THEN** the first player has −14, the second −13, and the second player wins

#### Scenario: Shared colour does not count

- **WHEN** a Kolmikko game ends with colour 4 on the best score of all colours
- **THEN** the winner is the best of colours 1, 2 and 3, and colour 4 is no one's

### Requirement: Leaving a multi-colour game

When a player leaves a running game, every colour they play SHALL be out from then on and their
squares SHALL stay. The shared colour SHALL go on among the players still in. When only one player
who has not left remains, the game SHALL end at once with that player as the winner.

#### Scenario: Tuplaväri leaver

- **WHEN** in a Tuplaväri game the second player leaves
- **THEN** colours 2 and 4 are out, the game ends and the first player wins

#### Scenario: Kolmikko leaver

- **WHEN** in a Kolmikko game the player in seat 3 leaves
- **THEN** colour 3 is out, colour 4 keeps playing, taken in turn by seats 1 and 2
