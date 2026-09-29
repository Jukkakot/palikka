# bot-play Specification

## Purpose
Defines how a computer player chooses its move: always legal, reproducible for a seed, within a
budget, and by a heuristic that is measurably stronger than random play.

## Requirements

### Requirement: The bot plays a legal move of its colour

Asked for a move for a colour in a position, the bot SHALL return one placement that is legal for
that colour in that position. When the colour has no legal move, or the game has ended, it SHALL
return no move instead of failing.

#### Scenario: First move covers the start corner

- **WHEN** the bot is asked for colour 1's move on an empty classic board
- **THEN** it returns a legal placement that covers colour 1's start corner

#### Scenario: Legal moves through a whole game

- **WHEN** bots play every colour of a 4-colour classic game to its end
- **THEN** every placement they return is accepted by the rules

#### Scenario: No move available

- **WHEN** the bot is asked for a move of a colour that is out, or in an ended game
- **THEN** it returns no move

### Requirement: Same position and seed, same move

The bot's choice SHALL depend only on the position, the colour, the seed and the budget (as long as
a time budget is not exhausted). Among equally rated moves the seed decides, so different seeds
may choose differently.

#### Scenario: Repeated question

- **WHEN** the bot is asked twice for the same position, colour, budget and seed
- **THEN** it returns the same placement both times

#### Scenario: Seed breaks ties

- **WHEN** several moves are rated equally best and the bot is asked with different seeds
- **THEN** it may return different moves among those best ones, and never a worse-rated one

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

### Requirement: Greedy heuristic

The greedy bot SHALL rate each of its legal moves by the position right after it and play the
best-rated one. The rating SHALL reward, for the moving colour: squares placed (bigger pieces
first), its own free corner squares (where it can still touch down), and the empty space it can
reach sooner than the others; and it SHALL penalise the opponents' free corners and space, so
blocking them counts.

#### Scenario: Bigger piece preferred

- **WHEN** the bot makes a colour's first move on an empty classic board, or compares a line of
  two squares with a line of three on the same spot
- **THEN** it opens with a five-square piece, and rates the longer line higher

#### Scenario: Blocking an opponent's corner counts

- **WHEN** two moves place equal pieces and leave the mover as many free corners, but one also
  covers an opponent's free corner square
- **THEN** the bot rates the blocking move higher

### Requirement: Greedy bot is stronger than random play

The greedy bot SHALL clearly beat a player that picks a uniformly random legal move, measured over
a fixed set of seeded games (a fast check in every test run; heavier tournaments belong to the
tournament driver).

#### Scenario: One greedy bot against three random players

- **WHEN** one greedy bot plays three random players on the classic board over a fixed set of
  seeded games, rotating its seat
- **THEN** the greedy bot wins (alone or shared) at least 90 % of the games

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
