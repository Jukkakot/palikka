# Non-functional requirements

Apply to every change. Designs and task lists must show how they are met.

## Budget and hosting
- 0 € forever: GitHub Pages (client), Render free tier (server). Accepted
  consequence: the server sleeps after ~15 min idle and every restart or deploy
  loses in-memory games.
- Scale target: tens of concurrent games on a single instance. No Redis, no
  horizontal scaling.
- No keep-alive pinging; sleeping is accepted.
- Graceful shutdown: on SIGTERM (deploy/restart) the server tells connected
  players "Server is updating, the game ends" before closing.
- A finished game stays open while any human is in it (results, "Play
  again"), and closes when the last human leaves or after 10 minutes.

## Performance (mid-range phone a few years old)
- Usable within 3 s on 4G; JS bundle budget 200 kB gzip, checked in CI (a bot
  Web Worker bundle gets its own budget when it arrives).
- Piece moves and previews at 60 fps; animate only transform and opacity.
- Every tap gives immediate feedback (pending state); target server response
  under 300 ms.
- Bots never block the UI thread: search runs in a Web Worker under a time
  budget. Move generation must be fast enough for search (bitboards, measured
  in the rules benchmarks once they exist).

## Error UX
- Rejected command: short localized message ("Someone got there first").
- Connection lost: banner "Reconnecting…". Crash: "Something went wrong –
  reload" screen.
- Technical details go to the logs only, never to the UI.

## Logging and audit
- All logs, server and client, end up in Render's log stream and, in production,
  in the Axiom dataset `palikka` (free tier, 30 days, APL queries). No other
  log service.
- Format: one JSON object per line (pino). `level` and `evt` always come first,
  then `room`, `player`, event fields, `src` (`server`/`client`), `ver` (short
  commit) and `msg` last. Server lines carry `time` when shipped to Axiom (and in
  development); client entries carry their own `ts`.
- `evt` comes from a fixed catalogue (`room.created`, `player.joined`,
  `cmd.accepted`, `cmd.rejected`, `phase.changed`, `http.request`,
  `client.error`, `conn.lost`, …) so logs can be filtered by name.
- Audit: every inbound command and HTTP request logs exactly one line with
  outcome, error code and duration. A rejection also logs the relevant state
  (phase, whose turn, and the fact that caused the rejection).
- Errors are a single line with the stack in a field, never multi-line output.
- Client: warn/error, uncaught errors (global handlers + React error boundary)
  and key events (connection lost/restored, command rejected) are shipped to the
  server, which logs them with `src=client` and the client timestamp.
  `?debug=1` raises one client to debug level.
- Development: pretty-printed in the terminal and also written to
  `logs/dev.log` (git-ignored) so they can be read directly.
- Reading production logs: Render dashboard or Render MCP (text and time-range filters
  verified; Render also indexes the JSON `level`). Retention on the free plan is not yet
  verified: the API accepts queries up to 30 days back; check the oldest available lines once
  the service is a week old (after 2026-10-03).
- Privacy: the nickname is the only personal data. Never log IP addresses.

## Testing (required in every change)
- Rules: unit tests; every spec scenario maps to at least one test, named after
  it. Invariants are also covered with fast-check property tests.
- Server: room integration tests with @colyseus/testing.
- Test each behaviour once, at the lowest level that can show it: rule outcomes in rules unit
  tests; room tests cover the wiring (the command reaches the rule, rejections and their order,
  state and log lines, lifecycle), not every rule scenario again.
- Client: unit tests for logic (session hooks, view model, helpers). Screens get only a few
  render tests for key interactions; layout and visuals are checked with the Playwright MCP UI
  check, not with a render test per spec scenario.
- E2E: for now one Playwright smoke test (Galaxy S24 profile): two players meet, the
  host starts, and a move syncs. Feature behaviour is covered by unit tests and server room tests,
  not by per-feature E2E UI tests.
- Bot strength is a measured requirement: a new bot version must beat the previous one by a
  stated margin in a tournament (roadmap `tournament-elo`); heavy tournaments run in GitHub
  Actions, not in the unit test run.
- Accessibility is basic only (the user's choice): contrast, tap targets, reduced motion; colour
  alone may carry the player identity.
- Further testing practices (a11y checks, coverage limits, visual regression) are decided when
  there is something to test; visual regression is out for now.

## Abuse protection
- Nickname 2–16 characters, trimmed, no control characters or whitespace-only.
- Per-connection rate limit on commands.
- Room limits: max open rooms per connection plus a global cap.

## Versioning
- The server reports its version on connect. On an incompatible client the UI
  shows "New version available, reload" instead of playing on a broken client.

## Legal and privacy
- The original is a Mattel trademark: never use its name, logos, artwork, box
  look or its signature colour scheme in the UI, assets, texts or repo. Own name
  ("Palikka"), own theme ("Kuura") and own icons only. Game rules as such are
  not protected; describe them in our own words.
- No license: all rights reserved.
- No analytics, no cookies, no consent banner.

## Development workflow
- Claude commits and pushes to `main` itself (standing permission for this repo). CI guards
  main and Render deploys only after green CI.
- No code formatter; oxlint only.
- Dependencies are updated manually (no Renovate/Dependabot).

## Browser support
- Chrome on Android is primary (reference device Galaxy S24); iOS Safari, Firefox
  and Edge must also work. Versions back about two years. No
  legacy polyfills. Web Workers and typed arrays (incl. BigInt only if measured
  to be fast enough) may be assumed.

## Theme
- Every UI change follows the theme "Kuura" (product.md → Theme): flat squares,
  northern colours, playful voice. Light and dark are both designed; the device
  setting is followed unless the player forces one.
