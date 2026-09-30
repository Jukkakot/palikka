## MODIFIED Requirements

### Requirement: Piece tray

A seated player SHALL see a tray of 21 pieces for the whole game: the pieces of the colour they play
now when one of their colours (or the shared colour on their turn) is on turn, otherwise of their
own colour that comes next in turn order, always in that colour. A placed piece SHALL leave an empty
slot, so the other pieces keep their places. On the player's turn, a piece that fits nowhere on the
board now SHALL be shown dimmed and SHALL NOT be selectable. Spectators SHALL NOT see a tray.

#### Scenario: Start of the game

- **WHEN** a seated player's game starts
- **THEN** the tray shows 21 pieces in the player's colour

#### Scenario: Placed piece

- **WHEN** the player has placed the five-square straight piece
- **THEN** its slot in the tray is empty and the other pieces are where they were

#### Scenario: Piece that does not fit

- **WHEN** it is the player's turn and a piece of theirs has no legal placement
- **THEN** that piece is dimmed and cannot be selected

#### Scenario: Second colour on turn

- **WHEN** in Tuplaväri colour 3 comes on turn for the player in seat 1
- **THEN** the tray shows colour 3's pieces in colour 3

#### Scenario: Shared colour on turn

- **WHEN** in Kolmikko it is the viewer's turn to play colour 4
- **THEN** the tray shows colour 4's pieces and the turn line says the shared colour is theirs to play
