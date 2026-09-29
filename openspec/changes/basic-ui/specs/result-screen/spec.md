# Spec Delta

## Purpose

What every player and spectator sees when a game ends: the ranked result of every colour with its
score, squares and pieces left, and the ways on from there.

## ADDED Requirements

### Requirement: Result table

When a game has ended, every client SHALL show a table of the colours in the game, ranked by score
(highest first; equal scores share a rank), each row with the rank, the colour, the name, the score,
the squares the colour has on the board and the pieces it has left. Winners SHALL be marked. A
colour that left the game SHALL be marked as left, and SHALL NOT be marked as a winner. The board
SHALL stay visible.

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

### Requirement: Ways on after the game

Under the result a seated player SHALL get "Pelaa uudelleen" and "Alkuun", and a spectator of a
bot-only game SHALL get "Uusi bottipeli" and "Alkuun"; the piece tray and the turn controls SHALL
NOT be shown.

#### Scenario: Seated player

- **WHEN** a game the player sat in has ended
- **THEN** "Pelaa uudelleen" and "Alkuun" are shown and the tray is not
