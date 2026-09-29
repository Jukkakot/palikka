## MODIFIED Requirements

### Requirement: Bots are chosen by name and budget

A tournament SHALL take its bots as names from a fixed list of known bots, each optionally with a
budget: a time limit in milliseconds (`greedy@200ms`), a search depth (`brs@d2`) or a number of
iterations (`mcts@i400`). The known bots SHALL include `random`, `greedy` and the search bots `brs`
and `mcts`. A bot without a budget SHALL use its own default budget. An unknown name, a malformed
budget, fewer than two bots or the same bot twice SHALL be refused before any game is played, with
a message that lists the known bots.

#### Scenario: Budget in the name

- **WHEN** a tournament is started with the bots `random` and `greedy@200ms`
- **THEN** the greedy bot gets 200 ms per move and the random bot its default budget

#### Scenario: Iteration budget

- **WHEN** a tournament is started with the bots `greedy` and `mcts@i400`
- **THEN** the MCTS bot gets 400 iterations per move, with no time limit

#### Scenario: Unknown bot

- **WHEN** a tournament is started with a bot name that is not in the list
- **THEN** no game is played and the message names the unknown bot and lists the known ones

### Requirement: Strength requirements

The repository SHALL keep a list of strength requirements. Each one reads "candidate beats
baseline with a score share of at least X over N games in format F", with budgets as in the names.
Checking them SHALL play exactly those matches (first seed fixed per requirement) and report each
one's measured share against its threshold. The check SHALL fail when any requirement is not met,
naming it, and pass otherwise. The list SHALL hold "greedy beats random" and "search beats greedy":
the bot people play against, at a machine-independent budget, against greedy, with at least 60 %
over 200 games in the 4-colour format.

#### Scenario: Requirement met

- **WHEN** the check runs "greedy beats random ≥ 90 % over 20 games, 4-colour" and greedy scores 97 %
- **THEN** that requirement passes and is reported with 97 % against 90 %

#### Scenario: Requirement missed

- **WHEN** a requirement's candidate scores below its threshold
- **THEN** the check fails and its output names that requirement, the measured share and the
  threshold

#### Scenario: Search requirement listed

- **WHEN** the strength check runs
- **THEN** it plays "search beats greedy" over 200 games with a 60 % bar
