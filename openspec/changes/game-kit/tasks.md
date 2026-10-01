# Tasks

Kit repo work happens in a sibling checkout `../game-kit` (created in 1.1). Commit there with the
same conventions; push to its `main` (the user approved creating and pushing the public repo).

## 1. Kit repository

- [ ] 1.1 Create `Jukkakot/game-kit` (public, `gh repo create`) and clone it to `../game-kit`; verify `gh repo view Jukkakot/game-kit` shows it public
- [ ] 1.2 Copy `packages/kit-protocol|kit-server|kit-client|bots` to `packages/protocol|server|client|bots`, rename `game-bots` → `@game-kit/bots` (package name, imports, test names), copy the root tooling files (D1); verify `npm install && npm run lint && npm run typecheck && npm test && npm run build` passes in the kit
- [ ] 1.3 Make React, Colyseus, `@colyseus/schema`, `@colyseus/sdk` and zod peer dependencies with dev copies (D4); verify the kit's check chain still passes
- [ ] 1.4 Port the boundary rules (oxlint override without game names except a generic one, `boundary.test.ts` over the new folder names; `@game-kit/bots` imports no other kit package); verify a deliberate `../../../` import fails lint, then remove it
- [ ] 1.5 Write `README.md` and `.claude/CLAUDE.md` (D1); verify the README's local-dev and release commands match the scripts

## 2. Packing and release

- [ ] 2.1 Write `tools/pack.mjs` (D3: build, stage, strip `source`, internal deps → release URL or `--local` `file:` tarball, drop `private`) and `npm run pack`; verify with `tar -tzf` and the staged `package.json` that each of the four tarballs has `dist/` only, no `source` condition and the right internal URLs
- [ ] 2.2 Write `npm run release -- <version>` (lockstep version, check chain, commit, tag, push) and `.github/workflows/ci.yml` + `release.yml` (D2); push, verify the CI run is green with `gh run list`
- [ ] 2.3 Release `0.1.0`; verify `gh release view v0.1.0` lists four tarballs and one URL downloads with `curl -L -o /dev/null -w "%{http_code}"` = 200

## 3. Palikka on the released kit

- [ ] 3.1 Write `tools/kit/use.mjs` (`<version>` and `local [path]`) and `tools/kit/check.mjs`, wire `kit:use` and the check into `npm run lint` (D5); verify `check.mjs` fails on a `file:` spec and passes on release URLs
- [ ] 3.2 Remove `packages/kit-*` and `packages/bots` from the workspaces and the tree, drop the kit lint override, run `npm run kit:use -- 0.1.0`, rename `game-bots` imports to `@game-kit/bots`; verify `npm ls react @colyseus/schema colyseus @colyseus/sdk zod` shows one copy each
- [ ] 3.3 Update `deploy-client.yml` (no `-w game-bots`) and `tournament.yml` (no `packages/bots/**`); verify with `grep -rn "game-bots\|kit-" .github` returning nothing stale
- [ ] 3.4 Run the check chain and the E2E smoke (`npm run e2e`); note the client bundle size change in this file; verify all pass
- [ ] 3.5 Try `npm run kit:use -- local` once and back to `0.1.0`; verify Palikka's tests pass on the local tarballs and `git diff` is clean afterwards
- [ ] 3.6 UI check on the dev server with `/?dev=1v3` (portrait, light): a bot game plays to a few moves; verify no console errors

## 4. Wiki and roadmap

- [ ] 4.1 Update `docs/architecture.md` (workspaces table: kit as installed packages from `Jukkakot/game-kit`, boundary now in the kit repo), `docs/development.md` (kit dev loop `kit:use local`, releasing a kit version, lint note, build order), `docs/operations.md` (kit releases as a dependency source), `docs/template.md` (kit rows point to the kit repo; `game-bots` → `@game-kit/bots`); verify `grep -rn "game-bots\|packages/kit-" docs` only shows intended history mentions
- [ ] 4.2 Mark `game-kit` done in `openspec/context/roadmap.md`; commit and push Palikka, verify Palikka's CI run on `main` is green (`gh run watch`) including the server deploy job's `npm ci`
