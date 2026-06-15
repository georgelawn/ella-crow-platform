create extension if not exists pg_cron with schema extensions;

create table if not exists public.bio_link_clicks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  platform text not null check (
    platform in ('instagram', 'tiktok', 'facebook', 'youtube')
  ),
  event_type text not null check (
    event_type in ('view', 'click')
  ),
  button_name text,
  constraint bio_link_clicks_button_name_check check (
    (event_type = 'view' and button_name is null)
    or
    (event_type = 'click' and nullif(trim(button_name), '') is not null)
  )
);

create index if not exists bio_link_clicks_created_at_idx
  on public.bio_link_clicks (created_at desc);

create index if not exists bio_link_clicks_platform_event_idx
  on public.bio_link_clicks (platform, event_type, created_at desc);

alter table public.bio_link_clicks enable row level security;

revoke all on table public.bio_link_clicks from anon, authenticated;
grant insert on table public.bio_link_clicks to anon, authenticated;
grant usage, select on sequence public.bio_link_clicks_id_seq to anon, authenticated;

drop policy if exists "Public can record bio link events"
  on public.bio_link_clicks;

create policy "Public can record bio link events"
  on public.bio_link_clicks
  for insert
  to anon, authenticated
  with check (true);

create or replace function public.delete_expired_bio_link_clicks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bio_link_clicks
  where created_at < now() - interval '1 year';
$$;

revoke all on function public.delete_expired_bio_link_clicks() from public;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'delete-expired-bio-link-clicks'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'delete-expired-bio-link-clicks',
    '17 3 * * *',
    'select public.delete_expired_bio_link_clicks();'
  );
end
$$;

create or replace function public.get_bio_link_summary(p_days integer default 0)
returns table (
  platform text,
  button_name text,
  views bigint,
  clicks bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with filtered as (
    select *
    from public.bio_link_clicks
    where created_at >= case
      when p_days > 0 then now() - make_interval(days => least(p_days, 366))
      else date_trunc('month', now())
    end
  ),
  platforms as (
    select unnest(array['instagram', 'tiktok', 'facebook', 'youtube']) as platform
  ),
  view_counts as (
    select platform, count(*) as views
    from filtered
    where event_type = 'view'
    group by platform
  ),
  click_counts as (
    select platform, button_name, count(*) as clicks
    from filtered
    where event_type = 'click'
    group by platform, button_name
  )
  select
    platforms.platform as platform,
    click_counts.button_name as button_name,
    coalesce(view_counts.views, 0)::bigint as views,
    coalesce(click_counts.clicks, 0)::bigint as clicks
  from platforms
  left join view_counts using (platform)
  left join click_counts using (platform)
  order by platforms.platform, coalesce(click_counts.clicks, 0) desc,
    click_counts.button_name;
$$;

revoke all on function public.get_bio_link_summary(integer) from public;
grant execute on function public.get_bio_link_summary(integer) to anon, authenticated;

create table if not exists public.social_snapshots (
  id bigint generated always as identity primary key,
  platform text not null check (platform in ('youtube', 'meta')),
  snapshot_date date not null default current_date,
  checked_at timestamptz not null default now(),
  payload jsonb not null,
  unique (platform, snapshot_date)
);

create index if not exists social_snapshots_checked_at_idx
  on public.social_snapshots (platform, checked_at desc);

alter table public.social_snapshots enable row level security;
revoke all on table public.social_snapshots from anon, authenticated;
drop function if exists public.record_social_snapshot(text, jsonb);

create or replace function public.get_social_snapshots(p_days integer default 400)
returns table (
  platform text,
  snapshot_date date,
  checked_at timestamptz,
  payload jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    social_snapshots.platform,
    social_snapshots.snapshot_date,
    social_snapshots.checked_at,
    social_snapshots.payload
  from public.social_snapshots
  where snapshot_date >= current_date - least(greatest(p_days, 1), 400)
  order by snapshot_date, checked_at;
$$;

revoke all on function public.get_social_snapshots(integer) from public;
grant execute on function public.get_social_snapshots(integer) to anon, authenticated;

create or replace function public.delete_expired_bio_link_clicks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bio_link_clicks
  where created_at < now() - interval '1 year';

  delete from public.social_snapshots
  where snapshot_date < current_date - 400;
end;
$$;
