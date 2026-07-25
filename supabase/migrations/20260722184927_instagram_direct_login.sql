create table public.instagram_direct_oauth_states (
  state text primary key,
  account_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint instagram_direct_oauth_states_account_key_check
    check (account_key ~ '^[a-z0-9_-]{1,32}$')
);

create table public.instagram_direct_tokens (
  account_key text primary key,
  instagram_user_id text not null unique,
  username text not null default '',
  access_token text not null,
  scope text not null default '',
  access_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint instagram_direct_tokens_account_key_check
    check (account_key ~ '^[a-z0-9_-]{1,32}$')
);

create index instagram_direct_oauth_states_expires_at_idx
  on public.instagram_direct_oauth_states (expires_at);

alter table public.instagram_direct_oauth_states enable row level security;
alter table public.instagram_direct_tokens enable row level security;

revoke all on table public.instagram_direct_oauth_states
  from public, anon, authenticated;
revoke all on table public.instagram_direct_tokens
  from public, anon, authenticated;

grant select, insert, update, delete on table public.instagram_direct_oauth_states
  to service_role;
grant select, insert, update, delete on table public.instagram_direct_tokens
  to service_role;

alter table public.social_snapshots
  drop constraint if exists social_snapshots_platform_check;

alter table public.social_snapshots
  add constraint social_snapshots_platform_check
  check (platform = any (array[
    'youtube'::text,
    'meta'::text,
    'instagram_direct'::text,
    'tiktok'::text
  ]));
