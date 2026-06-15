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
  platform_list(name) as (
    values ('instagram'), ('tiktok'), ('facebook'), ('youtube')
  ),
  button_list(name) as (
    values
      ('WhatsApp Community'),
      ('Next Gig Tickets'),
      ('SoundCloud'),
      ('Spotify'),
      ('Apple Music')
  ),
  view_counts as (
    select events.platform as name, count(*) as total
    from filtered as events
    where events.event_type = 'view'
    group by events.platform
  ),
  click_counts as (
    select
      events.platform as platform_name,
      events.button_name as button,
      count(*) as total
    from filtered as events
    where events.event_type = 'click'
    group by events.platform, events.button_name
  )
  select
    platforms.name as platform,
    buttons.name as button_name,
    coalesce(view_counts.total, 0)::bigint as views,
    coalesce(click_counts.total, 0)::bigint as clicks
  from platform_list as platforms
  cross join button_list as buttons
  left join view_counts
    on view_counts.name = platforms.name
  left join click_counts
    on click_counts.platform_name = platforms.name
    and click_counts.button = buttons.name
  order by platforms.name, buttons.name;
$function$;

revoke all on function public.get_bio_link_summary(integer) from public;
grant execute on function public.get_bio_link_summary(integer)
  to anon, authenticated;
