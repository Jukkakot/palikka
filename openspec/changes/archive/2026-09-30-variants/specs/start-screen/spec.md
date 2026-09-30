## MODIFIED Requirements

### Requirement: Two ways in

The start screen SHALL show the nickname and two equally visible ways in: "Pelaa botteja vastaan"
and "Luo peli kavereille". The bot way SHALL offer the variant (Perus by default) and, in Perus, a
game against 1, 2 or 3 bots, or, with "Pelaan itse" off, a game of 2, 3 or 4 bots to watch; in the
other variants the number of bots follows from the variant. It SHALL start at once on the device,
without waiting for the server. "Luo peli kavereille" SHALL always create a new online game and
open its waiting room, where the invite link is shared and the host chooses the variant; it SHALL
wait while the server wakes up. A continuable game SHALL still be offered first ("Jatka peliä").

#### Scenario: Bots

- **WHEN** a player chooses two bots in "Pelaa botteja vastaan"
- **THEN** a game against the bots Kettu and Ilves starts on the device

#### Scenario: Duo against a bot

- **WHEN** a player chooses Duo in "Pelaa botteja vastaan"
- **THEN** no bot count is offered, and starting opens a Duo game against Kettu on the device

#### Scenario: Friends

- **WHEN** a player taps "Luo peli kavereille" while another public game is waiting for players
- **THEN** a new game is created with the player as its host, and the other game is not joined

#### Scenario: Server asleep

- **WHEN** the server is still waking up
- **THEN** "Luo peli kavereille" is disabled with the wake-up status shown, and the bot way works

### Requirement: Open and running games

The public games of the page's pool that wait for players SHALL be listed for joining and the running
watchable ones for watching, in a secondary section below the two ways in, each with its variant.
The section SHALL be hidden when both lists are empty or the list could not be loaded.

#### Scenario: Nothing to show

- **WHEN** no public game waits or runs
- **THEN** the start screen shows no games section

#### Scenario: A waiting game

- **WHEN** a public game in the same pool waits for players
- **THEN** it is listed with its host, variant and seated count, and a tap joins it
