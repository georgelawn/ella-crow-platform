import { createClient } from "npm:@supabase/supabase-js@2";

const API_ROOT = "https://open.tiktokapis.com";
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

async function apiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || (payload.error?.code && payload.error.code !== "ok")) {
    throw new Error(payload.error?.message || "TikTok API request failed.");
  }
  return payload;
}

async function currentAccessToken(
  token: Record<string, unknown>,
  clientKey: string,
  clientSecret: string,
  supabase: ReturnType<typeof createClient>,
) {
  if (new Date(String(token.access_expires_at)).getTime() > Date.now() + 300000) {
    return String(token.access_token);
  }
  if (new Date(String(token.refresh_expires_at)).getTime() <= Date.now()) {
    throw new Error("TikTok needs to be reconnected because authorisation expired.");
  }

  const response = await fetch(`${API_ROOT}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: String(token.refresh_token),
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || "TikTok could not be refreshed.");
  }

  const now = Date.now();
  const { error } = await supabase.from("tiktok_tokens").update({
    open_id: payload.open_id || token.open_id,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || token.refresh_token,
    scope: payload.scope || token.scope || "",
    access_expires_at: new Date(now + Number(payload.expires_in) * 1000).toISOString(),
    refresh_expires_at: new Date(
      now + Number(payload.refresh_expires_in) * 1000,
    ).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
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

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!clientKey || !clientSecret || !supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "TikTok is not configured." }, 500, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    try {
      const { data: token, error: tokenError } = await supabase
        .from("tiktok_tokens")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!token) {
        return json({
          ok: false,
          error: "TikTok is ready but Ella's account has not been authorised yet.",
        }, 409, origin);
      }

      const accessToken = await currentAccessToken(
        token,
        clientKey,
        clientSecret,
        supabase,
      );
      const userFields = [
        "open_id", "display_name", "avatar_url", "follower_count",
        "following_count", "likes_count", "video_count",
      ].join(",");
      const videoFields = [
        "id", "create_time", "cover_image_url", "share_url",
        "video_description", "duration", "title", "like_count",
        "comment_count", "share_count", "view_count",
      ].join(",");
      const [userPayload, videoPayload] = await Promise.all([
        apiRequest(`/v2/user/info/?fields=${userFields}`, accessToken),
        apiRequest(`/v2/video/list/?fields=${videoFields}`, accessToken, {
          method: "POST",
          body: JSON.stringify({ max_count: 20 }),
        }),
      ]);

      const user = userPayload.data?.user || {};
      const videos = (videoPayload.data?.videos || []).map(
        (video: Record<string, unknown>) => ({
          id: String(video.id || ""),
          title: String(video.title || video.video_description || "Untitled TikTok"),
          caption: String(video.video_description || video.title || ""),
          publishedAt: video.create_time
            ? new Date(numberValue(video.create_time) * 1000).toISOString()
            : "",
          thumbnail: String(video.cover_image_url || ""),
          shareUrl: String(video.share_url || ""),
          durationSeconds: numberValue(video.duration),
          views: numberValue(video.view_count),
          likes: numberValue(video.like_count),
          comments: numberValue(video.comment_count),
          shares: numberValue(video.share_count),
          saved: 0,
        }),
      );
      const snapshot = {
        checkedAt: new Date().toISOString(),
        account: {
          id: String(user.open_id || token.open_id),
          name: String(user.display_name || "Ella Crow"),
          avatar: String(user.avatar_url || ""),
          followers: numberValue(user.follower_count),
          following: numberValue(user.following_count),
          likes: numberValue(user.likes_count),
          videos: numberValue(user.video_count),
        },
        videos,
      };

      await supabase.from("social_snapshots").upsert({
        platform: "tiktok",
        snapshot_date: new Date().toISOString().slice(0, 10),
        checked_at: snapshot.checkedAt,
        payload: snapshot,
      }, { onConflict: "platform,snapshot_date" });

      return json({ ok: true, snapshot }, 200, origin);
    } catch (error) {
      console.error("TikTok stats failed", error);
      return json({
        ok: false,
        error: error instanceof Error ? error.message : "TikTok data is unavailable.",
      }, 502, origin);
    }
  },
};
