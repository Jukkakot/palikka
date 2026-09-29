# pieces Specification

## Purpose
Defines the pieces every colour owns and how a piece can be turned and flipped, so that placement,
move generation, scoring and the UI all agree on the same set of shapes.

## Requirements

### Requirement: Piece set

Every colour SHALL own the same 21 pieces: all distinct shapes of 1 to 5 edge-connected squares,
where shapes that differ only by rotation or mirroring are the same piece. By size: one piece of 1
square, one of 2, two of 3, five of 4 and twelve of 5, 89 squares in total. Each piece SHALL have a
stable identifier.

#### Scenario: Counting the set

- **WHEN** the piece set of a colour is listed
- **THEN** it has 21 pieces with sizes 1×1, 1×2, 2×3, 5×4 and 12×5 squares, 89 squares in total

#### Scenario: No duplicate shapes

- **WHEN** any two pieces of the set are compared in every rotation and mirror image
- **THEN** no two are the same shape

### Requirement: Orientations

A piece SHALL be placeable in each of its distinct orientations: the shapes produced by rotating it
in quarter turns and mirroring it, with identical shapes counted once. Each piece SHALL therefore
have 1, 2, 4 or 8 distinct orientations.

#### Scenario: Symmetric pieces

- **WHEN** the orientations of the single square, the 2×2 square and the plus-shaped pentomino are
  listed
- **THEN** each has exactly one orientation

#### Scenario: Asymmetric piece

- **WHEN** the orientations of the F-shaped pentomino are listed
- **THEN** it has 8 distinct orientations

#### Scenario: Total orientations

- **WHEN** the distinct orientations of all 21 pieces are counted
- **THEN** there are 91 in total

#### Scenario: Every orientation is the same piece

- **WHEN** any orientation of a piece is rotated or mirrored
- **THEN** the result is again one of that piece's orientations

### Requirement: Turning and mirroring an orientation

For every orientation of a piece, turning it a quarter turn clockwise and mirroring it left to right
SHALL each give one of that piece's orientations, the one whose shape is the turned or mirrored
shape.

#### Scenario: Four quarter turns

- **WHEN** any orientation of any piece is turned four times
- **THEN** the result is the orientation it started from

#### Scenario: Mirror twice

- **WHEN** any orientation of any piece is mirrored twice
- **THEN** the result is the orientation it started from

#### Scenario: Symmetric piece

- **WHEN** the plus-shaped pentomino is turned or mirrored
- **THEN** it stays in its only orientation
