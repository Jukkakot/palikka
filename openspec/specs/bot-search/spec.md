# bot-search Specification

## Purpose
Defines how the search bots choose a move: they look ahead at the opponents' replies, return a
move in time under any time limit, can be given machine-independent budgets, and must be
measurably stronger than the greedy bot.

## Requirements

### Requirement: Search looks at the opponents' replies

A search bot SHALL rate its candidate moves by what the opponents can do afterwards, not only by
the position right after its own move. The best-reply bot SHALL assume that after each of its moves
the one opponent whose reply hurts it most makes that reply. The MCTS bot SHALL assume that every
colour plays for itself. Colours that are out SHALL NOT be searched as repliers.

#### Scenario: A move that loses to a reply is avoided

- **WHEN** the move that looks best right after it is played lets an opponent reply with a move
  that costs the mover more than a second-best move would, and the search looks two plies deep
- **THEN** the search bot plays the second-best move, while the greedy bot plays the first

#### Scenario: Only colours still in reply

- **WHEN** a search bot moves while one opponent is out
- **THEN** no reply by that opponent is considered, and the chosen move is legal

### Requirement: Search answers in time and never below one ply

Under a time limit, a search bot SHALL first finish rating every legal move one ply deep (as the
greedy bot does), then search deeper while time remains. When the time runs out it SHALL return the
best move of the deepest search it has finished. If the time runs out during the first one-ply
pass, it SHALL return the best move rated so far. The answer SHALL come no later than the time
limit plus the time of one position's rating work.

#### Scenario: Tiny time limit

- **WHEN** a search bot gets a 1 ms time limit on a position with hundreds of legal moves
- **THEN** it returns a legal move promptly

#### Scenario: Deeper when time allows

- **WHEN** a search bot gets enough time to finish a two-ply search
- **THEN** its answer comes from the two-ply search, not the one-ply pass

### Requirement: Machine-independent budgets

A search bot SHALL accept a budget that does not depend on the machine: the best-reply bot a search
depth in plies, and the MCTS bot a number of iterations. With such a budget and no time limit, the
same position, colour, budget and seed SHALL give the same move on every machine. A budget with
both a time limit and one of these SHALL stop at whichever runs out first.

#### Scenario: Depth budget reproducible

- **WHEN** the best-reply bot is asked twice, on different machines, for the same position, colour,
  seed and a depth of 2
- **THEN** it returns the same move both times

#### Scenario: Iteration budget reproducible

- **WHEN** the MCTS bot is asked twice for the same position, colour, seed and 200 iterations
- **THEN** it returns the same move both times

### Requirement: Search beats greedy

The bot people play against SHALL be a search bot that beats the greedy bot with a score share of
at least 60 % over 200 games in the 4-colour format at a machine-independent budget. This is
checked by the strength requirements, not by the unit tests. Both search bots SHALL stay in the list
of known bots, so they can be compared in tournaments.

#### Scenario: Strength requirement

- **WHEN** the strength check runs
- **THEN** it includes "search beats greedy" with a 60 % bar over 200 games, and the check passes
