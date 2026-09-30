# piece-controls Specification

## Purpose
How a player chooses, turns, flips and places their pieces: the piece tray, the placement preview
with its legality and reason, placing by touch, mouse or keyboard, and the hint as a ready preview.

## Requirements

### Requirement: Piece tray

A seated player SHALL see a tray of 21 pieces for the whole game: the pieces of the colour they play
now when one of their colours (or the shared colour on their turn) is on turn, otherwise of their
own colour that comes next in turn order, always in that colour. A placed piece SHALL leave an empty
slot, so the other pieces keep their places. At all times while the game runs, on and off the
player's turn, a piece of the shown colour that fits nowhere on the board now SHALL be shown frozen
(a frosted look, not in the colour) and SHALL NOT be selectable. When a piece becomes frozen while
the tray is shown (another colour's move took its last spot), it SHALL freeze with a short
animation; pieces already frozen when the tray first shows SHALL appear frozen without one.
Spectators SHALL NOT see a tray.

#### Scenario: Start of the game

- **WHEN** a seated player's game starts
- **THEN** the tray shows 21 pieces in the player's colour

#### Scenario: Placed piece

- **WHEN** the player has placed the five-square straight piece
- **THEN** its slot in the tray is empty and the other pieces are where they were

#### Scenario: Piece that does not fit

- **WHEN** it is the player's turn and a piece of theirs has no legal placement
- **THEN** that piece is shown frozen and cannot be selected

#### Scenario: Frozen off turn

- **WHEN** it is another colour's turn and a piece of the player's shown colour has no legal placement
- **THEN** that piece is already shown frozen in the tray

#### Scenario: Piece lost to another move

- **WHEN** a bot's move takes the last spot where one of the player's pieces fitted
- **THEN** that piece freezes in the tray with a short animation right after the bot's move

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

"Vihje" SHALL choose the bot's best move for the player's turn as the preview: the piece, its
orientation and the spot. Pressing "Vihje" again in the same turn SHALL step to the second and then
the third best move, and then back to the best, showing which one is shown (e.g. "Vihje 2/3"); with
fewer legal moves, fewer are offered. The player SHALL be able to place the shown move, move it or
choose something else. The hints SHALL be the same when asked again within the same turn.

#### Scenario: Hint

- **WHEN** it is the player's turn and they tap "Vihje"
- **THEN** a piece is chosen and a legal preview is shown where the bot would place it

#### Scenario: Taking the hint

- **WHEN** the player taps "Aseta" after the hint
- **THEN** the bot's suggested move is played

#### Scenario: Second best

- **WHEN** the player taps "Vihje" twice in the same turn
- **THEN** the preview shows the bot's second-best move and "Vihje 2/3" is shown

### Requirement: Corner first

On their turn, with no piece chosen, a player SHALL be able to tap one of their free corners to
narrow the tray to the pieces that have a legal placement covering that corner; the others SHALL be
dimmed and not selectable. Choosing a piece then SHALL show its first legal placement covering the
corner as the preview, and "‹" / "›" SHALL step through only that piece's legal placements covering
the corner, with the position shown (e.g. "3/7"), wrapping around. Placing SHALL work as for any
legal preview. Tapping another free corner SHALL switch to it; tapping a square that is not a free
corner, tapping the chosen piece again, or pressing R or F SHALL leave the corner mode and continue
with the normal controls. Choosing a piece first and then aiming SHALL keep working as before.

#### Scenario: Tap a corner

- **WHEN** it is the player's turn, no piece is chosen, and they tap a free corner
- **THEN** only the pieces that can cover that corner are selectable, and the status says so

#### Scenario: Step through spots

- **WHEN** in corner mode the player chooses a piece with seven legal placements covering the corner and taps "›" twice
- **THEN** the third of those placements is the preview and "3/7" is shown

#### Scenario: Only one piece fits

- **WHEN** the player taps a free corner that exactly one of their pieces can cover
- **THEN** that piece is chosen at once and its first spot on the corner is the preview

#### Scenario: Place from corner mode

- **WHEN** the player taps inside the corner-mode preview
- **THEN** that move is placed

#### Scenario: Leave corner mode

- **WHEN** in corner mode the player taps a square that is not a free corner
- **THEN** the normal controls ("Käännä", "Peilaa") return and the chosen piece stays chosen

### Requirement: Dragging a piece

A player SHALL be able to drag a piece from the tray onto the board, and drag the current preview
on the board, on their turn. While dragging, the piece SHALL follow the pointer (for touch, drawn
above the finger), and the board SHALL show live, at every moment, exactly where the piece would
land if let go now. A legal landing spot SHALL be shown in the player's colour and an illegal one
in the warning style with the reason in the status line; the dragged piece SHALL show the same
difference. The landing spot SHALL snap only to a legal spot at most one square away from where the
piece is held; farther away it SHALL be the spot under the piece, shown as illegal. Letting go over
the board SHALL leave the landing spot as the preview without placing it; letting go outside the
board SHALL cancel the drag and keep the piece chosen. A short tap on a tray piece SHALL still just
choose it.

#### Scenario: Drag from the tray

- **WHEN** the player drags a fitting piece from the tray and lets go over a square where it fits
- **THEN** the piece is the chosen piece, its legal preview is at that spot, and nothing is placed yet

#### Scenario: Live landing spot

- **WHEN** the player drags a piece over the board from a spot where it fits to one where it touches their own piece edge to edge
- **THEN** the landing spot is first shown in their colour, then in the warning style with the reason, following the piece as it moves

#### Scenario: No far jumps

- **WHEN** the player holds a piece three squares away from the nearest spot where it fits
- **THEN** the landing spot is under the piece and shown as illegal, not at the distant legal spot

#### Scenario: Move the preview

- **WHEN** the player drags a legal preview two squares to the right
- **THEN** the landing spot follows it, snapping to a legal spot next to the new place when there is one

#### Scenario: Drop outside

- **WHEN** the player lets go of a dragged piece outside the board
- **THEN** the drag ends, the piece stays chosen and no move is sent

### Requirement: Board turned to the player on a phone

In the phone layout, a seated player SHALL see the board turned in quarter turns so that their own
start corner (in Duo, their start square) is in the bottom-left; a player with two colours SHALL see
it turned for their first colour for the whole game. Only the view SHALL turn: the tray and the
preview SHALL show pieces as they will lie on screen, "Käännä" SHALL turn clockwise and "Peilaa"
SHALL mirror left to right as seen, and the arrow keys SHALL move in screen directions. Spectators
and the wide layout SHALL see the board unturned.

#### Scenario: Seat 2 on a phone

- **WHEN** the player of seat 2 (start corner top-right) plays in the phone layout
- **THEN** the board is shown turned half a turn, with their start corner at the bottom-left

#### Scenario: What you see is what you place

- **WHEN** on a turned board the tray shows the chosen L-shaped piece with its foot to the right and the player places it
- **THEN** the placed piece on screen has its foot to the right

#### Scenario: Wide screen

- **WHEN** the same player uses the wide layout
- **THEN** the board is not turned

### Requirement: Zoom to own corners on a phone

In the phone layout, on the player's turn, the board SHALL zoom to the area around their free
corners, showing at least 10×10 squares and never cutting off the current preview. Off turn, at the
end of the game, or when the area would be nearly the whole board, the whole board SHALL be shown. A
toggle SHALL turn the zoom off and on, remembered on the device.

#### Scenario: Zoom on turn

- **WHEN** it is the player's turn in the phone layout and their free corners lie in one quarter of the board
- **THEN** the board zooms to that area

#### Scenario: Toggle off

- **WHEN** the player turns the zoom off
- **THEN** the whole board is shown on their turns from then on, also after a reload
