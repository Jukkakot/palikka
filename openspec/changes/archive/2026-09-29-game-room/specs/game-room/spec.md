# Spec Delta

## Purpose

An online game on the server on the real rules: seats and the start, turns and the time limit,
moves and their refusal, leaving and kicking, the end and the result, and what every client sees.

## ADDED Requirements

### Requirement: Seats and the start

A game SHALL have seats 1–4; a seat is also the player's colour. People take the lowest free seat
in the waiting room, the first person hosts, and the host may seat bots in free seats. The host
SHALL be able to start the game once at least two seats are taken (people and bots together); the
game is then played by exactly the seated colours. The lowest seated colour SHALL have the first
turn.

#### Scenario: Two people and a bot

- **WHEN** people in seats 1 and 2 and a bot in seat 4 are seated and the host starts
- **THEN** the game is played by colours 1, 2 and 4 and colour 1 is on turn

#### Scenario: Host alone

- **WHEN** the host is the only one seated and tries to start
- **THEN** the start is refused with `NOT_ENOUGH_PLAYERS`

#### Scenario: Lowest seat starts

- **WHEN** the seats taken are 2 and 3 and the game starts
- **THEN** colour 2 is on turn

### Requirement: A move

The seated player on turn SHALL make a move by placing one of their colour's unplaced pieces in one
of its orientations at a position on the board. The server SHALL check the move with the rules and
accept it only when it is legal; an accepted move SHALL be seen by every client. A refused move
SHALL change nothing and SHALL be answered with the reason: `NOT_SEATED` (not a player of this
game), `WRONG_PHASE` (the game is not running), `NOT_YOUR_TURN`, `AUTOPLAYING` (the bot plays this
seat now), `INVALID_COMMAND` (malformed or impossible piece, orientation or position), or the rules'
refusal (`PIECE_USED`, `OFF_BOARD`, `OVERLAP`, `EDGE_CONTACT`, `NOT_ON_START`,
`NO_CORNER_CONTACT`). A player SHALL NOT be able to pass.

#### Scenario: Legal first move

- **WHEN** colour 1 on turn places a piece covering the top-left corner square
- **THEN** the move is accepted, every client sees the piece in colour 1, and the next colour is on turn

#### Scenario: Illegal move

- **WHEN** colour 1 on turn places its first piece away from its start corner
- **THEN** the move is refused with `NOT_ON_START` and the board is unchanged

#### Scenario: Not your turn

- **WHEN** colour 2 sends a move while colour 1 is on turn
- **THEN** the move is refused with `NOT_YOUR_TURN`

### Requirement: Turns and passing

After each move the turn SHALL go to the next seated colour in order that can still move; a colour
with no legal move SHALL be passed automatically and stay out for the rest of the game, and every
client SHALL see which colours are out.

#### Scenario: Stuck colour skipped

- **WHEN** colour 1 moves and colour 2 has no legal move left
- **THEN** colour 2 is shown as out and colour 3 is on turn

### Requirement: Turn time limit

Each turn SHALL have a time limit of 120 seconds, shown to every client as the time left. Once it
has run out, any other seated player SHALL be able to remove the player on turn; the player on turn
may still move until then.

#### Scenario: Time up

- **WHEN** the player on turn has not moved within 120 seconds
- **THEN** the other seated players may remove them

#### Scenario: Too early

- **WHEN** another player tries to remove the player on turn before the time is up
- **THEN** the removal is refused with `TURN_NOT_EXPIRED`

### Requirement: Leaving a running game

A player who leaves, is removed after the time limit, or stays disconnected past the seat hold SHALL
leave the game: their squares stay on the board and their colour is out. When one seated colour is
left, it SHALL win at once. When nobody is left (no person seated and nobody watching), the game
SHALL end with no winner.

#### Scenario: One opponent leaves a two-player game

- **WHEN** in a game of colours 1 and 2 the player of colour 2 leaves
- **THEN** the game ends and colour 1 wins

#### Scenario: Leaver on turn

- **WHEN** in a game of three colours the player on turn leaves
- **THEN** their squares stay and the next colour that can move is on turn

### Requirement: End and result

The game SHALL end when no colour can move. Every client SHALL then see each colour's score and
squares on the board and the winner or winners (equal highest scores share the win); a colour that
left the game SHALL NOT be among the winners.

#### Scenario: Shared win

- **WHEN** the game ends with colours 1 and 3 on the same highest score
- **THEN** every client sees colours 1 and 3 as winners

#### Scenario: Leaver has the best score

- **WHEN** the game ends and the colour with the best score had left
- **THEN** the best score among the colours still seated wins

### Requirement: Interim move control

Until the full piece controls arrive, a player on turn SHALL be able to move by tapping a free
corner square of their colour where at least one piece fits (the start corner for the first move);
the client then sends the move that places the largest piece fitting there that covers the square.
Only such squares SHALL be tappable. "Vihje" SHALL show the squares the bot would cover.

#### Scenario: First move

- **WHEN** it is colour 1's first turn and the player taps the top-left corner square
- **THEN** a five-square piece covering that square is placed

#### Scenario: Other squares

- **WHEN** it is the player's turn
- **THEN** only the corner squares where a piece of theirs fits can be tapped
