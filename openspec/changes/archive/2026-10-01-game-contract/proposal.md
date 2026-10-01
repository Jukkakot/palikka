## Why

The next browser games should start from a strong shared base instead of a copy that goes stale (Labyrinth still sits at the commit Palikka was copied from). The generic room, lobby, bot-runner and session logic is tangled with Palikka's rules in `GameRoom.ts`, `LocalRoom`, `viewModel.ts` and `useGameSession.ts`, so it cannot be shared yet. This change draws the line: a game contract that the generic parts use and Palikka implements.

This is step 1 of 3. `game-kit` (step 2) moves the generic packages to their own repository, and Palikka then depends on a tag. `game-template` (step 3) adds a template and a `create-game` script. The first new game made with them, Connect Four (step 4, a project of its own), is the kit's first outside user. Labyrinth is not migrated.

## What Changes

- New in-repo workspace packages under the future kit scope `@game-kit/*`. None of them may import a Palikka package.
  - `@game-kit/protocol`: the game contract types; the generic command, join-option, close-code and lobby payload definitions; the generic error codes and log events; a small two-seat test game (`@game-kit/protocol/testing`).
  - `@game-kit/server`: the room base (`LoggedRoom`, command wrapper, readable ids, server logging) and a generic game room. It handles seats, host, bots, the bot runner and fallback, the turn clock and kick, autoplay, spectators, rematch, removal and the finish, all driven by the contract.
  - `@game-kit/client`: the session hook, the device-game room with undo and saving, the lobby part of the view model, the bot runner hook, the stores, server wake-up and client logging.
- Palikka implements the contract. The rules part lives in `packages/rules` and is shared by the server and the client. The server part is the move schema, synced fields, the variant command and log facts. The client part is the view, the bot request and the device-game setup.
- `server/src/rooms/GameRoom.ts` becomes a thin Palikka room on the kit room. The client's session files become Palikka adapters over the kit.
- Gameplay and UI do not change. The wire does change, and that is accepted (user, 2026-09-30). The generic `move`/`botMove` replace `place`/`botPlace`, and the generic `setOptions` replaces `setVariant`. The game's synced data moves under `state.game`, and the join options and listing carry the game's `options`. A client and a server from different deploys do not understand each other until the client reloads, and a device game saved before the change is dropped once.
- The generic room test suites move to `@game-kit/server` and run over the test game. Palikka keeps its wiring tests.

## Capabilities

### New Capabilities

None. This is a structural refactor with no change in observable behaviour, so the change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- Workspaces: `packages/protocol`, `packages/rules` (a thin contract adapter only, no rule changes), `server`, `client`, and three new `packages/kit-*` workspaces. `packages/bots` (`game-bots`) is untouched; it is renamed in `game-kit`.
- Hot files, all of them: `GameRoom.ts`, `GameState.ts`, `localRoom.ts`, `useGameSession.ts`, `viewModel.ts`. No parallel work while this runs.
- The client bundle is 194/200 kB. The limit may be raised (see design), since mobile load speed is what counts.
- Logs: `variant.changed` becomes `options.changed`, and the command names in audit lines follow the wire. The Axiom filters in `tools/axiom` are updated.
- Docs: `docs/architecture.md` (workspaces, server, client, "adding a command"), `docs/template.md` (what is now in the kit), `docs/development.md` (new workspaces). Roadmap: this change plus `game-kit`, `game-template` and `connect-four` as planned items.
