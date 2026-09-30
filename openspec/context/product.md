# Product

Decisions about what the game is and how it feels, not yet written as specs. Once a spec exists
in `openspec/specs/`, the spec wins.

## The game (rules in our own words)

A territory game with polyomino pieces on a square grid, in the spirit of the classic
corner-touching game. Never use the original's trademarked name, logos or look (nfr → Legal).

- **Board:** 20×20 for 2–4 players. Variants (built in `variants`; ids `classic` / `duo` /
  `double` / `trio`): **Perus** (as above), **Duo** 14×14 for 2 (start squares row 5, column 5 and
  row 10, column 10), **Tuplaväri** 2 players with colours 1+3 and 2+4 (scores summed),
  **Kolmikko** 3 players with the fourth colour Kuusi shared (played in turn, not counted). The
  host picks the variant in the waiting room; the bot way on the start screen offers it too.
- **Pieces:** each colour has the 21 free polyominoes of size 1–5 (1 monomino, 1 domino,
  2 trominoes, 5 tetrominoes, 12 pentominoes; 89 squares). A piece may be rotated and mirrored
  (up to 8 orientations).
- **Colours and order:** seat 1–4 = Järvi (blue), Lakka (yellow), Puolukka (red), Kuusi (green),
  playing in that order. Each colour starts from its own board corner (seat 1 top-left, then
  clockwise).
- **First piece** of a colour covers its start corner square.
- **Every later piece** must touch at least one piece of the same colour **corner to corner**, and
  must never touch a piece of the same colour **edge to edge**. Touching other colours is free.
  Pieces never overlap and stay inside the board.
- **Passing:** a colour with no legal placement passes, automatically; once it cannot move it
  never can again (the board only fills), so it is out for the rest of the game. A player may not
  pass voluntarily while a legal move exists (decision to confirm in the rules spec).
- **End:** when no colour can place a piece.
- **Scoring:** each unplaced square is −1; placing every piece gives +15, and +5 more when the last
  piece placed was the monomino. Highest score wins; equal scores share the win.

## Modes

- **Against bots on the device:** 1 person + 1–3 bots (Perus; other variants their own count), runs
  fully in the browser (no server), also offline. Watching bots only (2–4) as well.
- **Online:** a waiting room with an invite link; empty seats get bots. The host's browser computes
  the bots' moves (Web Worker); the server validates them like any move. Bot strength therefore
  depends on the host's device (accepted).
- **Spectators:** running online games can be watched.
- **Daily puzzle ("Päivän pulma"):** a given shape to fill with pieces; the same for everyone on a
  day; score and personal best on the device. Built (`daily-puzzle`, spec `daily-puzzle`): the
  shape is filled with a given set of 5 pieces (Monday) up to 8 (Sunday) with no corner rule, and
  the score is the solving time plus a streak of days solved.

## Start screen and lobby

- Balanced: two equally visible ways in, "Pelaa botteja vastaan" and "Luo peli kavereille". The
  lobby must stay simple and get people playing quickly. `basic-ui` kept the open and running games
  as a secondary "Liity peliin" section, shown only when there is something in it; quick play (join
  any open game) went away.
- Nickname prefilled with a random themed name; the daily puzzle has its own entry.

## Bots

- The main focus of the project: as strong as possible.
- The player is offered **one** bot, the strongest the device manages within the time budget. The
  bot interface still takes a budget (time or search depth) so levels or other choices can come
  later without rework.
- The bot "brains" are a game-independent library (own workspace package, no Palikka names): search
  (paranoid / best-reply), MCTS, time budget, worker harness; Palikka plugs in through an adapter.
- Bot strength is measured, not guessed: tournaments and Elo (roadmap `tournament-elo`).
- Bot names (theme): Kettu, Ilves, Pöllö, Näätä.

## Theme "Kuura" (frost)

- Look: the simplest option on purpose. Flat squares with a small gap and slightly rounded
  corners, no shadows or textures. Light = a frosty morning (pale blue-grey ground, white cells),
  dark = the polar night (near-black ground, slate cells). Seat colours as above, brighter in dark.
- Pieces are always squares; nothing round.
- Voice: playful and wintery throughout (the user wants it "reilusti"): the server "wakes from
  hibernation", a leaver "wandered off into the forest", the winner "has the winter". Keep texts
  clear first, playful second.
- Accessibility is basic only: contrast and tap targets; colour alone may identify a player.

## Mobile (built in `mobile-ui`, 2026-09-30)

- Corner first: tap a free corner → only the pieces that fit there → "‹ n/m ›" through that piece's
  spots on the corner → tap the preview or "Aseta". Runs alongside piece-first aiming.
- Drag from the tray or the preview, the piece held above the finger; the landing spot shows live
  and snaps only within one square; letting go never places.
- Phone layout: the board turned so the own start corner is bottom-left (view only); zoom to the
  own corners on the own turn, with a "Koko lauta" / "Lähennä" toggle.
- "Vihje" steps through the bot's three best moves ("Vihje 2/3").
- The bot way starts at the last picked variant, the first time Duo on a phone.

## Decided in the spec phase (2026-09-29)

- Turn time limit online: 120 s; then the others may remove the slow player (as now).
- No voluntary pass: a colour passes only when it has no legal move, and is then out.
- Undo: in games against bots on the device, "Peru" takes back the player's own last move (and the
  bots' moves after it); never online.
- Scoring: the advanced scoring; the end screen also shows each colour's squares on the board.
