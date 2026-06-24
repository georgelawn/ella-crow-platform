# Squarespace Stripe Shop

`stripe-shop.html` is a self-contained Squarespace Code Block snippet. Paste the
whole file into a Squarespace HTML Code Block.

## Setup

1. In Stripe, create a product and a Payment Link.
2. Apply `supabase/migrations/20260622002634_shop_foundation.sql` to Supabase.
3. Insert one row per product into `public.shop_products`.
4. Set `active = true` only when the product has a real Stripe Payment Link.
5. Paste `stripe-shop.html` into the Squarespace shop page.

Example product row:

```sql
insert into public.shop_products (
  slug,
  name,
  description,
  display_price,
  currency,
  image_url,
  stripe_payment_link_url,
  active,
  sort_order
) values (
  'ella-crow-tshirt',
  'Ella Crow T-shirt',
  'Official Ella Crow T-shirt.',
  '&pound;25',
  'gbp',
  'https://example.com/tshirt.jpg',
  'https://buy.stripe.com/REPLACE_ME',
  true,
  10
);
```

Stripe handles checkout and can show Apple Pay when available. The snippet only
stores product views and checkout clicks in Supabase; paid orders should be
written later by a Stripe webhook/Edge Function.
