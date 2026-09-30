## ADDED Requirements

### Requirement: Bots play for their side

A bot SHALL choose its moves for the player it plays, not for one colour alone: when that player
plays several colours, the bot SHALL rate a position by the player's total score and chances, and
its search SHALL NOT treat the player's other colour as an opponent. When the bot plays the shared
colour's turn, it SHALL choose the shared colour's move that is best for the player whose turn it is
to play it. Bots SHALL play every variant, including the Duo board.

#### Scenario: Partner colour is not an opponent

- **WHEN** a bot plays colours 1 and 3 in Tuplaväri and searches colour 1's move
- **THEN** its search looks at replies from colours 2 and 4 only

#### Scenario: Shared colour for its player

- **WHEN** in Kolmikko a bot plays colour 4's turn for seat 2
- **THEN** it places a legal colour-4 piece chosen for seat 2's benefit

#### Scenario: Duo

- **WHEN** two bots play a Duo game
- **THEN** every move is legal and the game ends with a result
