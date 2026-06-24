create table if not exists public.shop_products (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  display_price text not null,
  currency text not null default 'gbp' check (currency in ('gbp', 'usd', 'eur')),
  image_url text not null,
  stripe_payment_link_url text not null,
  active boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_products_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint shop_products_payment_link_check check (
    stripe_payment_link_url = ''
    or stripe_payment_link_url like 'https://buy.stripe.com/%'
  )
);

create index if not exists shop_products_active_sort_idx
  on public.shop_products (active, sort_order, name);

alter table public.shop_products enable row level security;

revoke all on table public.shop_products from anon, authenticated;
grant select on table public.shop_products to anon, authenticated;

drop policy if exists "Public can view active shop products"
  on public.shop_products;

create policy "Public can view active shop products"
  on public.shop_products
  for select
  to anon, authenticated
  using (active = true);

create table if not exists public.shop_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('view', 'checkout_click')),
  product_slug text,
  source text not null default 'squarespace_shop',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  constraint shop_events_product_slug_check check (
    product_slug is null
    or product_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create index if not exists shop_events_created_at_idx
  on public.shop_events (created_at desc);

create index if not exists shop_events_type_product_idx
  on public.shop_events (event_type, product_slug, created_at desc);

alter table public.shop_events enable row level security;

revoke all on table public.shop_events from anon, authenticated;
grant insert on table public.shop_events to anon, authenticated;
grant usage, select on sequence public.shop_events_id_seq to anon, authenticated;

drop policy if exists "Public can record shop events"
  on public.shop_events;

create policy "Public can record shop events"
  on public.shop_events
  for insert
  to anon, authenticated
  with check (
    source = 'squarespace_shop'
    and (
      (event_type = 'view' and product_slug is null)
      or
      (event_type = 'checkout_click' and product_slug is not null)
    )
  );

create table if not exists public.shop_orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
  ),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  amount_total integer,
  currency text,
  shipping_name text,
  shipping_address jsonb,
  payload jsonb
);

create index if not exists shop_orders_created_at_idx
  on public.shop_orders (created_at desc);

create index if not exists shop_orders_status_idx
  on public.shop_orders (status, created_at desc);

alter table public.shop_orders enable row level security;
revoke all on table public.shop_orders from anon, authenticated;

create table if not exists public.shop_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.shop_orders (id) on delete cascade,
  product_slug text,
  product_name_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount integer,
  currency text
);

create index if not exists shop_order_items_order_id_idx
  on public.shop_order_items (order_id);

alter table public.shop_order_items enable row level security;
revoke all on table public.shop_order_items from anon, authenticated;

create or replace function public.set_shop_product_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_products_set_updated_at on public.shop_products;

create trigger shop_products_set_updated_at
  before update on public.shop_products
  for each row
  execute function public.set_shop_product_updated_at();

revoke all on function public.set_shop_product_updated_at() from public;
