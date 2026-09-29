# Roadmap

One OpenSpec change at a time, in this order. Adjust as we learn.

0. ~~`setup-infrastructure`~~ (done): Pages and Render live, server URL, CORS, MCP and VS Code debugging
1. ~~`add-logging`~~ (done): structured JSON logging, audit of commands and HTTP, client log shipping
2. ~~`add-board-model`~~ (done): tiles, board, connections, rotation (rules only)
3. ~~`add-board-setup`~~ (done): original tile distribution, treasures, seeded shuffle
4. ~~`show-board`~~ (done): quick play creates a room; the client renders the board on mobile
5. ~~`tile-shift`~~ (done): shift rule, turn order, `shift` command, arrows with preview and confirm
6. ~~`pawn-movement`~~ (done): pawn squares, shift → move turn, `move` command, reachable highlight, walking pawns
7. ~~`treasures-and-win`~~ (done): seeded deal, secret target, collect, return home, finished game, target highlight and result
8. ~~`turn-rules`~~ (done): 60 s turn clock, kick after the time is up, 5 min disconnect hold, last player standing wins
9. ~~`lobby`~~ (done): nickname, open games list, private games and invite links, waiting room with host start (24/n cards, random start seat), host leaving closes the room, game cap, local-first leave with a leave button in the game
10. ~~`bot-player`~~ (done): host adds/removes bots in the waiting room, greedy bots behind a replaceable `BotStrategy`, bot turns through the normal command path, game ends when no person is left
11. ~~`quick-play-vs-bots`~~ (done): start screen "Pikapeli botteja vastaan" 1v1/1v2/1v3, a private game started at once against 1–3 bots
12. ~~`spectators-and-rematch`~~ (done): running public games and invite links to watch, bot-only
    games to watch at 1×/2×/4×, eye count for players, rematch with the same settings. Originally: **bot-only games to watch** (requested 2026-09-27): start a
    game of 2–4 bots and follow it as a spectator, maybe with a speed choice. A watched game then
    ends when its last spectator leaves, not "when no person is seated". Also useful for comparing
    bot strategies by eye
Direction (decided 2026-09-27): **single player first** (vs bots); multiplayer extras after.

13. ~~`turn-feedback`~~ (done): pushed-in tile and walked route marked until the next shift, reach shown in the shift preview. Originally: (a) after each turn, highlight for a moment the tile that was pushed in and
    the pawn's from and to squares, so an opponent's turn is easy to follow; no event log (the
    user: nobody reads it). (b) While a shift is previewed (tile placed at an arrow, not yet
    confirmed), already highlight the squares the player could reach after it, computed in the
    client with `packages/rules`
14. ~~`resume-game`~~ (done): "Jatka peliä" on the start screen within the 5-minute seat hold
    after the app was closed mid-game; the wake-up wait counts seconds with a spinner
15. ~~`local-play-and-pwa`~~ (done): quick bot games run on the device over a rules game engine
    (no server, no wake-up wait, offline, resumable any time); installable PWA with offline start
    and auto-update. Originally: new games vs bots run in the browser with `packages/rules` (no server,
    no wake-up wait, works offline) and the app installs to the home screen as a PWA. Multiplayer
    and watching stay on the server. An online game never switches to local play by itself
16. ~~`first-game-tips`~~ (done): four one-time tips (target, push, walk, home) below the controls,
    reset from the start screen; the hint ring became a pulsing yellow ring. Originally: 3–4 hints during the first game (push a row from an arrow, walk to a
    highlighted square, your target, return home); shown once, can be reset
17. ~~`smarter-bots`~~ (done): look-ahead bot that blocks every opponent (leader 1.25x), 1-in-5 selfish turns so games never lock; tournament 90/61/42 % vs 1/2/3 greedy bots. Originally: replaces the bot with the
    best one we can make; no difficulty levels (the user: nobody wants to pick a bot). Look-ahead;
    it blocks **all** opponents evenly, the leader with a slightly higher priority, while keeping
    its own target reachable; a bot tournament (simulation of many games) compares strategies by
    win rate. Fair: no knowledge of others' targets. To watch: it must stay fun to play against,
    not so strong or so blocking that it feels annoying
18. ~~`hint`~~ (done): "Vihje" previews the look-ahead bot's shift and rings the square to walk to,
    computed in the client from your own information; bots (and the hint) skip found treasures
19. ~~`daily-puzzle`~~ (done): solo puzzle of the local date (3 treasures and home, fewest
    turns), one attempt, result shared as an emoji row with share sheet or clipboard. Originally: one seed per day for everyone, solo with no opponents: reach the treasure in as
    few turns as possible; result shareable as text (Wordle style). Builds on local play
20. ~~`autoplay`~~ (done): "Anna botin pelata" in the top bar hands the seat to the bot, "Ota vuoro
    takaisin" takes it back; robot icon on the chip and in the turn line for everyone; a dropped
    player is auto-played during the seat hold, a slow connected one can still be kicked; works in
    device games, not in the daily puzzle. Originally: a player can hand their seat to the bot for a while and take
    it back; the chip shows it to everyone. Same fair `BotStrategy` as bots. To decide in the
    proposal: whether a dropped or timed-out player is auto-played instead of kicked
21. ~~`settings`~~ (done): settings screen from the start screen and a gear in the game's top bar
    (language moved there): confirm shift/move, theme, generated sounds, turn notification (tab
    title while hidden, vibration). Originally: confirmations, theme, sounds, **turn notification** (tab title, vibration, sound)
22. ~~`share-and-colors`~~ (done): invite link through the share sheet (earlier), and in
    `player-colours` a player's own pawn (colour + shape pair, only free ones) picked on the start
    screen and changeable in the waiting room; device games use it too

Extras done outside the numbered list: ~~`how-to-play`~~ (done): "Näin pelaat" rules screen with
pictures from the start screen and the settings (also during a game).

## Refinement round 1 (asked 2026-09-27)

Foundations are done; the user trims and clarifies. Autopilot is on (switched back on 2026-09-27): changes run without review stops.
In this order:

1. ~~`simpler-start-screen`~~ (done): no private games, "Pelaan itse" switch (off = 2–4 bots to watch on the device), no daily share. Originally: fewer choices on the start screen.
   - Remove "Luo yksityinen peli". Friends still join through the waiting room's invite link;
     private games (hidden from the lobby) are no longer created from the UI.
   - Remove "Katso bottien peliä". Instead the bot quick play gets a "Pelaan itse" toggle (default
     on). Off = a bot-only game to watch (2–4 bots, speed choice as today). To decide in the
     proposal: whether the watched game runs on the device like quick play (no wake-up) or stays
     on the server as today.
   - Remove "Jaa tulos" from the daily puzzle.
   Prune the specs, i18n keys, code and wiki of what is removed (no dead paths left).
2. ~~`hide-found-treasures`~~ (done): collected treasures hidden on board and spare tiles, the own target always shown. Originally: treasures already collected (by anyone) are no longer drawn on the
   board tiles, so the board shows only what is still in play. Hint and bots already skip them.
3. `clearer-board-marks`: a first-time player must understand every mark on the board. Marks
   listed and variants shown to the user as mock-ups (artifact "Laudan merkit",
   https://claude.ai/artifact/EsTs5XeSs9a8kcogcnZrbW). **The user picked (2026-09-27): A2, B2, C1, D2, E3:**
   - A2 last push: the pushed-in tile drawn small just outside the board edge where it came in, in
     its rotation, framed in the mover's colour (replaces the push triangle; route trace stays).
     Cost: for side pushes it does not fit a phone's 16 px gutter, so the board shrinks ~12 % (or
     find a better fit while building).
   - B2 own pawn and hint: own pawn gets a slow pulsing ring in its own colour, only on your turn
     (replaces the dashed ring); the hint ring gets a bulb badge (same icon as the "Vihje" button).
   - C1 forbidden reverse arrow: looks as today (faded), tapping it explains why in the status line
     ("Tästä ei voi työntää: laatta palaisi juuri sinne, mistä edellinen tippui.").
   - D2 idle guide: after 10 s without action on your turn, the arrows (shift step) or the
     reachable squares (move step) nudge gently toward the board; no text. Reduced motion: none.
   - E3 reachable squares: a dot on the corridor hub, hollow in the shift preview, filled in the
     move step (replaces preview rings and the move step's dashed squares); the whole tile stays
     the tap target.
5. `push-and-pick` (asked 2026-09-27): smoother turn. Placing the tile at an arrow at once shows
   where you can walk (E3 dots) and the player can still move the tile to another arrow or rotate
   it; tapping a reachable square commits shift + move together, so the shift needs no separate
   confirm. A setting switches back to today's flow (confirm shift, then move). To decide in the
   proposal: how it fits the existing "confirm shift/move" settings, what online games send
   (shift then move, opponents see the shift only when committed), the turn clock, and the hint.
   Build after `clearer-board-marks` (it uses E3).
4. ~~`game-link-badge`~~ (done): the id badge shares the game link (join/watch text), device games show a plain label, the bug-report line moved to Settings → "Vianilmoitus". Originally: the game id in the top-left corner becomes an easy way to link the game to
   someone: tapping it shares/copies an http URL — a join link while the game is in the waiting
   room, a watch link once it is running (invite links already open both). To decide in the
   proposal: where the bug-report line (id · time · version) goes, and what device games (no URL)
   show and copy.

## Improvement backlog

Ideas for existing features, picked up after the roadmap items above or when a change touches the
same area. Each becomes its own change (or joins a related one) when picked up.

- ~~**Last-move marks, clearer**~~ (done in `last-move-marks`): push marked by an arrowhead outside the board edge, route dashed with a start ring and an arrowhead, all in the mover's colour. Originally: the board has
  too many similar highlight-style marks. Ideas: outside the board, mark the arrow/edge where the
  last push started (the tile was pushed in from there); show the walk as a route with a distinct
  start and end point and a dashed line; draw all of a turn's marks in the colour of the player
  who made it. Aim: fewer ring/highlight marks, each kind of mark looks different.
- ~~**Game id badge in local games**~~ (done in `game-id-badge`): device games show "Päivän pulma" / "Oma peli", the copied line keeps the full id. Originally (seen 2026-09-27): `local-daily-…` ids wrap to two lines in
  the top bar on a phone. Idea: show a shorter label for games on the device (e.g. "Päivän pulma"
  / "Oma peli"), keep the full id in the copied bug-report line.
- ~~**Hint ring stands out**~~ (done in `first-game-tips`): pulsing yellow ring on a dark halo.
- ~~**Smarter bots 2: sampling search**~~ (done in `smarter-bots-2`): look-ahead's 10 best moves each played a round ahead with sampled opponent targets; wins 74/45/32 % vs look-ahead bots (2/3/4 players), ~11 ms a turn. Originally (asked 2026-09-27): today's look-ahead scores one own turn
  and each opponent's best next shift on the board it leaves, but never plays turns in alternation
  (opponents' shifts between its turns are ignored) and cannot know their targets. Idea: Monte
  Carlo search that samples opponents' targets from the treasures not yet found, plays a few turns
  ahead with good moves for everyone and picks the best average move; must stay within a
  phone's time budget (now a few ms per turn). Compare with `botTournament` before switching;
  the hint would get stronger with it. Pick up when the current bot starts to feel easy.
