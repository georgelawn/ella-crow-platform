alter table public.tiktok_oauth_states
  add column if not exists account_key text not null default 'ella';

alter table public.tiktok_tokens
  add column if not exists account_key text not null default 'ella';

alter table public.tiktok_tokens
  drop constraint if exists tiktok_tokens_id_check;

alter table public.tiktok_tokens
  drop constraint if exists tiktok_tokens_pkey;

alter table public.tiktok_tokens
  add constraint tiktok_tokens_pkey primary key (account_key);

alter table public.tiktok_tokens
  add constraint tiktok_tokens_account_key_check
  check (account_key ~ '^[a-z0-9_-]{1,32}$');

alter table public.tiktok_oauth_states
  add constraint tiktok_oauth_states_account_key_check
  check (account_key ~ '^[a-z0-9_-]{1,32}$');
