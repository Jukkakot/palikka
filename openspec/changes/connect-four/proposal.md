# Proposal

## Why

The game kit and its template (`create-game`) exist but no game has been made from them yet.
Neljän suora (Connect Four in our own words) is small enough to finish quickly and different
enough from Palikka (gravity, columns, two seats, a solved game with deep bot search) to show
where the kit and the template still assume Palikka. Making it is the kit's first real test.

## What Changes

Almost all of it happens outside Palikka: in a new project `../neljan-suora` and in the kit
repo `../game-kit`. Palikka only updates its wiki and roadmap.

- **Create the game:** `npm run create-game -- neljan-suora --port 2587 --title "Neljän suora"`
  in the kit checkout gives `../neljan-suora` (server 2587, client 5193), pinned to the kit's
  newest release. Its check chain and E2E smoke pass on the placeholder game as generated.
- **GitHub repo:** `Jukkakot/neljan-suora` (public) is created and `main` pushed (the user gave
  the go-ahead in the spec phase). Render, Axiom and Pages stay for the game's own
  `first-deploy` change.
- **The game's own spec base:** the new repo's `product.md` gets the rules of Neljän suora in our
  own words (7 × 6 grid, discs drop to the lowest free cell, four in a row in any direction wins,
  full grid is a draw) and its own ideas (column-first controls, a strong searching bot, later
  options); `roadmap.md` is tailored from the starter roadmap (`theme`, `rules-engine`,
  `game-ui`, `bot-v1`, `first-deploy`, later ideas). The game is then built through its own
  changes in its own repo, not here.
- **Kit fixes found on the way:** every place where generating or pushing the game needed a
  workaround is fixed in the template or `create-game` when cheap (known one: the deploy
  workflows fail on a fresh repo before the setup checklist is done; they should skip cleanly),
  otherwise written down as a kit TODO. A kit release follows if the kit's packages change.
- **Palikka:** `docs/template.md` notes the first game made from the template; roadmap item 14
  done, with a pointer to the new repo.

Non-goals: the theme, the real rules, the board UI, the bot and the deploy of Neljän suora (all
the new repo's own changes); moving the copied client components into a `@game-kit/ui` package
(possible later, now that two games share them); changes to Palikka's gameplay or code.

## Capabilities

### New Capabilities

None — no behaviour of Palikka changes (`skip_specs: true`). Neljän suora's specs live in its own
repo.

### Modified Capabilities

None.

## Impact

- Workspaces: none of Palikka's (rules, server, client) change.
- New project `../neljan-suora` and GitHub repo `Jukkakot/neljan-suora`.
- Kit repo: template and `create-game` fixes found while generating; maybe a patch release.
- Palikka wiki: `docs/template.md`; `openspec/context/roadmap.md`.
