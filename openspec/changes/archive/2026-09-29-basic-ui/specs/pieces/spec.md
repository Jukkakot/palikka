# Spec Delta

## ADDED Requirements

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
