# Spec Delta

## REMOVED Requirements

### Requirement: Interim move control

**Reason**: Replaced by the piece tray and placement preview (`piece-controls`), which let the
player choose any piece, orientation and legal spot; the hint became a preview.
**Migration**: None for the server (the `place` command is unchanged); clients send `place` from
the chosen preview.
