create table if not exists public.tiktok_oauth_states (
  state text primary key,
  account_key text not null default 'ella'
    check (account_key ~ '^[a-z0-9_-]{1,32}$'),
  expires_at timestamptz not null
);

create table if not exists public.tiktok_tokens (
  id smallint default 1,
  account_key text primary key default 'ella'
    check (account_key ~ '^[a-z0-9_-]{1,32}$'),
  open_id text not null,
  access_token text not null,
  refresh_token text not null,
  scope text not null default '',
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.tiktok_oauth_states enable row level security;
alter table public.tiktok_tokens enable row level security;
revoke all on table public.tiktok_oauth_states from anon, authenticated;
revoke all on table public.tiktok_tokens from anon, authenticated;

alter table public.social_snapshots
  drop constraint if exists social_snapshots_platform_check;

alter table public.social_snapshots
  add constraint social_snapshots_platform_check
  check (platform in ('youtube', 'meta', 'tiktok'));
