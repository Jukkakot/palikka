# Development

## Setup and run — Implemented

- Requires Node 22 (`.nvmrc`) and npm 11. `npm install` at the repo root installs all workspaces.
- Ports are the game's own (not the Colyseus/Vite defaults), so its dev servers run next to other
  games' (e.g. Labyrinth on 2567/5173).
- `npm run dev` starts both:
  - server on http://localhost:2577 (`/health`, `/monitor`, `/playground`)
  - client on http://localhost:5183 (also on the LAN for phones: see the Vite output)
- In development the client is served at `/`; production uses `/palikka/`.
- Two browser tabs are two players (session per tab).
- Quick games against bots (and `?dev=1vN`) run in the browser without the server; online play,
  watching (`?dev=0vN`) and the waiting room need it.
- PWA: the service worker is off in `npm run dev`. To try install and offline start:
  `VITE_SERVER_URL=http://localhost:2577 npm run build -w @palikka/client && npm run preview -w
  @palikka/client` (port 5184; without the URL a production build shows the crash screen), then
  DevTools → Application. Icons: edit `client/public/favicon.svg`, run
  `npm run icons -w @palikka/client`, commit the PNGs.
- Logs: the terminal shows pretty lines; `logs/dev.log` has the same entries as JSON (server and
  client). Add `?debug=1` to the client URL to also get its debug entries. Clear the file only
  while the server is stopped (it keeps the file open).

### Local dev servers

Dev servers are kept running between sessions. Before a UI check or E2E run:

- Check what listens (PowerShell): `Get-NetTCPConnection -LocalPort 2577,5183 -State Listen`,
  then the owning process's command line. This checkout's `npm run dev` (`tsx watch` + Vite)
  reloads by itself, so a running one is current.
- Nothing listens: start it detached through cmd, so it outlives the session (a bare
  `Start-Process npm` dies at once; a background task leaves orphans when stopped):
  `Start-Process -WindowStyle Hidden cmd.exe -ArgumentList '/c','npm run dev > "%TEMP%\palikka-dev.log" 2>&1' -WorkingDirectory <repo root>`.
- Only one side up (e.g. VS Code's Vite on 5183): start only the other,
  `npm run dev -w @palikka/server` (log `%TEMP%\palikka-server.log`).
- Anything else on those ports (an old build, another checkout): stop it by process id.

## Checks — Implemented

Run before every commit (CI runs the same):

```
npm run lint && npm run typecheck && npm test && npm run build && npm run size -w @palikka/client
npm run e2e   # smoke test, when UI or connection code changed
```

- Lint: oxlint (root `.oxlintrc.json`). No formatter.
- Bundle budget: client JavaScript ≤ 200 kB gzip (size-limit, fails CI).
- Tests: Vitest in every workspace. Server test files run one at a time because each boots a
  real Colyseus server (`fileParallelism: false`).

## Testing approach

| Level | Tools | Status |
|---|---|---|
| Rules | Vitest; fast-check property tests for invariants; test names follow spec scenarios (`game › Placing › …`). **Planned (`tournament-elo`):** a bot tournament driver with Elo, heavy runs in GitHub Actions | Implemented |
| Server | Vitest + @colyseus/testing (real rooms, SDK clients in-process); `captureLogs()` asserts log lines; `test/support/game.ts`: `waitingRoom(n)`, `startedGame(n, { startSeat })` (nicknamed players, host starts, start seat forced via the `chooseStartSeat` hook), `placeFree(client, room)` plays a turn | Implemented |
| Client | Vitest; jsdom + Testing Library for components (`// @vitest-environment jsdom`) | Implemented |
| E2E | Playwright, Galaxy S24 profile — **one smoke test** for now (two browser contexts: the host creates a game ("Luo peli"), the guest joins by the invite link, the host starts, both see the whole board, fits 360×780, the host's piece placed from the tray with taps reaches the guest) | Implemented |

### E2E smoke

- `npm run e2e` starts the dev server and client (or reuses running ones) and runs
  `e2e/tests/smoke.spec.ts` on the Galaxy S24 profile.
- It reuses **whatever** listens on 2577/5183, e.g. a VS Code debug server started from an older
  build. When that is not the current code, stop it first, or run the server with `PORT=2600` and
  the client with `VITE_SERVER_URL=http://localhost:2600 npx vite --port 5180` and point
  Playwright's `baseURL` there.
- Each test plays in its own pool (`?pool=…`), so runs never share games.
- Place pieces with `placeOnCorner` (`helpers.ts`): it taps like a phone. A Playwright `click` is a
  mouse: the hover already previews, so the first click places.
- In a cloud container without Playwright's own browser build, point `launchOptions.executablePath`
  at the preinstalled Chromium in a local, uncommitted config.
- On failure: screenshot and trace in `e2e/test-results/` (`npx playwright show-trace …`); CI
  uploads them as the `playwright-report` artifact. Check `logs/dev.log` for the `client.error`
  line.
- Scope: smoke only. Feature behaviour belongs in unit and room tests.
- **Production smoke:** `npm run e2e:prod -w @palikka/e2e` runs `e2e/tests/prod.spec.ts` against
  the live site (`PROD_URL`, default the Pages address) with `playwright.prod.config.ts`; CI runs
  it after every deploy (see operations → Release flow).

## Debugging — Implemented

- **VS Code**: Run and Debug → "Server" (tsx with the `source` condition, so breakpoints in
  `packages/rules` work), "Client" (Chrome + Vite), or "Full stack".
- **Dev shortcut:** `http://localhost:5183/?dev=1v3` (1v1–1v3) starts a quick game against bots,
  `?dev=0v3` (0v2–0v4) a game of bots to watch, as soon as the server is awake; development builds
  only.
- **Lint hook** (for Claude): `.claude/hooks/lint-edited.mjs` runs oxlint on every `.ts`/`.tsx`
  file Claude edits and hands problems back at once.
- **Playwright MCP** (for Claude): `playwright-mobile` = Galaxy S24 (default for UI checks),
  `playwright-ios` = iPhone 15, `playwright` = desktop; all headless and isolated. UI checks cover
  both the light and the dark theme (Kuura) when colours or surfaces change.
- **Render MCP** (for Claude): deploys, service details, production logs. See
  [operations.md](operations.md).

## Conventions — Implemented

- English for all code, identifiers, file and package names; UI text Finnish first + English,
  always through i18next.
- Prefer established libraries over hand-written plumbing; game rules are our own code.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:` …), directly on `main`.
- Reference device: Samsung Galaxy S24 (360×780 CSS px); Android primary, iOS must work; tap
  targets ≥ 44 px.
- Planning: OpenSpec (`/opsx:*`). Each change updates the wiki pages it affects.
