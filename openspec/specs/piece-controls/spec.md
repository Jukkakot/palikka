# piece-controls Specification

## Purpose
How a player chooses, turns, flips and places their pieces: the piece tray, the placement preview
with its legality and reason, placing by touch, mouse or keyboard, and the hint as a ready preview.

## Requirements

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

### Requirement: Choosing a piece

On their own turn, a player SHALL be able to select one unplaced piece that fits by tapping or
clicking it; selecting another piece replaces the choice and tapping the selected piece again clears
it. Escape SHALL clear it. A piece SHALL start in its first orientation. The choice SHALL be cleared
when the turn ends. Off turn, the tray SHALL NOT be selectable.

#### Scenario: Select

- **WHEN** it is the player's turn and they tap a piece that fits
- **THEN** that piece is marked as chosen

#### Scenario: Not my turn

- **WHEN** it is another colour's turn and the player taps a piece
- **THEN** nothing is chosen

### Requirement: Turning and flipping

With a piece chosen, "Käännä" SHALL turn it a quarter turn clockwise and "Peilaa" SHALL mirror it
left to right; the keys R and F SHALL do the same. The tray slot and the preview SHALL show the new
orientation at once. The preview SHALL keep the square the player pointed at.

#### Scenario: Four turns

- **WHEN** the player turns the chosen L-shaped piece four times
- **THEN** it is back in the orientation it started in

#### Scenario: Keyboard

- **WHEN** a piece is chosen and the player presses F
- **THEN** the piece is mirrored

### Requirement: Placement preview

With a piece chosen on the player's turn, pointing at a board square (mouse), tapping one (touch) or
moving with the arrow keys SHALL show the piece on the board as a preview. For pointing and tapping,
the preview SHALL snap to a legal spot of the chosen orientation that covers the pointed square, the
spot whose reference square is nearest to it; with no such spot, the preview SHALL stay at the
pointed square and be marked illegal. The arrow keys SHALL move the preview one square without
snapping, staying inside the board. A legal preview SHALL be shown in the player's colour, an illegal
one in the warning style together with the reason (the rules' refusal reason). The free corners of
the player's colour SHALL stay marked while they place.

#### Scenario: Snap to a legal spot

- **WHEN** it is colour 1's first turn, the three-square straight piece is chosen lying flat, and the
  player taps the third square of the top row
- **THEN** the preview covers the top-left corner square and the two squares right of it and is legal

#### Scenario: No legal spot

- **WHEN** the player taps a square that no legal spot of the chosen orientation covers
- **THEN** the preview is shown at that square in the warning style with the reason, such as
  "Palikan pitää koskettaa omaa palikkaa kulmasta"

### Requirement: Placing

A legal preview SHALL be placed by a second tap or a click on one of its squares, by Enter, or with
"Aseta"; each SHALL send the same move as the preview shows. An illegal preview SHALL NOT be placed,
and "Aseta" SHALL be disabled while there is no legal preview. While the move is on its way the
controls SHALL wait (no second move); after it is accepted the choice SHALL be cleared, and after a
refusal the refusal SHALL be shown and the choice kept.

#### Scenario: Two taps on a phone

- **WHEN** the player taps a square, sees a legal preview and taps inside it
- **THEN** the piece is placed there and leaves the tray

#### Scenario: Mouse

- **WHEN** a mouse user points at a square where the preview is legal and clicks
- **THEN** the piece is placed with the one click

#### Scenario: Illegal

- **WHEN** the preview is illegal and the player taps inside it
- **THEN** nothing is sent and the reason stays visible

### Requirement: Hint as a preview

"Vihje" SHALL choose the bot's move for the player's turn as the preview: the piece, its
orientation and the spot. The player SHALL be able to place it, move it or choose something else.
The hint SHALL be the same when asked again within the same turn.

#### Scenario: Hint

- **WHEN** it is the player's turn and they tap "Vihje"
- **THEN** a piece is chosen and a legal preview is shown where the bot would place it

#### Scenario: Taking the hint

- **WHEN** the player taps "Aseta" after the hint
- **THEN** the bot's suggested move is played
