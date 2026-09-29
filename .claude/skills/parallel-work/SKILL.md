---
name: parallel-work
description: Run OpenSpec changes in parallel in this repo - this session as coordinator, each job a background agent in its own git worktree, then merge, check, archive. Use when starting a parallel job (rinnakkaistila, or the user chose parallel in ask mode).
---

# Parallel work (coordinator)

The modes (ask / säästö / rinnakkain) and what fits are in `.claude/CLAUDE.md` → Parallel work.

1. Commit and push your own work first (clean `main`).
2. Each job is a background `Agent` with `isolation: "worktree"`, one OpenSpec change per job,
   with a short brief: change name, goal, files it may touch, and these rules:
   - autopilot applies; `npm ci` first;
   - propose + apply + commit on its own branch;
   - run only the touched workspace's tests plus `lint` and `typecheck`;
   - no dev servers, no UI check, no push, no archive, do not edit `openspec/context/roadmap.md`;
   - update the wiki pages it affects;
   - UI placement: anything that would cover or hide a control (a fixed card, overlay, toast over
     buttons) is not decided in the job; describe the options under **"Coordinator to do"**;
   - changes it needs outside its allowed files (hot files, roadmap, other workspaces): do not
     make them, list them under **"Coordinator to do"** in the answer, each concrete enough to
     implement (file, what and why);
   - answer in at most 10 lines (branch, commits, decisions, open issues, anything awkward), plus
     the "Coordinator to do" list.
3. Keep working on your own item meanwhile; do not poll the jobs.
4. When a job reports: merge its branch into `main` (rebase on conflicts; you resolve them,
   typically i18n JSON and docs). Then implement its "Coordinator to do" items yourself, and any
   open issue that is only blocked by the job's file limits, as part of the same change (update
   its tasks.md and design.md, add tests at the right level). Only a real product decision goes
   to the user instead. Then run the full check chain **once** for everything merged so far,
   do the UI check on the local dev servers if the job is visible, archive the change (specs,
   roadmap; tick the job's own "roadmap marked done" task), commit, push, remove the worktree and
   branch. On Windows `git worktree remove` fails on the job's `node_modules` ("Directory not
   empty") after unregistering it: finish with PowerShell
   `Remove-Item -Recurse -Force .claude\worktrees\<name>`, then `git branch -d <branch>`.
5. One summary covers all jobs; the user sees the decisions per change and what you added from
   the jobs' "Coordinator to do" lists.

If the user prefers to steer a job themselves, create the worktree instead
(`git worktree add ../palikka-<change> -b <change>`) and give a one-line start message for a
new session there; the merge and archive steps stay the same.
