# start-screen Specification

## Purpose
The first screen: a nickname and two equally visible ways into a game, against bots on the device
or a new game for friends, with the open and running public games as a secondary way in.

## Requirements

### Requirement: Two ways in

The start screen SHALL show the nickname and two equally visible ways in: "Pelaa botteja vastaan"
and "Luo peli kavereille". The bot way SHALL offer a game against 1, 2 or 3 bots, or, with "Pelaan
itse" off, a game of 2, 3 or 4 bots to watch; it SHALL start at once on the device, without waiting
for the server. "Luo peli kavereille" SHALL always create a new online game and open its waiting
room, where the invite link is shared; it SHALL wait while the server wakes up. A continuable game
SHALL still be offered first ("Jatka peliä").

#### Scenario: Bots

- **WHEN** a player chooses two bots in "Pelaa botteja vastaan"
- **THEN** a game against the bots Kettu and Ilves starts on the device

#### Scenario: Friends

- **WHEN** a player taps "Luo peli kavereille" while another public game is waiting for players
- **THEN** a new game is created with the player as its host, and the other game is not joined

#### Scenario: Server asleep

- **WHEN** the server is still waking up
- **THEN** "Luo peli kavereille" is disabled with the wake-up status shown, and the bot way works

### Requirement: Open and running games

The public games of the page's pool that wait for players SHALL be listed for joining and the running
watchable ones for watching, in a secondary section below the two ways in. The section SHALL be
hidden when both lists are empty or the list could not be loaded.

#### Scenario: Nothing to show

- **WHEN** no public game waits or runs
- **THEN** the start screen shows no games section

#### Scenario: A waiting game

- **WHEN** a public game in the same pool waits for players
- **THEN** it is listed with its host and seated count, and a tap joins it

### Requirement: Nickname

The nickname field SHALL be prefilled with a random themed name (or the last one used), with a
button that draws a new one. A way in that needs a nickname SHALL be disabled while the nickname is
invalid, with the reason shown.

#### Scenario: Invalid nickname

- **WHEN** the nickname is one character long
- **THEN** both ways in are disabled and the length rule is shown
