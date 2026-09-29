# Spec Delta

## Purpose

Bots in online games: who computes their moves (a player's browser, off the UI thread), how the
server validates them, the server's fallback, and a person's seat played by the bot.

## ADDED Requirements

### Requirement: Bots on seats

In the waiting room the host SHALL be able to seat a bot in a free seat and remove it again. Bots
SHALL be named Kettu, Ilves, Pöllö and Näätä, each game giving a new bot the first name no other bot
in it has. A bot's colour plays by the same rules as a person's.

#### Scenario: First bot

- **WHEN** the host seats a bot in seat 3 of a game with no bots
- **THEN** seat 3 holds a bot named Kettu

### Requirement: Who computes bot moves

A bot's moves in an online game SHALL be computed by the browser of one seated person, the bot
runner: the host while connected, otherwise the connected seated person with the lowest seat.
Spectators SHALL never be the runner. Every client SHALL know which seat is the runner (none when
no seated person is connected). The runner SHALL compute bot moves without blocking its own game
(off the UI thread) within a time budget.

#### Scenario: Host runs the bots

- **WHEN** the host is connected in a started game with bots
- **THEN** the host's seat is the bot runner

#### Scenario: Host drops

- **WHEN** the host's connection drops and the person in seat 2 is connected
- **THEN** seat 2 becomes the bot runner, and the host becomes it again after reconnecting

### Requirement: Bot moves are validated

The runner SHALL send a bot's move for the seat it plays, after a pause of about one second from the
start of the turn so people can follow. The server SHALL accept it only from the runner
(`NOT_BOT_RUNNER` otherwise), only for a seat the bot plays (`NOT_BOT_SEAT` otherwise) that is on
turn (`NOT_YOUR_TURN` otherwise), and only when the move is legal (the rules' refusal otherwise); a
refused bot move SHALL change nothing. Seats the bot plays are bot seats and the seats of people
who handed their turn to the bot or whose connection dropped.

#### Scenario: Runner moves for a bot

- **WHEN** a bot's turn starts and the runner sends a legal move for that seat
- **THEN** the move is accepted and the next colour is on turn

#### Scenario: Someone else sends a bot move

- **WHEN** a seated person who is not the runner sends a move for a bot's seat
- **THEN** it is refused with `NOT_BOT_RUNNER`

#### Scenario: Not a bot's seat

- **WHEN** the runner sends a bot move for a seat a connected person plays themselves
- **THEN** it is refused with `NOT_BOT_SEAT`

### Requirement: Server fallback

The server SHALL play a simple legal move for a seat the bot plays when there is no runner (after
the usual pause, divided by the spectators' speed setting) or when the runner has not delivered an
accepted move within 10 seconds after the pause. Every fallback move SHALL be logged with its
reason.

#### Scenario: No runner

- **WHEN** every person has left and spectators watch the bots play
- **THEN** the server plays the bots' moves itself

#### Scenario: Runner silent

- **WHEN** the runner sends nothing for a bot's turn
- **THEN** the server plays a legal move for that seat about 11 seconds after the turn started

### Requirement: Bot plays a person's seat

A seated person SHALL be able to hand their seat to the bot and take it back while the game runs; a
dropped person's seat SHALL be played by the bot until they reconnect. While the bot plays the seat,
the person's own moves SHALL be refused with `AUTOPLAYING`.

#### Scenario: Handed over on own turn

- **WHEN** the player on turn hands their seat to the bot
- **THEN** the runner makes the move for that seat after the pause
