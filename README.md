# Ella Crow Platform

This is a lightweight management dashboard for Ella Crow. It is designed to run as a static site on GitHub Pages, with Supabase storing shared dashboard data and Google Apps Script handling one-way Google Calendar sync.

For development and fresh-thread handoff, read `AGENTS.md` and
`PROJECT_CONTEXT.md`. Run the dependency-free project checks with:

```sh
node scripts/check-static.mjs
```

## Current Features

- Add, edit, delete, and filter gigs
- Track booked, TBC, and complete shows
- Automatically treats past-dated gigs as complete unless manually overridden
- Shows ticket totals for the current month and previous month
- Expands each gig to show players, contact, location, and notes
- Calendar page with clickable dates showing gigs and sessions
- Sessions page for rehearsals, recordings, and meetings
- Finance page for editable revenue, expenses, invoice status, and month-by-month turnover
- Projects page for tracking revenue streams, milestones, progress, deadlines, and project momentum
- To Do page with manual tasks plus auto tasks from gigs, sessions, pending invoices, and opportunity follow-ups
- Opportunities page for manually tracking outstanding leads and follow-up dates
- Social tracker page for YouTube channel metrics and recent-video performance
- Contacts page with sections for Musicians, Promoters, Venues, Other Artists, and Misc
- Musician contacts and the gig/session player dropdowns share the same saved list
- Supabase sync for laptop and iPhone use
- Optional one-way Google Calendar sync through Google Apps Script

The email connector has been removed. Opportunities/follow-ups are tracked manually.

## GitHub Pages Hosting

GitHub Pages can host this dashboard for free because it is static HTML, CSS, and JavaScript.

Recommended setup:

1. Create a GitHub repository, for example `ella-crow-platform`.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open `Settings > Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select the `main` branch and `/ (root)` folder.
6. Save. GitHub will publish the site at a `github.io` URL.

The `.nojekyll` file is included so GitHub serves the files exactly as they are.

## Supabase Sync

The app currently points at the existing Supabase project in `cloud-config.js`:

```js
window.ELLA_CLOUD_CONFIG = {
  enabled: true,
  supabaseUrl: "https://hmwnkhgsocdevehebjpq.supabase.co",
  supabaseAnonKey: "sb_publishable_5RLD78oK3TMo-SnPf1tljA_9d7-zuHn",
  tableName: "ella_crow_store",
  googleCalendarSyncUrl: ""
};
```

Keep the hosted dashboard link private. This setup is intended for personal use, not public account management.

## Google Calendar Sync

GitHub Pages cannot run backend functions, so Google Calendar sync is handled by a free Google Apps Script web app.

To set it up:

1. Go to [script.google.com](https://script.google.com/).
2. Create a new Apps Script project.
3. Paste in the contents of `apps-script/google-calendar-sync-webapp.gs`.
4. Check `CALENDAR_ID` at the top of the script. It is currently set to:

```js
const CALENDAR_ID = "ellacrowmusic@gmail.com";
```

5. Click `Deploy > New deployment`.
6. Choose `Web app`.
7. Set `Execute as` to `Me`.
8. Set `Who has access` to `Anyone`.
9. Deploy and approve the calendar permissions.
10. Copy the Web App URL.
11. Paste that URL into `cloud-config.js`:

```js
googleCalendarSyncUrl: "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL"
```

After that, saving or editing a gig/session will queue a one-way sync into Google Calendar.

Event naming:

- Gigs: `Show Name @ Location`
- Sessions: `Title`

Event colours:

- Gig: red
- Rehearsal: green
- Recording: blue
- Meeting: mauve

## YouTube Social Tracker

The Social page uses the YouTube Data API to collect channel totals and recent-video performance.
It keeps one snapshot per day in the shared Supabase store, which allows the dashboard to build
month-on-month growth charts over time.

To connect YouTube:

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the `YouTube Data API v3`.
3. Create an API key.
4. Restrict the key to the YouTube Data API and the hosted dashboard's HTTP referrer.
5. In the Apps Script project, open `Project Settings > Script Properties`.
6. Add a property named `YOUTUBE_API_KEY` and paste the API key as its value.
7. Replace the Apps Script code with the latest
   `apps-script/google-calendar-sync-webapp.gs`, then create a new web-app deployment.
8. Update `googleCalendarSyncUrl` in `cloud-config.js` if the deployment URL changed.

The channel ID is fixed in the Supabase Edge Function at
`supabase/functions/youtube-stats/index.ts`. The YouTube API key is stored as the private Supabase
secret `YOUTUBE_API_KEY` and never reaches GitHub or the browser. Collected metrics are synced
through Supabase. The page refreshes automatically when opened if the latest snapshot is more than
12 hours old.
