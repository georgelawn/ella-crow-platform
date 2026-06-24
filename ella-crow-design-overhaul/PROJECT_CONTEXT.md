# Project Context

## Purpose

Ella Crow Platform is a private artist-management dashboard built as a static
site. It tracks gigs, sessions, finances, projects, tasks, opportunities,
contacts, calendar events, social performance, and bio-link analytics.

## Architecture

- Hosting: GitHub Pages from the repository root on `main`
- Frontend: plain HTML, CSS, and browser JavaScript; no build step
- Shared state: browser `localStorage`, synchronized by `app-cloud.js`
- Database: Supabase project `hmwnkhgsocdevehebjpq`
- Social integrations: Supabase Edge Functions for YouTube, Instagram/Facebook,
  and TikTok
- Calendar integration: Google Apps Script web app
- Phone reminders: Google Apps Script daily trigger sends a Telegram due-item
  digest to a configured private chat
- Bio pages: embeddable Squarespace snippets in `squarespace-bio-links/`

Each main page has a matching JavaScript file. `styles.css` is shared across
the dashboard. `cloud-config.js` contains public browser configuration.

## Application Data

The dashboard uses these local storage keys:

- `ella-crow-gigs-v2`
- `ella-crow-sessions-v1`
- `ella-crow-finance-v1`
- `ella-crow-projects-v1`
- `ella-crow-manual-todos-v1`
- `ella-crow-todo-snoozes-v1`
- `ella-crow-auto-todo-completions-v1`
- `ella-crow-opportunities-v1`
- `ella-crow-contacts-v1`
- `ella-crow-roster-v1`
- `ella-crow-instruments-v1`

`app-cloud.js` synchronizes these values through `public.ella_crow_store`.
Changes to key names or stored object shapes are data migrations and must
preserve existing user data.

## Live Supabase State

As inspected on June 15, 2026:

- Project status: active and healthy
- Postgres: 17, region `eu-west-1`
- Public tables: `ella_crow_store`, `bio_link_clicks`, `social_snapshots`,
  `tiktok_oauth_states`, and `tiktok_tokens`
- RLS: enabled on all five public tables
- Active Edge Functions: `youtube-stats`, `instagram-stats`, `tiktok-auth`, and
  `tiktok-stats`
- Recorded Supabase migrations: none

The SQL files currently in `supabase/` are setup scripts, not migration-history
files. Future schema changes should use `supabase/migrations/` so the repository
can explain and reproduce the live database state.

## Security Model

- The browser uses the publishable Supabase key from `cloud-config.js`.
- RLS and grants are the security boundary for browser-accessible data.
- Provider API keys, OAuth client secrets, service-role keys, and TikTok tokens
  belong only in Supabase secrets or protected database tables.
- The site is intended for private operational use even though GitHub Pages
  assets are publicly reachable.

## Deployment

GitHub Pages deploys the static site from `main`. The git remote is
`georgelawn/ella-crow-platform`. For this project, a user request to "push" or
"make it live" normally means commit the intended change and push it to `main`;
publishing only to a `codex/...` branch will not update the live GitHub Pages
site.

After completing and verifying any HTML or JavaScript change, ask the user if
they want it pushed to GitHub. Use a clickable `Yes, push to main` option when
the chat UI supports clickable responses; otherwise include that exact text as
the typed suggested response. If they confirm, stage only the intended files or
hunks, commit, and push to `main` so GitHub Pages can deploy it.

The parent directory also contains a separate Netlify deployment helper. It is
not the documented primary hosting path for this repository and should only be
used when the user explicitly requests Netlify.

Supabase Edge Functions are deployed separately from the static site. A GitHub
push does not by itself deploy changed Edge Functions or database SQL.

Google Apps Script is also deployed separately from the static site. The source
of truth is `apps-script/google-calendar-sync-webapp.gs`. For Telegram due-item
digests, configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and
`SUPABASE_ANON_KEY` in Apps Script Properties, then run
`testTelegramDueDigest()` and `installTelegramDueDigestTrigger()` from Apps
Script. To let the bot respond when the user messages `update`, run
`installTelegramUpdatePollingTrigger()`; this deletes any Telegram webhook and
checks for updates every minute. The digest reads the existing Supabase
`ella_crow_store` mirror and does not write to Google Calendar.

## Verification Strategy

Start with `node scripts/check-static.mjs`. It is fast and should be run after
every code change.

Use browser testing for:

- CSS, spacing, typography, or responsive changes
- changes to DOM rendering or browser event handlers
- forms, navigation, or multi-step user flows
- final confirmation of a significant frontend change

Skip browser testing for documentation-only changes and normally for isolated
SQL, Edge Function, configuration, or non-DOM logic changes when direct checks
cover the behavior. Avoid repeated screenshots; inspect only the affected page
and viewport.

## Known Repository State

- `assets/tiktok-app-icon.png` is currently untracked. Do not delete or commit it
  without confirming that it belongs in the requested change.
- There is no automated end-to-end test suite.
- There is no checked-in baseline migration matching the current live Supabase
  schema.
- HTML files use manual cache-busting versions such as `styles.css?v=16`.

## Fresh Thread Checklist

1. Open this repository as the workspace root.
2. Read `AGENTS.md` and this file.
3. Check git status and recent commits.
4. Read only the files relevant to the requested change.
5. Use the Supabase connector for live backend context when needed.
6. Run `node scripts/check-static.mjs`, then use a focused browser pass only
   when the change warrants visual or interaction verification.
