# placement Specification

## Purpose
Defines where a colour may place a piece and what the complete set of legal moves is in any
position, the basis for validating players' moves and for the bots' search.

## Requirements

### Requirement: Board and start corners

The classic board SHALL be 20×20 squares. Each colour SHALL have a start corner square: colour 1
the top-left corner, colour 2 top-right, colour 3 bottom-right and colour 4 bottom-left. A game
SHALL be able to use any subset of the colours; a colour keeps its corner whatever the others are.
The board size and the start squares SHALL be part of a game's configuration, so other boards can
be configured without changing the rules.

#### Scenario: Two colours on the classic board

- **WHEN** a game starts with colours 1 and 3
- **THEN** colour 1 starts from the top-left corner and colour 3 from the bottom-right corner

### Requirement: A legal placement

A placement is one of the colour's unplaced pieces in one of its orientations at a position on the
board. It SHALL be legal only when all of the following hold:

- every square of the piece is on the board;
- no square of the piece is already covered by any piece;
- no square of the piece shares an edge with a square of the same colour;
- for the colour's first piece: one of its squares covers the colour's start corner;
- for every later piece: at least one of its squares touches a square of the same colour corner to
  corner.

Touching other colours by edge or corner SHALL always be allowed. A placed piece SHALL never move
again.

#### Scenario: First piece must cover the start corner

- **WHEN** colour 1 places its first piece so that it does not cover the top-left corner square
- **THEN** the placement is refused

#### Scenario: Corner contact continues the colour

- **WHEN** colour 1 places a later piece that touches one of its own squares only diagonally
- **THEN** the placement is accepted

#### Scenario: Edge contact with the own colour

- **WHEN** colour 1 places a piece that shares an edge with one of its own squares
- **THEN** the placement is refused, even if it also touches the colour diagonally

#### Scenario: No contact with the own colour

- **WHEN** colour 1, after its first piece, places a piece touching none of its own squares
- **THEN** the placement is refused

#### Scenario: Other colours may be touched

- **WHEN** colour 1 places a legal piece that shares edges with colour 2's pieces
- **THEN** the placement is accepted

#### Scenario: Overlap and outside

- **WHEN** a piece would cover an occupied square or reach outside the board
- **THEN** the placement is refused

#### Scenario: A piece is used once

- **WHEN** a colour tries to place a piece it has already placed
- **THEN** the placement is refused

### Requirement: Refusal reasons

A refused placement SHALL come with exactly one reason, checked in this order: the piece is already
placed, the piece is outside the board, it overlaps a piece, it touches the own colour by an edge,
it misses the start corner (first piece), it has no corner contact with the own colour (later
pieces).

#### Scenario: Several faults

- **WHEN** a placement both overlaps a piece and touches the own colour by an edge
- **THEN** the reason given is the overlap

### Requirement: Complete list of legal moves

For any position and colour the rules SHALL list every legal placement exactly once (the same piece
in the same orientation at the same position is one move, however it is found), and nothing else.
The list SHALL be deterministic (the same position gives the same order). Each move SHALL have a
compact, stable encoding that decodes back to the same piece, orientation and position.

#### Scenario: Matches the definition

- **WHEN** random positions reached by random legal play are examined
- **THEN** the listed moves are exactly the placements that satisfy the legal placement rules,
  each once

#### Scenario: Opening moves

- **WHEN** colour 1 has placed nothing on an empty classic board
- **THEN** every listed move covers the top-left corner, and there are exactly 58 of them (one per
  distinct piece orientation that can cover the corner square from inside the board)

#### Scenario: Encoding round trip

- **WHEN** any listed move is encoded and decoded
- **THEN** the result is the same piece, orientation and position
