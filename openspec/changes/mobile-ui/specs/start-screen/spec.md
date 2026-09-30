## ADDED Requirements

### Requirement: Variant default on the device

The bot way's variant SHALL start at the variant the player last picked on this device; when none
has been picked, it SHALL start at Duo in the phone layout and at Perus otherwise.

#### Scenario: First time on a phone

- **WHEN** a player opens the start screen on a phone for the first time
- **THEN** the bot way has Duo chosen

#### Scenario: Remembered choice

- **WHEN** a player picked Perus last time and opens the start screen on a phone
- **THEN** the bot way has Perus chosen
