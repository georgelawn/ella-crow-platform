import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const API_ROOT = "https://graph.instagram.com/v25.0";
const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
const DEFAULT_ACCOUNT_KEY = "secondary";
const MAX_MEDIA_PAGES = 2;
const ALLOWED_ORIGINS = new Set([
  "https://georgelawn.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://georgelawn.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=900, s-maxage=21600",
    "Vary": "Origin",
  };
}

function json(payload: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function accountKey(value: string | null) {
  const key = String(value || DEFAULT_ACCOUNT_KEY).trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(key) ? key : DEFAULT_ACCOUNT_KEY;
}

function serviceRoleKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return String(keys.default || "");
  } catch {
    return "";
  }
}

async function graphRequest(
  path: string,
  params: Record<string, string>,
  accessToken: string,
) {
  const url = new URL(`${API_ROOT}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || "Instagram API request failed.");
  }
  return payload;
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function insightValue(payload: {
  data?: Array<{
    values?: Array<{ value?: unknown }>;
    total_value?: { value?: unknown };
  }>;
}) {
  return (payload.data || []).reduce((total, metric) => {
    if (metric.total_value?.value != null) {
      return total + numberValue(metric.total_value.value);
    }
    return total + (metric.values || []).reduce(
      (metricTotal, entry) => metricTotal + numberValue(entry.value),
      0,
    );
  }, 0);
}

async function accountInsight(id: string, metric: string, accessToken: string) {
  try {
    return insightValue(await graphRequest(`${id}/insights`, {
      metric,
      period: "day",
      since: monthStartIso(),
      until: new Date().toISOString(),
    }, accessToken));
  } catch (error) {
    console.warn(`Instagram direct ${metric} insight unavailable`, error);
    return 0;
  }
}

async function mediaInsights(id: string, accessToken: string) {
  try {
    const payload = await graphRequest(`${id}/insights`, {
      metric: "views,reach,saved,shares,total_interactions",
    }, accessToken);
    return Object.fromEntries((payload.data || []).map((metric: {
      name?: string;
      values?: Array<{ value?: unknown }>;
      total_value?: { value?: unknown };
    }) => [
      metric.name,
      numberValue(metric.total_value?.value ?? metric.values?.[0]?.value),
    ]));
  } catch (error) {
    console.warn(`Instagram direct media insight unavailable for ${id}`, error);
    return {};
  }
}

async function listMedia(id: string, accessToken: string) {
  const fields = [
    "id", "caption", "media_type", "media_product_type", "media_url",
    "thumbnail_url", "permalink", "timestamp", "like_count", "comments_count",
  ].join(",");
  const media: Array<Record<string, unknown>> = [];
  let nextUrl: string | null = `${API_ROOT}/${id}/media?fields=${
    encodeURIComponent(fields)
  }&limit=50&access_token=${encodeURIComponent(accessToken)}`;

  for (let page = 0; page < MAX_MEDIA_PAGES && nextUrl; page += 1) {
    const response = await fetch(nextUrl);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || "Instagram media request failed.");
    }
    media.push(...(payload.data || []));
    nextUrl = payload.paging?.next || null;
  }
  return media;
}

async function currentAccessToken(
  token: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
) {
  const expiresAt = new Date(String(token.access_expires_at)).getTime();
  if (expiresAt > Date.now() + 14 * 24 * 60 * 60 * 1000) {
    return String(token.access_token);
  }
  if (expiresAt <= Date.now()) {
    throw new Error("Instagram needs to be reconnected because authorisation expired.");
  }

  const url = new URL(REFRESH_URL);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", String(token.access_token));
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error?.message || "Instagram authorisation could not be refreshed.");
  }
  const expiresIn = Number(payload.expires_in || 60 * 24 * 60 * 60);
  const { error } = await supabase.from("instagram_direct_tokens").update({
    access_token: payload.access_token,
    access_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("account_key", accountKey(String(token.account_key || "")));
  if (error) throw error;
  return String(payload.access_token);
}

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return json({ ok: false, error: "Method not allowed." }, 405, origin);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const adminKey = serviceRoleKey();
    if (!supabaseUrl || !adminKey) {
      return json({ ok: false, error: "Instagram Direct is not configured." }, 500, origin);
    }
    const supabase = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false },
    });
    const selectedAccount = accountKey(new URL(request.url).searchParams.get("account"));

    try {
      const { data: token, error: tokenError } = await supabase
        .from("instagram_direct_tokens")
        .select("*")
        .eq("account_key", selectedAccount)
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!token) {
        return json({
          ok: false,
          error: "The second Instagram account has not been authorised yet.",
          code: "not_connected",
        }, 409, origin);
      }

      const accessToken = await currentAccessToken(token, supabase);
      const account = await graphRequest("me", {
        fields: "user_id,username,name,profile_picture_url,followers_count,media_count",
      }, accessToken);
      const id = String(account.user_id || account.id || token.instagram_user_id);
      const mediaPayload = await listMedia(id, accessToken);
      const insights = await Promise.all(
        mediaPayload.map((item) => mediaInsights(String(item.id || ""), accessToken)),
      );
      const [reach, profileViews, views] = await Promise.all([
        accountInsight(id, "reach", accessToken),
        accountInsight(id, "profile_views", accessToken),
        accountInsight(id, "views", accessToken),
      ]);
      const accountSummary = {
        id,
        key: selectedAccount,
        username: String(account.username || token.username || ""),
        name: String(account.name || account.username || token.username || "Instagram"),
        thumbnail: String(account.profile_picture_url || ""),
        followers: numberValue(account.followers_count),
        mediaCount: numberValue(account.media_count),
      };
      const media = mediaPayload.map((item, index) => ({
        id: `direct:${selectedAccount}:${String(item.id || "")}`,
        sourceId: String(item.id || ""),
        accountKey: selectedAccount,
        accountName: accountSummary.name,
        accountUsername: accountSummary.username,
        caption: String(item.caption || "Instagram post"),
        mediaType: String(item.media_type || ""),
        productType: String(item.media_product_type || ""),
        thumbnail: String(item.thumbnail_url || item.media_url || ""),
        permalink: String(item.permalink || ""),
        publishedAt: String(item.timestamp || ""),
        likes: numberValue(item.like_count),
        comments: numberValue(item.comments_count),
        views: numberValue(insights[index]?.views),
        reach: numberValue(insights[index]?.reach),
        saved: numberValue(insights[index]?.saved),
        shares: numberValue(insights[index]?.shares),
        interactions: numberValue(insights[index]?.total_interactions),
      }));
      const snapshot = {
        checkedAt: new Date().toISOString(),
        account: accountSummary,
        month: { reach, profileViews, views, posts: media.length },
        media,
      };

      await supabase.from("instagram_direct_tokens").update({
        username: accountSummary.username,
        updated_at: new Date().toISOString(),
      }).eq("account_key", selectedAccount);
      const { error: snapshotError } = await supabase.from("social_snapshots").upsert({
        platform: "instagram_direct",
        snapshot_date: new Date().toISOString().slice(0, 10),
        checked_at: snapshot.checkedAt,
        payload: snapshot,
      }, { onConflict: "platform,snapshot_date" });
      if (snapshotError) throw snapshotError;

      return json({ ok: true, snapshot }, 200, origin);
    } catch (error) {
      console.error("Instagram direct stats failed", error);
      return json({
        ok: false,
        error: error instanceof Error ? error.message : "Instagram Direct is unavailable.",
      }, 502, origin);
    }
  },
};
