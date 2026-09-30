## MODIFIED Requirements

### Requirement: Bot moves are validated

The runner SHALL send a bot's move for the seat it plays, after a pause of about one second from the
start of the turn so people can follow. The server SHALL accept it only from the runner
(`NOT_BOT_RUNNER` otherwise), only for a seat the bot plays (`NOT_BOT_SEAT` otherwise) that plays
the colour on turn (`NOT_YOUR_TURN` otherwise), and only when the move is legal (the rules'
refusal otherwise); a refused bot move SHALL change nothing. Seats the bot plays are bot seats and
the seats of people who handed their turn to the bot or whose connection dropped.

#### Scenario: Runner moves for a bot

- **WHEN** a bot's turn starts and the runner sends a legal move for that seat
- **THEN** the move is accepted and the next colour is on turn

#### Scenario: Someone else sends a bot move

- **WHEN** a seated person who is not the runner sends a move for a bot's seat
- **THEN** it is refused with `NOT_BOT_RUNNER`

#### Scenario: Not a bot's seat

- **WHEN** the runner sends a bot move for a seat a connected person plays themselves
- **THEN** it is refused with `NOT_BOT_SEAT`

#### Scenario: Bot plays the shared colour

- **WHEN** in Kolmikko colour 4 is on turn and a bot's seat plays it this time
- **THEN** the runner's move for that bot seat is accepted in colour 4
