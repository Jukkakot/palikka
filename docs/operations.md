# Operations

## Environments — Implemented

| | URL | Hosted on | Deploys when |
|---|---|---|---|
| Client | https://jukkakot.github.io/palikka/ | GitHub Pages | push to `main` touching `client/`, `packages/rules/`, lockfile ("Deploy client" workflow) |
| Server | https://palikka-server-p4qm.onrender.com (also the repository variable `VITE_SERVER_URL`) | Render free web service `palikka-server` (Frankfurt) | green CI on `main` when the server code (`server/`, `packages/rules/`, `packages/protocol/`, lockfile, `render.yaml`) differs from the live server's commit: the `deploy-server` job in CI calls Render's deploy hook (secret `RENDER_DEPLOY_HOOK_URL`); Render auto-deploy is off |

- Game kit: Render, Pages and CI download the `@game-kit/*` release tarballs from public GitHub
  Releases of `Jukkakot/game-kit` during `npm ci` (no token). A kit bump changes the lockfile, which
  deploys both sides.
- Render ids: service `srv-dau14mbncjis73abtnk0`, workspace `tea-d7vbs7l7vvec73dbddt0` (shared with Labyrinth).
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
1v1 bot game on the device (Duo on a phone: I5 from the tray onto the start square with two taps, the bot answers from its worker), then a server game ("Luo peli", one bot, start) on the live site and leaves; also daily at 05:17 UTC and by hand). No staging
environment.

**Service worker:** the client is a PWA. A phone with the app open or installed picks up a new
Pages deploy on its next load (the new worker takes over and reloads the page once). To rule out a
stale client when checking a deploy, compare the footer's "Client …" build time.

### Bot tournaments — Implemented

`.github/workflows/tournament.yml`, separate from CI so a weaker bot never blocks a deploy:

- **strength** job: on pushes to `main` and pull requests that touch
  `packages/palikka-bots`, `packages/rules`, the lock file or the workflow. Runs
  `npm run strength`; red when a requirement is missed. Report on the run's summary page, JSON as
  the `strength-results` artifact (30 days). "search beats greedy" (200 games of `brs@d4`) makes it
  take about 10 minutes.
- **tournament** job: Actions → Bot tournament → Run workflow, with bots (space-separated),
  games per pairing, colours and first seed. Report on the summary page, JSON as the
  `tournament-results` artifact. 4 vCPUs; about 0.65 s per greedy game per core, so 1 000 games
  take about 3 minutes; search bots are 10–30× slower per game (timeout 5 h).

### After a deploy (manual checks)

1. Open https://jukkakot.github.io/palikka/ on the phone. If the server was asleep, "Luo peli" is
   greyed out with "Herätetään palvelinta talviunilta…" (up to about a minute). The footer's
   "Client …" and "Server …" build times must be newer than the push. Enter a nickname and tap
   "Luo peli" → the waiting room, you are the host.
2. Open the same page in a second tab or device: the game shows under "Liity peliin" (or open the
   invite link). Tap it → both tabs list two players; the host taps "Aloita peli" → both see the
   board, same game id.
3. The player on turn taps a piece in the tray, taps the start corner and taps the preview again →
   the piece shows in their colour in both tabs.
4. In Axiom (or Render logs) find the game id: `game.started`, `cmd.accepted move` lines.

## One-time setup

Done once per new game repository (for Palikka: 2026-09-29); all other deploys are automatic. Commands assume the GitHub CLI
(`gh`) is logged in as the repo owner.

1. **GitHub repo and Pages** (public, so Actions minutes are free):
   `gh repo create Jukkakot/palikka --public --source . --push`, then
   `gh api -X POST repos/Jukkakot/palikka/pages -f build_type=workflow`.
2. **Render service:** dashboard → New → Blueprint → pick the repo (reads `render.yaml`, free plan,
   Frankfurt). Then Settings → Deploy Hook → copy it and
   `gh secret set RENDER_DEPLOY_HOOK_URL --repo Jukkakot/palikka` (paste). Note the service URL and
   `gh variable set VITE_SERVER_URL --repo Jukkakot/palikka --body https://<service>.onrender.com`.
3. **Axiom:** nothing to create. The games share the dataset `games` and one ingest-only token
   (game-kit README → Logs): copy it from the user env var `AXIOM_GAMES_TOKEN` into the Render
   service's `AXIOM_TOKEN` (Render MCP `update_environment_variables`, never printed).
4. Record the Render service and workspace ids above, then re-run CI (`gh workflow run CI`).

## Configuration — Implemented

| Name | Where | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | GitHub repository variable → client build, CI health checks | Server base URL |
| `VITE_BASE` | set in deploy workflow | `/palikka/` path on Pages |
| `ALLOWED_ORIGINS` | `render.yaml` env | CORS allow-list (comma-separated) |
| `NODE_ENV=production` | `render.yaml` env | Disables `/monitor` and `/playground` |
| `PORT` | set by Render | Server listen port |
| `AXIOM_DATASET` | `render.yaml` env (`games`) | Axiom dataset shared by the games; lines say which game with `game` |
| `AXIOM_EDGE` | `render.yaml` env | Edge domain of the dataset's region (`eu-central-1.aws.edge.axiom.co`); Axiom refuses ingest through `api.axiom.co` for EU datasets |
| `AXIOM_TOKEN` | Render dashboard (secret, `sync: false`) | Axiom API token, the games' shared **ingest-only** token for `games`; without it nothing is shipped |

## Logs — Implemented

All logs, server and client, are written to the server's stdout (Render's log view) and, in
production with `AXIOM_TOKEN` set, also shipped to the **Axiom** dataset `games`, shared by the user's games (30-day
retention, queryable with APL). Axiom is the main place to read them: Claude uses the Axiom MCP
(`queryApl`), people the Axiom web UI. Render's view (dashboard or Render MCP
`list_logs(resource=[service id], text=[…], startTime, endTime)`) is the fallback, e.g. while
Axiom has no data. Shipping runs in a worker thread (`@axiomhq/pino`); a failing Axiom only loses
lines, never slows a game.

**Ready queries** (APL; narrow the time range with `where _time > ago(1d)`):

```
['games'] | where game == "palikka" and room == "brave-otters-sing" | sort by _time asc          // one game's timeline
['games'] | where game == "palikka" and level == "error" and _time > ago(1d)                      // errors today
['games'] | where game == "palikka" and evt == "cmd.rejected" | summarize count() by code, cmd     // rejections by code
['games'] | where game == "palikka" and evt == "bot.fallback" | project _time, room, seat, reason, runner
['games'] | where game == "palikka" and evt == "game.finished" | summarize count() by reason, bin(_time, 1d)
```

**Dashboard for people:** the shared "Pelit – lokit" (pick the game in its Peli filter), built
by `tools/axiom/dashboard.py` in the game kit (uid `3345cc1f-c285-4c6b-a0c2-8bc7bc583971`).

**Setup:** since 2026-10-01 Palikka ships to the shared dataset `games` (EU, 30-day retention)
with the games' shared ingest-only token in Render's `AXIOM_TOKEN`. Its own dataset `palikka` was
deleted to free the slot (Axiom's personal tier allows 3 datasets); older lines are gone.

**Access:** Claude administers Axiom (datasets, tokens, dashboards) through its REST API with the
user's personal token `AXIOM_PAT` + `AXIOM_ORG_ID` from the Windows user environment. No error
alerts or emails: errors are found on the dashboard.

**Format:** one JSON object per line, keys in this order:

```
{"level":"warn","evt":"cmd.rejected","room":"brave-otters-sing","player":"r39lF4Y3r",
 "cmd":"move","code":"OVERLAP", …,"src":"server","ver":"a1b2c3d","msg":"…"}
```

- `level` debug/info/warn/error; production writes `info` and up (`LOG_LEVEL` overrides).
- `evt` from a fixed catalogue: server events in `server/src/logging/events.ts`, client events in
  `packages/protocol/src/log-events.ts`. Filter by `"evt":"cmd.rejected"` etc.
- `room` is the readable game id shown to players; `player` the session id.
- `game` the game's name (`palikka`), set in `server/src/index.ts`; `src` `server` or `client`; `ver` short git commit of the side that logged (`dev` locally).
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
| `game.started` | the game started, `{ dealSeed, variant, seats, startSeat, colour, runner }` (the game's options, e.g. `variant`, are spread in; `colour` is the colour on turn) (the seed reproduces the server's fallback moves; never synced; `runner` = the bot runner's seat) |
| `game.finished` | the game ended, `{ winners, reason, scores }` (winning seats; `complete` when no colour can move, `lastPlayer`; `noPeople` with no winners when only bots were left and nobody watched; `scores` = `colour:score/squares …` per colour; in Tuplaväri a seat's score is the sum of its two colours, in Kolmikko colour 4 counts for no one) |
| `game.rematch` | a finished game created its rematch game, `{ rematchRoom }` (follow the group into that room) |
| `spectator.joined` / `spectator.left` | a spectator came or went (left, or the 5-min drop hold ran out), `{ spectators }` = count after; their connection lines are `player.joined` with `spectator: true` etc. |
| `bot.added` / `bot.removed` | the host seated or removed a bot in the waiting room, `{ seat, name }`; `reason: "options"` when options with fewer seats (a variant) removed it |
| `options.changed` | the host changed the game's options in the waiting room (`setOptions`), `{ from, to }`, e.g. `{ variant: "classic" }` → `{ variant: "duo" }` |
| `bot.runner` | the seat whose browser computes bot moves changed, `{ from, to }` (0 = none: the server plays them) |
| `bot.fallback` | the server played a bot-played seat's move itself, `{ seat, colour, reason, runner }`: info with `noRunner` (no person connected, e.g. spectators watching bots), warn with `runnerSilent` (the runner sent no accepted move within 10 s after the pause: a slow, throttled or broken host browser) |
| `autoplay.changed` | the bot took over a person's seat or gave it back, `{ seat, on, reason }` (`player` handed over or took back, `drop` connection lost, `reconnect` came back); its commands then carry `bot: true` with the person's own `player` |
| `turn.changed` | every turn change, `{ from, to, colour, out }`: `from`/`to` are seats (0 = nobody), `colour` the colour on turn (in Tuplaväri and Kolmikko not the seat; the shared colour 4 rotates), `out` = colours that cannot move any more |
| `turn.expired` | the current turn's 120 s ran out, `{ seat }`; from now on the others may kick |
| `phase.changed` | the phase changes, `{ from, to, turnSeat }` (`waiting` → `play` → `finished`); to `play` it carries the game's options (`variant`) |
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
"Oma peli" in the badge. The player copies the line from Asetukset →
Vianilmoitus → "Kopioi pelin tiedot" (id, local time, version); it carries the full `local-…` id;
they have no server room, so only client logs can have it (`client.local.*`
info lines ship only with `?debug=1`).

1. Convert the reported local time (Europe/Helsinki) to UTC.
2. Query Axiom (Axiom MCP `queryApl`): `['games'] | where game == "palikka" and room == "<game id>" | sort by _time
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
