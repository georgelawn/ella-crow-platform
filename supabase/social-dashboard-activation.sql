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
as $function$
  with filtered as (
    select events.*
    from public.bio_link_clicks as events
    where events.created_at >= case
      when p_days > 0 then now() - make_interval(days => least(p_days, 366))
      else date_trunc('month', now())
    end
  ),
  platform_list as (
    select unnest(array['instagram', 'tiktok', 'facebook', 'youtube']) as name
  ),
  view_counts as (
    select events.platform as name, count(*) as total
    from filtered as events
    where events.event_type = 'view'
    group by events.platform
  ),
  click_counts as (
    select
      events.platform as name,
      events.button_name as button,
      count(*) as total
    from filtered as events
    where events.event_type = 'click'
    group by events.platform, events.button_name
  )
  select
    platform_list.name as platform,
    click_counts.button as button_name,
    coalesce(view_counts.total, 0)::bigint as views,
    coalesce(click_counts.total, 0)::bigint as clicks
  from platform_list
  left join view_counts using (name)
  left join click_counts using (name)
  order by platform_list.name, coalesce(click_counts.total, 0) desc,
    click_counts.button;
$function$;

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
as $function$
  select
    snapshots.platform,
    snapshots.snapshot_date,
    snapshots.checked_at,
    snapshots.payload
  from public.social_snapshots as snapshots
  where snapshots.snapshot_date >=
    current_date - least(greatest(p_days, 1), 400)
  order by snapshots.snapshot_date, snapshots.checked_at;
$function$;

revoke all on function public.get_bio_link_summary(integer) from public;
revoke all on function public.get_social_snapshots(integer) from public;
grant execute on function public.get_bio_link_summary(integer)
  to anon, authenticated;
grant execute on function public.get_social_snapshots(integer)
  to anon, authenticated;

create or replace function public.delete_expired_bio_link_clicks()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.bio_link_clicks
  where created_at < now() - interval '1 year';

  delete from public.social_snapshots
  where snapshot_date < current_date - 400;
end;
$function$;
