# Repository instructions

## Changes and pull requests

- Never push directly to `main`. Make changes on a branch and open a PR.
- Never merge your own PRs, including PRs created by coding agents working for
  you. Do not enable auto-merge on those PRs or arrange for another agent to merge
  them. Leave the merge to the repository owner or an independent reviewer whom
  the user has authorized to merge that work.
- Do not submit an independent approval or a "looks good" review for your own
  work or your coding agents' work. Check and test your changes before opening
  the PR, and report that validation accurately.
- Merge someone else's PR only when the user has explicitly authorized that
  review-and-merge workflow. Review the diff and wait for Vercel and all required
  checks to pass on the current PR commit first. General merge authorization
  never permits merging your own PRs.
- Identify who produced the work from the task history, PR description, branch,
  and commits. GitHub integrations can attribute different agents' PRs to the
  same user account, so the GitHub author field alone is insufficient.
- Every PR must describe the summary, before/after behavior, feature details and
  controls, files changed and why, testing, known limitations, and screenshots.
  Follow `.github/pull_request_template.md`. For sections that do not apply,
  explain why; do not invent screenshots or test results.
- PR #19 is a draft playground preview and must remain unmerged. Promote games
  selected by the user through separate integration PRs.

## Site requirements

- The public contact email is `gopinathmerugumala@gmail.com`. Never display a
  phone number, street address, or any other email address on the contact page.
- Keep the approved contact photo and public profile links unless the user asks
  to change them. Contact settings are in `apps/portal/lib/contact.ts`.
- Games are static bundles under `games/<slug>/`, discovered through `game.json`
  and played at `/play/<slug>` in the portal's sandboxed iframe. Keep the sandbox
  enabled, and handle unavailable browser storage gracefully.
- STREET YEET's exaggerated launch distances are intentional.
- The Salesforce Interview Prep site is a separate repository and Vercel
  project. Changes to gopi.live do not authorize changes to that project.

## Maintenance and validation

- Follow [the maintenance workflow](docs/maintenance.md). Verify current remote
  state rather than treating a handoff's commit IDs or open-item list as current.
- Use the pnpm version pinned in `package.json`. For application changes, run
  `pnpm build`, `pnpm typecheck`, and relevant `node --test tests/*.test.cjs`
  checks. Test affected game controls inside the actual sandboxed frame.
- For visual changes, check desktop and mobile layouts and capture screenshots.
  Report any browser, network, or credential limitation that affects validation.
- Documentation-only changes need link, content, and diff checks; they do not
  require unrelated application tests or screenshots of unchanged UI.
- Inventory old branches before any cleanup. Confirm the branch tip is merged
  and no open PR or preview depends on it. Delete remote branches only within
  the user's authorized cleanup scope.
