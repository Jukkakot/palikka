# Game template

A new game starts from the game kit's template: `npm run create-game -- <name> --port <port>` in
`Jukkakot/game-kit` (its README → Start a new game). The template is a complete game project made
from Palikka's generic files, with a placeholder game (Ristinolla) in place of Palikka's rules,
bots, variants, daily puzzle and piece controls. Palikka itself stays as it is: it is never
re-generated. The first game made from it is Neljän suora ([`Jukkakot/neljan-suora`](https://github.com/Jukkakot/neljan-suora), server/client ports 2587/5193).

## Upkeep

A generic improvement made in Palikka (a CI step, a screen fix, a doc rule, a tooling script) is
ported to the template in the same piece of work when it is cheap, otherwise noted as a kit TODO in
the change's `tasks.md`. The kit's `npm run template:check` (and its CI job `template`) keeps the
template working; this rule keeps it current. Never write Palikka's names into the template: its
leftover check refuses them.

## Palikka files and their template counterparts

Paths in the template use the placeholder name (`starter-game`, `starterGame`, `StarterGame`).
"Same" = copied with names and ports replaced; "adapted" = copied, Palikka parts replaced;
"placeholder" = rewritten for Ristinolla (port only the generic pattern).

| Palikka | Template | |
|---|---|---|
| Root files, `.vscode/`, `tools/kit/`, `tools/axiom/`, `render.yaml`, `.mcp.json` | same paths | same |
| `.github/workflows/ci.yml`, `deploy-client.yml`, `prod-smoke.yml` | same paths | same |
| `.github/workflows/tournament.yml` | same path | adapted (formats) |
| `.claude/settings.json`, `hooks/`, `skills/`, `commands/opsx/` | same paths | same |
| `.claude/CLAUDE.md` | same path | adapted (autopilot off, hot files, game kit section) |
| `openspec/config.yaml`, `context/nfr.md` | same paths | adapted (`context` block, legal, performance) |
| `openspec/context/product.md`, `roadmap.md`; `openspec/specs/{start-screen,game-room,bot-seats,device-games}` | same paths | adapted (game-neutral, placeholders marked) |
| `docs/README.md`, `architecture.md`, `development.md`, `operations.md` | same paths | adapted (operations holds the setup checklist) |
| `packages/rules/src/rng.ts` | same path | same |
| `packages/rules/src/contract.ts`, `turns.ts`, `testing.ts` | same paths | placeholder (`game.ts` holds Ristinolla) |
| `packages/protocol/src/*` | same paths | placeholder (codes, move and options schemas, log events) |
| `packages/palikka-bots/src/{adapter,evaluation,match,tournament}.ts`, `cli/`, `strength.json` | `packages/starter-game-bots/…` | placeholder (`cli/` same apart from the formats) |
| `server/src/{index,app.config,buildInfo,cors}.ts`, `server/test/{errors,cors,httpAudit,clientLogs,buildInfo}.test.ts`, `test/support/captureLogs.ts` | same paths | same |
| `server/src/rooms/*`, `server/test/GameRoom.test.ts`, `test/support/game.ts` | same paths | placeholder |
| `client/{vite.config.ts,pwa-assets.config.ts,index.html}`, `client/public/*` | same paths | adapted (name, colours) |
| `client/src/{main.tsx,config.ts,CrashBoundary.tsx,kit.ts}`, `i18n/index.ts`, `settings/*`, `tips/*`, `ui/*` (not `tokens.css`), `motion/*` | same paths | same (settings without the board zoom and variant) |
| `client/src/game/{AutoplayControls,GameIdBadge,GameOverControls,KickControl,LeaveControls,SpectatorControls,TurnTimer,UndoButton,HintButton,SeatMark}.tsx`, `copyLine.ts`, `turnClock.ts` | same paths | same |
| `client/src/game/{TurnLine,PlayerStrip,ResultTable}.tsx` | same paths | adapted (no colours, variants or scores) |
| `client/src/screens/{StartScreen,WaitingRoomScreen}.tsx` | same paths | adapted (no variants, puzzle or how-to) |
| `client/src/screens/GameScreen.tsx`, `session/*`, `bots/*`, `ui/tokens.css`, `i18n/locales/*` | same paths | placeholder |
| `e2e/*` | same paths | configs same; tests placeholder |
