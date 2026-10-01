# Tasks

Kit work happens in `../game-kit` (push to its `main`), the game in `../connect-four` (push to
`Jukkakot/connect-four` `main` once it exists). Both use the same commit conventions as Palikka.

## 1. Kit fixes before generating

- [ ] 1.1 Template deploys skip before setup (D5): `deploy-client.yml` skips when `vars.VITE_SERVER_URL` is empty, `ci.yml`'s `deploy-server` when `RENDER_DEPLOY_HOOK_URL` is empty, `prod-smoke.yml` likewise if scheduled; each prints a notice pointing at `docs/operations.md`; the checklist there mentions it. Verify with the kit's `npm run check` and `npm run template:check`; push the kit

## 2. Generate the game

- [ ] 2.1 Run `npm run create-game -- connect-four --port 2587 --title "Neljän suora"` (D1); in `../connect-four` run its check chain (`lint`, `typecheck`, `test`, `build`, `size -w @connect-four/client`) and `npm run e2e`; any friction → fix in the kit + the game or note as a kit TODO below (D5); if a kit package changed, release a patch and `kit:use` it
- [ ] 2.2 Quick UI check on its dev server (2587/5193, Playwright mobile portrait): start screen shows "Neljän suora", a device game against the bot runs to the end; no console errors

## 3. The game's own spec base

- [ ] 3.1 `openspec/context/product.md`: "The game" section with D2's rules, controls, bots and legal note; keep the theme TODO for `theme`
- [ ] 3.2 `openspec/context/roadmap.md`: D3's table and "Later, to consider"; verify `openspec validate --all` passes; commit in the game repo

## 4. GitHub repo

- [ ] 4.1 `gh repo create Jukkakot/connect-four --public --source . --push` (D4); verify with `gh run list` that check and e2e are green and the deploy jobs skipped (not failed)

## 5. Palikka wiki and roadmap

- [ ] 5.1 `docs/template.md`: one line that Neljän suora (`Jukkakot/connect-four`) is the first game made from the template; `openspec/context/roadmap.md` item 14 → done with the repo link; list kit TODOs (if any) in this file below; commit and push Palikka (docs only: no check chain needed)

## Kit TODOs found on the way

(none yet)
