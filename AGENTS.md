# Ella Crow Platform Agent Guide

Read `PROJECT_CONTEXT.md` before making changes. Treat it as the durable handoff
between threads and update it when architecture, integrations, deployment, or
verification procedures change.

## Working Directory

The repository root is this directory:

`i-want-to-build-a-locally/ella-crow-platform`

Always confirm `git rev-parse --show-toplevel` points here before using git.
The parent Codex workspace is not the repository.

## Change Workflow

1. Inspect `git status --short --branch` and do not overwrite unrelated changes.
2. Read the relevant HTML, JavaScript, CSS, SQL, or Edge Function files.
3. Make the smallest change consistent with the existing static-site structure.
4. Run `node scripts/check-static.mjs`.
5. Use browser verification only when the change affects layout, responsive
   behavior, browser events, or a complete user flow. Prefer one focused final
   pass; do not repeatedly screenshot unchanged pages.
6. After making any HTML or JavaScript change and completing verification, ask
   the user whether they want it pushed to GitHub. When the UI supports
   clickable response options, present `Yes, push to main` as a clickable
   suggested option. If clickable options are unavailable, include
   `Yes, push to main` as the typed suggested response. If they say yes,
   efficiently follow the GitHub rules below: stage only the intended files or
   hunks, commit, and push to `main`.
7. Summarize changed files, verification performed, and any live services
   changed.

## GitHub

- Repository: `georgelawn/ella-crow-platform`
- Remote: `https://github.com/georgelawn/ella-crow-platform.git`
- Default branch: `main`
- Use the GitHub plugin workflow for GitHub context, pull requests, and
  publishing. Use local git for status, diffs, branches, commits, and pushes
  where required by that workflow.
- Do not push, commit, or open a pull request unless the user asks.
- GitHub Pages deploys from `main`. When the user asks to "push", "publish",
  "make it live", or similar for normal app/site changes, commit the intended
  scope and push it to `main` unless the user explicitly asks for a branch or PR
  only. A push only to a `codex/...` branch is not enough to make the live site
  update.
- For HTML or JavaScript changes, do not assume the user wants an immediate
  push just because the code is complete. Ask first with a clickable
  `Yes, push to main` option when supported; otherwise provide that exact text
  as the suggested response. Proceed promptly if confirmed.
- When the user asks to push, first identify the intended scope from the current
  request and `git diff --name-only`. If the worktree contains unrelated edits,
  stage only the intended files or hunks; do not use `git add -A`.
- If working on a `codex/...` branch and the user asked for the change to be
  live, push the current commit to both the working branch and `main`, or push
  `HEAD:main` directly when no branch push is needed.
- Git index writes may require escalated permissions in Codex Desktop. Request
  escalation directly for `git add`, `git commit`, and `git push` when needed
  instead of retrying inside the sandbox.
- If `gh` is unavailable, still commit and push with local git when the user has
  asked to push. State that a PR could not be opened because `gh` is missing.
- After a successful commit or push, include the commit hash, branch name, and
  any remaining uncommitted files in the final summary.

## Supabase

- Use the Supabase plugin/connector for project inspection, SQL, migrations,
  Edge Functions, advisors, and logs. Do not use the Supabase dashboard in a
  browser unless the connector cannot perform the required action.
- Project ID: `hmwnkhgsocdevehebjpq`
- Region: `eu-west-1`
- Local config: `supabase/config.toml`
- Never expose service-role keys, provider secrets, or OAuth tokens in frontend
  code or commits. The publishable key in `cloud-config.js` is intentionally
  public and relies on RLS.
- All exposed tables must keep RLS enabled.
- Database changes must be represented by committed migration files under
  `supabase/migrations/`. Prefer connector SQL for iteration, then create a
  clean migration and verify the live schema.
- Edge Function source under `supabase/functions/` is the repository source of
  truth. After deployment, verify the deployed function and local source agree.

## Verification

`node scripts/check-static.mjs` performs the inexpensive default checks:

- JavaScript syntax
- local HTML script and stylesheet references
- required project files and assets
- Supabase project ID consistency

Browser verification is still required for visual CSS changes, responsive
behavior, and interaction changes that cannot be established statically. It is
not required for documentation-only, SQL-only, configuration-only, or
straightforward non-DOM logic changes when the static checks cover the risk.

## Important Constraints

- This is a static HTML/CSS/JavaScript site hosted from GitHub Pages.
- Shared application data is mirrored between `localStorage` and the
  `public.ella_crow_store` Supabase table by `app-cloud.js`.
- Social data is fetched through Supabase Edge Functions; provider secrets must
  remain server-side.
- Google Calendar sync is handled by the Apps Script source in
  `apps-script/google-calendar-sync-webapp.gs`.
- Cache-busting query versions in HTML should be incremented when changing a
  referenced CSS or JavaScript asset that browsers may cache.
