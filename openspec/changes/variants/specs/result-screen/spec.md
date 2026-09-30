## MODIFIED Requirements

### Requirement: Result table

When a game has ended, every client SHALL show a table of the players in the game, ranked by score
(highest first; equal scores share a rank), each row with the rank, the player's colour or colours,
the name, the score, the squares the player's colours have on the board and the pieces they have
left. Winners SHALL be marked. A player who left the game SHALL be marked as left, and SHALL NOT be
marked as a winner. A shared colour SHALL be shown after the players, with its squares and pieces
left, marked as not counted and without a rank. The board SHALL stay visible.

#### Scenario: Ranked rows

- **WHEN** a two-colour game ends with colour 2 on −3 and colour 1 on −10
- **THEN** the table lists colour 2 first as the winner and colour 1 second, each with its squares and
  pieces left

#### Scenario: Shared rank

- **WHEN** colours 1 and 3 end on the same highest score
- **THEN** both rows show rank 1 and both are marked as winners

#### Scenario: Leaver

- **WHEN** colour 4 left during the game
- **THEN** its row is marked as left and it is not a winner

#### Scenario: Two colours per player

- **WHEN** a Tuplaväri game ends
- **THEN** the table has two rows, each showing both of the player's colours and their summed score

#### Scenario: Shared colour row

- **WHEN** a Kolmikko game ends
- **THEN** colour 4 is shown below the three players as not counted, without a rank
