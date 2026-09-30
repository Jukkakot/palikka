# device-games Specification

## Purpose
Games that run fully on the device: a person against 1–3 bots, or 2–4 bots to watch, on the same
rules as online games, saved to continue, with undo against bots.

## Requirements

### Requirement: Game against bots on the device

A person SHALL be able to start a game against bots that runs on the device without the server, in
any variant: in Perus against 1–3 bots, in Duo and Tuplaväri against one bot, in Kolmikko against
two bots. The person SHALL be the first player (seat 1) and move first; the bots take the next
seats. The rules, the refusal reasons and the result SHALL be the same as online. Bots SHALL move
after a pause of about one second, computed without blocking the game (off the UI thread). There
SHALL be no turn time limit.

#### Scenario: One bot

- **WHEN** a person starts a Perus game against one bot
- **THEN** colours 1 and 2 play, colour 1 is the person's and on turn, and colour 2 is the bot Kettu

#### Scenario: Bot answers

- **WHEN** the person makes a legal move
- **THEN** the bot makes its move about one second later and the person is on turn again

#### Scenario: Tuplaväri on the device

- **WHEN** a person starts Tuplaväri against a bot
- **THEN** the person plays colours 1 and 3, the bot Kettu plays colours 2 and 4, and colour 1 is on turn

### Requirement: Watching bots on the device

A person SHALL be able to watch a game of bots on the device in any variant (2–4 bots in Perus, the
variant's player count otherwise), speed it up 2× or 4×, and start a new one when it ends. Such a
game SHALL NOT be saved.

#### Scenario: Four bots

- **WHEN** a person starts watching four bots in Perus
- **THEN** colours 1–4 are bots and they play until no colour can move

#### Scenario: Duo bots

- **WHEN** a person starts watching Duo
- **THEN** two bots play on the 14×14 board

### Requirement: Saving and continuing

A game against bots SHALL be saved on the device after every step, so a reload or a reopened app
continues it where it was. A saved game of an older, incompatible format SHALL be dropped without an
error.

#### Scenario: Reload

- **WHEN** the person reloads the page in the middle of a game against bots
- **THEN** the same game continues with the same board and turn

#### Scenario: Old save

- **WHEN** the saved game on the device is in an old format
- **THEN** it is not offered for continuing and a new game can be started

### Requirement: Undo against bots

In a running game against bots on the device, "Peru" SHALL take back the person's own last move
(a move of any colour the person played, the shared colour included) and every bot move made after
it, giving the turn back to the person. It SHALL be possible to repeat it back to the person's first
move, and SHALL NOT be possible when the person has not moved yet, when the game has ended, or while
watching bots. Undo SHALL NOT exist in online games.

#### Scenario: Undo after the bots moved

- **WHEN** the person moved and the two bots answered, and the person taps "Peru"
- **THEN** the board is as it was before the person's move and the person is on turn

#### Scenario: Nothing to undo

- **WHEN** the person has not moved yet
- **THEN** "Peru" is not available

#### Scenario: Undo in Tuplaväri

- **WHEN** in Tuplaväri the person played colour 3 and the bot answered with colour 4, and the person
  taps "Peru"
- **THEN** the board is as before the colour-3 move and colour 3 is on turn again
