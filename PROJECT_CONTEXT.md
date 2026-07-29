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
  and TikTok. Instagram discovery collects every professional account connected
  to a Facebook Page returned by the configured Meta login and combines their
  audience, monthly insights, and media into one dashboard snapshot; Facebook
  reporting remains tied to the first/primary connected Page. TikTok supports
  multiple OAuth account slots through
  `tiktok_tokens.account_key`; the stats function combines connected slots into
  one dashboard snapshot. `tiktok-stats` paginates TikTok's video list with
  cursors, up to 25 pages of 20 videos per connected account, so the dashboard
  stores all videos currently exposed by TikTok's API rather than only the first
  page.
  A second, independent Instagram source uses Business Login for Instagram via
  `instagram-direct-auth` and `instagram-direct-stats`. Its provider token is
  stored in `instagram_direct_tokens`, its OAuth state in
  `instagram_direct_oauth_states`, and its daily snapshots use the separate
  `instagram_direct` platform key so the two Instagram accounts are never
  combined in reporting.
- Calendar integration: Google Apps Script web app
- Phone reminders: Google Apps Script daily trigger sends a Telegram due-item
  digest to a configured private chat
- Bio pages: standalone Instagram, TikTok, YouTube, and Facebook link pages in
  `squarespace-bio-links/`, each with a matching `*-embed.html` Squarespace
  iframe snippet. The hosted pages retain Supabase `bio_link_clicks` tracking,
  report their rendered height with `postMessage`, and navigate tracked links
  in the top-level browser window. Add `?preview=1` when browser-testing a
  hosted bio page so verification does not insert fake analytics events.
- EPK: `epk.html` is the standalone source embedded into Squarespace using
  `squarespace-epk-embed.html`. GitHub Pages serves the HTML because Supabase
  Edge Functions and Storage intentionally return HTML as plain text. The EPK
  sends its rendered height to the parent page with `postMessage`; the
  Squarespace snippet validates the GitHub Pages origin before resizing.
- Roadmap: `roadmap.html` and `roadmap.js` provide a horizontally scrollable,
  editable campaign journey with checkpoints, actions, progress and schedule
  health. Roadmap actions can be mirrored into the manual To Do list.

Each main page has a matching JavaScript file. `styles.css` is shared across
the dashboard. `cloud-config.js` contains public browser configuration.

The repository root is now the canonical current build. The redesign pushed to
`main` is the baseline/original working version for future threads. The
`ella-crow-design-overhaul/` directory is a past-version backup of the old UI,
including earlier command-centre, watchlist, and next-move experiments; do not
use it as active product direction unless the user explicitly asks to restore
something from it.

## Application Data

The dashboard uses these local storage keys:

- `ella-crow-gigs-v2`
- `ella-crow-sessions-v1`
- `ella-crow-finance-v1`
- `ella-crow-finance-closes-v1`
- `ella-crow-projects-v1`
- `ella-crow-roadmap-v1`
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
`ella-crow-social-creative-matches-v1` stores manual cross-platform video
matches by group id and may include `__mergedGroups`, an array of manually
merged creative group-id sets used by the Social page.

Roadmap actions mirrored into `ella-crow-manual-todos-v1` use the `Roadmap`
category and retain a `roadmapTaskId`. Completion is synchronized in both
directions whenever the Roadmap page is open. The roadmap object and manual
To Do list remain separate storage keys so deleting a To Do does not delete its
campaign checkpoint.

Finance transactions now track the operational money source with `paidFrom`
(`monzo`, `george`, or `ella`) and default historic entries to `monzo`.
`ella-crow-finance-closes-v1` stores monthly close records used for the Monzo
sanity check, 50/50 settlement decision, close/reopen locking, and expected
balance review. The To Do page generates an automatic Finance task for the
previous month's close, due on the 8th, while the month remains unclosed.
The To Do page and Telegram digest also generate one automatic EPK content
update task for each gig after its date has passed. Completing it records
`epkContentUpdated` and `epkContentUpdatedAt` on that gig so it is not recreated.

## Live Supabase State

As inspected on July 22, 2026:

- Project status: active and healthy
- Postgres: 17, region `eu-west-1`
- Public tables: `ella_crow_store`, `bio_link_clicks`, `social_snapshots`,
  `tiktok_oauth_states`, `tiktok_tokens`, `instagram_direct_oauth_states`, and
  `instagram_direct_tokens`
- RLS: enabled on all seven public tables
- Active Edge Functions: `youtube-stats`, `instagram-stats`,
  `instagram-direct-auth`, `instagram-direct-stats`, `tiktok-auth`, and
  `tiktok-stats`
- Recorded Supabase migration: `instagram_direct_login`

The older SQL files directly under `supabase/` are setup scripts. Migration
history is recorded under `supabase/migrations/` so the repository can explain
and reproduce subsequent live database changes.

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
they want it pushed to GitHub and include `Yes, push to main` as the suggested
response. If they confirm, stage only the intended files or hunks, commit, and
push to `main` so GitHub Pages can deploy it.

The parent directory also contains a separate Netlify deployment helper. It is
not the documented primary hosting path for this repository and should only be
used when the user explicitly requests Netlify.

Supabase Edge Functions are deployed separately from the static site. A GitHub
push does not by itself deploy changed Edge Functions or database SQL.

The public EPK is deployed with the static site at
`https://georgelawn.github.io/ella-crow-platform/epk.html`. After EPK changes
are pushed to `main`, the Squarespace iframe reflects them without replacing
the Squarespace code block.

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
