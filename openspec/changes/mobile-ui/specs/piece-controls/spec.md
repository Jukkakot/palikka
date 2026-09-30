## ADDED Requirements

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

## MODIFIED Requirements

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
