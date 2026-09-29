# Spec Delta

## Purpose

Defines how bot strength is measured: reproducible seeded matches between named bots with fair
seat rotation, how finished games become pairwise results, how Elo ratings and score shares are
computed and reported, and how checked-in strength requirements pass or fail.

## ADDED Requirements

### Requirement: Bots are chosen by name and budget

A tournament SHALL take its bots as names from a fixed list of known bots, each optionally with a
budget: a time limit in milliseconds (`greedy@200ms`) or a search depth (`greedy@d2`). A bot without
a budget SHALL use its own default budget. An unknown name, a malformed budget, fewer than two bots
or the same bot twice SHALL be refused before any game is played, with a message that lists the
known bots.

#### Scenario: Budget in the name

- **WHEN** a tournament is started with the bots `random` and `greedy@200ms`
- **THEN** the greedy bot gets 200 ms per move and the random bot its default budget

#### Scenario: Unknown bot

- **WHEN** a tournament is started with a bot name that is not in the list
- **THEN** no game is played and the message names the unknown bot and lists the known ones

### Requirement: Matches rotate seats fairly

Every pair of bots in a tournament SHALL play the same number of games against each other (a
round robin). The games of a pairing SHALL come in pairs that share one seed and swap the bots'
seats, so neither bot gains from a seat or from the seed. In the 4-colour format one bot plays
colours 1 and 3 and the other colours 2 and 4 on the classic board; in the 2-colour format they play
colours 1 and 2. The number of games per pairing SHALL be even; an odd number is refused.

#### Scenario: Seat swap with the same seed

- **WHEN** bots A and B play 4 games in the 4-colour format
- **THEN** two seeds are used; with each seed one game has A on colours 1 and 3 and the other has A
  on colours 2 and 4

#### Scenario: Round robin

- **WHEN** a tournament has three bots and 10 games per pairing
- **THEN** each of the three pairings plays 10 games, 30 in all

### Requirement: Tournaments are reproducible

A tournament's results SHALL depend only on its bots, budgets, format, games per pairing and first
seed, as long as no bot's time limit runs out: running it again, or with a different number of
parallel workers, SHALL give the same game results. Budgets with a time limit are allowed but make
the run machine-dependent; the report SHALL say so.

#### Scenario: Same run twice

- **WHEN** the same tournament with depth budgets only is run twice, once on one worker and once
  on four
- **THEN** both runs report the same result for every game

### Requirement: A game becomes pairwise results

When a game ends, every two colours played by different bots SHALL be compared by final score: the
higher score wins the comparison (1 point) and equal scores draw (½ point each). Colours played by
the same bot SHALL NOT be compared. A bot's score share against another is its points divided by
the comparisons between them.

#### Scenario: 4-colour game

- **WHEN** A plays colours 1 and 3, B plays 2 and 4, and the final scores are 1: −5, 2: −10,
  3: −10, 4: −20
- **THEN** A wins the comparisons 1–2 and 1–4 and 3–4, draws 3–2, and gets 3½ of 4 points

#### Scenario: 2-colour game drawn

- **WHEN** in a 2-colour game both colours end on the same score
- **THEN** each bot gets ½ of 1 point

### Requirement: Elo ratings from all results

The tournament SHALL rate every bot on the Elo scale from all its pairwise results together, such
that a bot scoring share p against another is rated 400·log10(p / (1 − p)) above it when those are
the only results. Ratings SHALL NOT depend on the order in which games finished. Every pairing SHALL
also count one virtual draw so that a bot winning every comparison gets a finite rating. One bot is
the anchor at 1000: `random` when it takes part, otherwise the first bot named.

#### Scenario: Equal bots

- **WHEN** two bots score exactly half of the points against each other
- **THEN** both are rated 1000

#### Scenario: Three quarters of the points

- **WHEN** bot A scores 75 % against anchor B over many comparisons
- **THEN** A is rated close to 1191 (400·log10 3 above B), slightly less because of the virtual draw

#### Scenario: Order does not matter

- **WHEN** the same game results are rated in two different orders
- **THEN** the ratings are the same

#### Scenario: Clean sweep

- **WHEN** bot A wins every comparison against bot B
- **THEN** A's rating is finite and above B's

### Requirement: The report

A finished tournament SHALL print a readable report: the setup (bots with budgets, format, games,
first seed, whether time limits made it machine-dependent, the code version), the standings (bot,
rating, games, score share against all others) ordered by rating, and a table of each pairing's
score share with its 95 % interval. It SHALL also write a machine-readable file with the same
setup, ratings and pairings and every game's seed, seats and final scores.

#### Scenario: Two-bot tournament

- **WHEN** a tournament of `random` and `greedy` finishes
- **THEN** the report lists greedy above random with its rating, and the pairing's score share
  with an interval, and the results file holds every game

### Requirement: Strength requirements

The repository SHALL keep a list of strength requirements, each "candidate beats baseline with a
score share of at least X over N games in format F" (with budgets as in the names). Checking them
SHALL play exactly those matches (first seed fixed per requirement) and report each one's measured
share against its threshold. The check SHALL fail when any requirement is not met, naming it, and
pass otherwise. The list SHALL start with greedy against random.

#### Scenario: Requirement met

- **WHEN** the check runs "greedy beats random ≥ 90 % over 20 games, 4-colour" and greedy scores 97 %
- **THEN** that requirement passes and is reported with 97 % against 90 %

#### Scenario: Requirement missed

- **WHEN** a requirement's candidate scores below its threshold
- **THEN** the check fails and its output names that requirement, the measured share and the
  threshold

### Requirement: Strength is checked outside the unit tests

Full tournaments and the strength requirements SHALL run in continuous integration, not in the
unit test run: the strength check SHALL run whenever the bots or the rules change on the main
branch or in a pull request, and a tournament with chosen bots, games and format SHALL be startable
by hand. Its report SHALL be visible on the run's summary page and its results file downloadable
from the run. A failed strength check SHALL NOT stop a deploy.

#### Scenario: Bot change on main

- **WHEN** a commit that changes bot code is pushed to the main branch
- **THEN** the strength check runs and its report appears on the run's summary page
