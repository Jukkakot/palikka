# Operations

## Environments — Implemented

| | URL | Hosted on | Deploys when |
|---|---|---|---|
| Client | https://jukkakot.github.io/palikka/ | GitHub Pages | push to `main` touching `client/`, `packages/rules/`, lockfile ("Deploy client" workflow) |
| Server | https://palikka-server.onrender.com | Render free web service `palikka-server` (Frankfurt) | green CI on `main` when the server code (`server/`, `packages/rules/`, `packages/protocol/`, lockfile, `render.yaml`) differs from the live server's commit: the `deploy-server` job in CI calls Render's deploy hook (secret `RENDER_DEPLOY_HOOK_URL`); Render auto-deploy is off |

- Render ids: service `srv-darps5navr4c73fmplh0`, workspace `tea-d7vbs7l7vvec73dbddt0`.
- **Free tier:** the server sleeps after ~15 min without traffic; the next request wakes it in
  about a minute. Sleeping, restarting or deploying loses all games in memory (accepted, budget
  0 €).
- Service definition is code: [`render.yaml`](../render.yaml) (Blueprint). Change settings there,
  not in the dashboard.

## Release flow — Implemented

commit → push to `main` (Claude pushes before each summary) → CI (lint, typecheck, tests, build, bundle
size, E2E smoke) → Pages deploy (client) and Render deploy hook (server, CI's `deploy-server` job after green checks) →
**production smoke** (`prod-smoke.yml`: waits until the live server's `/health` version and the
client's `version.json` carry this commit's code, then `npm run e2e:prod -w @palikka/e2e` starts a
1v1 bot game on the device, then a server game (Pelaa, one bot, start) on the live site and leaves; also daily at 05:17 UTC and by hand). No staging
environment.

**Service worker:** the client is a PWA. A phone with the app open or installed picks up a new
Pages deploy on its next load (the new worker takes over and reloads the page once). To rule out a
stale client when checking a deploy, compare the footer's "Client …" build time.

### After a deploy (manual checks)

1. Open https://jukkakot.github.io/palikka/ on the phone (or Playwright MCP `playwright-mobile`).
   If the server was asleep, Pelaa is greyed out with "Herätetään palvelinta…" (up to about a
   minute); then Pelaa becomes available. The footer shows "Client …" and "Server …" build times:
   they must match the Pages and Render deploys you just made (newer than the push). Enter a
   nickname and tap Pelaa → the waiting room, you are the host.
2. Open the same page in a second tab or device: the game shows in "Avoimet pelit" as
   "<name> · 1/4". Tap it → both tabs list two players; the host taps "Aloita peli" → both see the
   board, same game id.
3. Tap the game id → the share sheet (or "Linkki kopioitu") with a `?game=<id>` link.
4. On the current player's tab tap an edge arrow, then "Työnnä" → the line slides in both tabs.
5. In Render logs (`list_logs`, text = the game id) find `game.setup`; its seed reproduces the
   starting board: `boardToText(setupBoard(seed))`. `game.started` has the `dealSeed`, seats and
   start seat. Each `cmd.accepted` `shift` line then replays one shift with `shiftBoard`.
6. **Leave through the Render proxy** — checked 2026-09-27: a leave arrives as `player.left`
   `code: 4000` (consented) and the player is removed at once; the production smoke repeats the
   leave on every deploy.

## Configuration — Implemented

| Name | Where | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | GitHub repository variable → client build | Server base URL |
| `VITE_BASE` | set in deploy workflow | `/palikka/` path on Pages |
| `ALLOWED_ORIGINS` | `render.yaml` env | CORS allow-list (comma-separated) |
| `NODE_ENV=production` | `render.yaml` env | Disables `/monitor` and `/playground` |
| `PORT` | set by Render | Server listen port |
| `AXIOM_DATASET` | `render.yaml` env (`palikka`) | Axiom dataset the production server ships its log lines to |
| `AXIOM_EDGE` | `render.yaml` env | Edge domain of the dataset's region (`eu-central-1.aws.edge.axiom.co`); Axiom refuses ingest through `api.axiom.co` for EU datasets |
| `AXIOM_TOKEN` | Render dashboard (secret, `sync: false`) | Axiom API token, **ingest-only** for `palikka`; without it nothing is shipped |

## Logs — Implemented

All logs, server and client, are written to the server's stdout (Render's log view) and, in
production with `AXIOM_TOKEN` set, also shipped to the **Axiom** dataset `palikka` (30-day
retention, queryable with APL). Axiom is the main place to read them: Claude uses the Axiom MCP
(`queryApl`), people the Axiom web UI. Render's view (dashboard or Render MCP
`list_logs(resource=[service id], text=[…], startTime, endTime)`) is the fallback, e.g. while
Axiom has no data. Shipping runs in a worker thread (`@axiomhq/pino`); a failing Axiom only loses
lines, never slows a game.

**Ready queries** (APL; narrow the time range with `where _time > ago(1d)`):

```
['palikka'] | where room == "brave-otters-sing" | sort by _time asc          // one game's timeline
['palikka'] | where level == "error" and _time > ago(1d)                      // errors today
['palikka'] | where evt == "cmd.rejected" | summarize count() by code, cmd     // rejections by code
['palikka'] | where evt == "bot.fallback" | project _time, room, seat, cmd, code
['palikka'] | where evt == "game.finished" | summarize count() by reason, bin(_time, 1d)
['palikka'] | where evt == "game.started" | summarize count() by quick = tostring(quick), bin(_time, 1d)
```

**Dashboard for people:** Axiom → Dashboards → **"Palikka – lokit"** (uid
`944f69f1-0eb1-46b1-b88c-5c0635b8aed6`). Filter bar: source (server/client), type (audit = commands,
game flow, connections, HTTP, errors and warnings), game id, people/bots, version. Panels: games
started, errors, rejected commands, bot fallbacks, lines by level, finished games by reason, the
log table (newest first) and rejections by code. Built by `tools/axiom/dashboard.py`; change it there
and upload with `tools/axiom/axiom.ps1` (see the script header), not by hand in the UI.

**Setup (done 2026-09-27):** dataset `palikka` (EU region, plan retention 30 days), ingest-only
token "palikka ingest (Render server)" in Render's `AXIOM_TOKEN`. Claude administers Axiom
(datasets, tokens, dashboards, monitors) through its REST API with the user's personal token
`AXIOM_PAT` + `AXIOM_ORG_ID` from the Windows user environment (`tools/axiom/axiom.ps1` reads them
there, as a running VS Code may not have inherited them). No error alerts or
emails (the user's choice for a hobby project): errors are found on the dashboard.

**Format:** one JSON object per line, keys in this order:

```
{"level":"warn","evt":"cmd.rejected","room":"brave-otters-sing","player":"r39lF4Y3r",
 "cmd":"shift","code":"REVERSE_PUSH_FORBIDDEN", …,"src":"server","ver":"a1b2c3d","msg":"…"}
```

- `level` debug/info/warn/error; production writes `info` and up (`LOG_LEVEL` overrides).
- `evt` from a fixed catalogue: server events in `server/src/logging/events.ts`, client events in
  `packages/protocol/src/log-events.ts`. Filter by `"evt":"cmd.rejected"` etc.
- `room` is the readable game id shown to players; `player` the session id.
- `src` `server` or `client`; `ver` short git commit of the side that logged (`dev` locally).
- Errors: `err` (server) or `stack` (client) inside the line — never multi-line.
- `time`: when the server wrote the line; present when shipped to Axiom (its `_time`) and in
  development. Client lines also carry the device clock in `ts`.
- `seat`: on lines about a seated player (person or bot), next to `player`.

**What gets logged:**

| Event | When |
|---|---|
| `http.request` | every HTTP request incl. matchmaking (`/health` only at debug) |
| `room.created` / `room.disposed` / `room.error` | room lifecycle, uncaught room exceptions |
| `room.closed` | the host left the waiting room, so the game closed for everyone, `{ reason: "hostLeft" }` |
| `room.refused` | a join or creation refused, `{ reason }`: `nickname` (invalid), `options` (another invalid or unknown join option, e.g. `bots` or `private` from an old app), `cap` (`open` games at the limit) or `notWatchable` (a spectator for a game not running) |
| `player.joined` / `left` / `dropped` / `reconnected` | connection changes (a dropped seat is held 5 min); `joined` carries the nickname `name` |
| `player.removed` | a player is taken out of a game, `{ seat, reason, by? }` (`left`, `kicked` by seat `by`, `timeout` after 5 min disconnected) |
| `game.setup` | a new game's seed |
| `game.started` | the game started, `{ dealSeed, seats, startSeat }` (reproduces the deal and who began; seed never synced) |
| `treasure.collected` | a player collects their target, `{ seat, treasure, found, cards }` |
| `game.finished` | the game ended, `{ winner, reason }` (seat; `home` or `lastPlayer`; `noPeople` with winner 0 when only bots were left and nobody watched) |
| `game.rematch` | a finished game created its rematch game, `{ rematchRoom }` (follow the group into that room) |
| `spectator.joined` / `spectator.left` | a spectator came or went (left, or the 5-min drop hold ran out), `{ spectators }` = count after; their connection lines are `player.joined` with `spectator: true` etc. |
| `bot.added` / `bot.removed` | the host seated or removed a bot in the waiting room, `{ seat, name }` |
| `bot.fallback` | error: a bot's chosen command was rejected, `{ cmd, code }`; it made an allowed shift and stayed instead (a bug in the bot strategy) |
| `autoplay.changed` | the bot took over a person's seat or gave it back, `{ seat, on, reason }` (`player` handed over or took back, `drop` connection lost, `reconnect` came back); its commands then carry `bot: true` with the person's own `player` |
| `turn.changed` | every turn change, `{ from, to }` seats (0 = nobody) |
| `turn.expired` | the current turn's 60 s ran out, `{ seat }`; from now on the others may kick |
| `phase.changed` | the step within a turn changes, `{ from, to, turnSeat }` (`shift` → `move`, `move` → `finished`) |
| `cmd.accepted` / `cmd.rejected` / `cmd.failed` | every room command, exactly once, with code and state facts; a bot's commands carry `player: "bot:<seat>"` and `bot: true` |
| `framework.log` | Colyseus's own messages |
| `server.started` / `server.shutdown`, `process.*` | process lifecycle and fatal errors |
| `client.*` | client warnings/errors, crashes, key events (connection, rejections) |

**Client logs** are batched and sent to `POST /client-logs` (JSON as text/plain; max 50 entries,
30 requests/min per IP; IPs are never logged). Opening the game with `?debug=1` makes that one
client ship its debug and info entries too.

**Locally:** the terminal shows pretty lines and `logs/dev.log` (git-ignored) gets the JSON lines,
server and client together.

## Investigating a reported bug

Report shape: "around 14:30 in game brave-otters-sing, X happened". Games on the device show
"Päivän pulma" / "Oma peli" in the badge. The player copies the line from Asetukset →
Vianilmoitus → "Kopioi pelin tiedot" (id, local time, version); it carries the full `local-…` id;
they have no server room, so only client logs can have it (`client.local.*` / `client.daily.*`
info lines ship only with `?debug=1`).

1. Convert the reported local time (Europe/Helsinki) to UTC.
2. Query Axiom (Axiom MCP `queryApl`): `['palikka'] | where room == "<game id>" | sort by _time
   asc`, with a ±15 min window around the reported time. If Axiom has nothing (older than 30 days,
   or not set up), fetch Render logs: `list_logs(resource=[service id], text=["<game id>"],
   startTime, endTime)` (`direction: "forward"` gives chronological order). Locally, read
   `logs/dev.log`.
3. Follow the room timeline: `player.*`, `cmd.accepted`/`cmd.rejected`/`cmd.failed`,
   `client.error` (`src:"client"`), `framework.log`. Compare `ver` of client and server.
   Client `ts` is the device clock and can be off by seconds; order by `_time`.
4. Reproduce as a failing test (rules unit test, or room test with @colyseus/testing). For UI
   bugs, reproduce with Playwright MCP (two tabs = two players).
5. Fix; the failing test stays as a regression test. Record the root cause and the log lines
   that showed it.
