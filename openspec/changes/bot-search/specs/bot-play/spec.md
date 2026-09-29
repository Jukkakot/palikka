## MODIFIED Requirements

### Requirement: The bot respects its budget

Every request SHALL carry a budget: a time limit, a search depth, a number of iterations, or a
combination of these. A bot SHALL stop at whichever limit runs out first. Once the time limit has
passed, the bot SHALL return the best move found so far (it always rates at least one move). A bot
SHALL ignore a limit that does not apply to it: a one-ply bot treats any depth of one or more as
its whole search and ignores iterations. A search that plays out positions ignores depth. A budget
with no limit, or with a limit that is not a positive number, SHALL be refused.

#### Scenario: Time runs out

- **WHEN** the time limit passes while the bot is still rating moves
- **THEN** it returns the best of the moves rated so far, which is a legal move

#### Scenario: Limit that does not apply

- **WHEN** the greedy bot is asked with a budget of 300 iterations
- **THEN** it plays its one-ply move as it would with a depth of 1

## ADDED Requirements

### Requirement: The strongest bot plays people

The bot on a bot seat, in device games and online, SHALL be the bot that measured strongest at the
time budget it gets there. That bot SHALL be a search bot, not the greedy one. Its move SHALL be
computed during the pause people see before a bot moves, and the pause SHALL NOT grow because of
the computing. Only when the computing takes longer than the pause does the move come later. The
hint for a person's move MAY use a faster bot.

#### Scenario: Device game

- **WHEN** a bot's turn comes in a game against bots on the device
- **THEN** the bot's move appears after the usual pause, and it is the search bot's choice

#### Scenario: Pause not stretched

- **WHEN** the bot's move is ready before the pause ends
- **THEN** the move is shown when the pause ends, not a full pause after the computing
