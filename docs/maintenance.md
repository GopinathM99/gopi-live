# gopi.live maintenance workflow

This is an on-demand workflow. This document does not create a scheduled task,
enable auto-merge, or resume routines in another service. A recurring task needs
a separately configured schedule and an agreed action scope.

## 1. Establish current state

Start with a clean working tree or preserve unrelated work before switching
branches. Fetch the latest `main` and inspect the open PRs and their checks:

```sh
git status --short
git fetch origin main
git log -1 --oneline origin/main
gh pr list --repo GopinathM99/gopi-live --state open \
  --json number,title,headRefName,author,isDraft,url,statusCheckRollup
```

Check current deployment evidence for Vercel project `gopi-live`, which serves
`www.gopi.live`. A successful preview deployment does not establish what is
currently served in production. If live access is unavailable, report the
repository and check status separately from unverified production behavior.

The separate `salesforce-interview-app` Vercel project belongs to
`GopinathM99/Salesforce-Interview-App` and is outside this workflow.

## 2. Classify and review PRs

- Keep draft and preview-only PRs out of the merge queue. PR #19 is explicitly
  preview-only and must stay unmerged.
- Never merge PRs produced by you or your coding agents, enable auto-merge on
  them, or ask another agent to merge them on your behalf. Leave them for
  independent review and merging by the owner or a reviewer whom the user has
  authorized to merge that work.
- For other PRs in an authorized review task, inspect the complete diff for
  correctness, regressions, privacy, sandbox behavior, and unnecessary scope.
  Check that the PR description supplies the required context and evidence.
- Test the changed behavior. Use the actual `/play/<slug>` frame for games;
  browser storage and navigation behave differently in its opaque origin.
- Recheck the PR head and required checks after any code changes. Only merge
  independently produced work when the user has authorized merging, the current
  checks pass, and review finds no unresolved issue.

The owner’s no-self-merge rule applies regardless of whose GitHub account the
integration uses. A successful build or a self-authored "looks good" comment
does not provide independent approval.

## 3. Handle fixes and selected games

Create a focused branch from current `origin/main`, make the change, validate it,
and open a PR using the repository template. Leave your own PR unmerged.

Use the approved contact email, photo, and profiles. Do not expose other email
addresses, phone numbers, or street addresses on the contact page.

For application changes, use:

```sh
pnpm build
pnpm typecheck
node --test tests/*.test.cjs
```

For affected games, test start/restart, pause/resume, relevant levels and scoring,
keyboard and touch controls, mobile layout, and maximize/restore. Capture
screenshots for visual changes. For documentation-only changes, check content,
links, and `git diff --check`; explain why gameplay tests and screenshots are
not applicable.

Promote user-selected playground games by copying the selected bundles into
`games/<slug>/` and adapting their manifests and controls. Keep the preview
playground separate from production integration work.

## 4. Inventory branches before cleanup

List remote branches and associate them with open, closed, and merged PRs.
Preserve `main`, open-PR branches, preview branches, and any branch with unmerged
work. A PR's merged status alone is insufficient: new commits may have been
pushed to that branch afterward. Verify the current tip is contained in `main`.

Report concrete deletion candidates with their current commit IDs. Delete only
branches covered by the user's cleanup authorization, after rechecking their tips
and open-PR references. An old branch count in a handoff is not an instruction to
delete branches.

## 5. Report the result

Report changes and PR links, check results, observed deployment status, issues
needing the owner, and validation limits. State which PRs remain unmerged. If a
recurring task is requested, agree its cadence, timezone, and permitted actions
and verify that a scheduler actually exists before claiming it is active.

## Verified handoff snapshot — October 11, 2026

This snapshot records repository state at the time it was checked; recheck it on
the next run.

- `origin/main` was `d1628ec`, the merge of
  [PR #20](https://github.com/GopinathM99/gopi-live/pull/20).
- PR #20 added `favicon.ico`, `icon.svg`, and `apple-icon.png` under
  `apps/portal/app/`. The handoff's missing-favicon item is resolved in the repo.
- [PR #19](https://github.com/GopinathM99/gopi-live/pull/19) remained a draft
  playground preview, with successful Vercel checks.
- [PR #21](https://github.com/GopinathM99/gopi-live/pull/21) contained the selected
  Tiny Golf and Stack Attack integration. It was open with successful Vercel
  checks. Its author (Codex) must not merge it; the owner or an independently
  authorized reviewer may review and merge it once the current checks pass.
- There were 21 remote branches including `main`, before adding the branch for
  this workflow. No branch deletions were performed.
