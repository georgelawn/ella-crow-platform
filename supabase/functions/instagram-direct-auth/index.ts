import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token";
const API_ROOT = "https://graph.instagram.com/v25.0";
const DASHBOARD_URL =
  "https://georgelawn.github.io/ella-crow-platform/social.html#instagram-direct";
const SCOPES = "instagram_business_basic,instagram_business_manage_insights";
const DEFAULT_ACCOUNT_KEY = "secondary";

function accountKey(value: string | null) {
  const key = String(value || DEFAULT_ACCOUNT_KEY).trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(key) ? key : DEFAULT_ACCOUNT_KEY;
}

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function html(message: string, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Instagram connection</title>
    <style>body{background:#ead3c7;color:#21150e;font:18px Arial,sans-serif;display:grid;min-height:100vh;margin:0;place-items:center}.card{background:#fff7dc;border:2px solid #21150e;border-radius:20px;box-shadow:8px 8px 0 #21150e;max-width:580px;padding:32px;text-align:center}</style>
    <main class="card"><h1>Instagram connection</h1><p>${escapeHtml(message)}</p></main>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
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

async function jsonResponse(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message || payload.error_description || payload.message || fallback,
    );
  }
  return payload;
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ""),
    }),
  });
  return jsonResponse(response, "Instagram token exchange failed.");
}

async function exchangeLongLivedToken(shortToken: string, clientSecret: string) {
  const url = new URL(LONG_LIVED_TOKEN_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortToken);
  return jsonResponse(
    await fetch(url),
    "Instagram long-lived token exchange failed.",
  );
}

async function instagramProfile(accessToken: string) {
  const url = new URL(`${API_ROOT}/me`);
  url.searchParams.set(
    "fields",
    "user_id,username,name,profile_picture_url,followers_count,media_count",
  );
  url.searchParams.set("access_token", accessToken);
  return jsonResponse(await fetch(url), "Instagram profile lookup failed.");
}

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") return html("Method not allowed.", 405);

    const clientId = Deno.env.get("INSTAGRAM_DIRECT_CLIENT_ID");
    const clientSecret = Deno.env.get("INSTAGRAM_DIRECT_CLIENT_SECRET");
    const redirectUri = Deno.env.get("INSTAGRAM_DIRECT_REDIRECT_URI");
    const setupKey = Deno.env.get("INSTAGRAM_DIRECT_SETUP_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const adminKey = serviceRoleKey();
    if (
      !clientId || !clientSecret || !redirectUri || !setupKey ||
      !supabaseUrl || !adminKey
    ) {
      return html("The direct Instagram connection is not fully configured in Supabase.", 500);
    }

    const supabase = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false },
    });
    const url = new URL(request.url);
    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (oauthError) {
      return html(
        `Instagram did not authorise the connection: ${
          url.searchParams.get("error_description") || oauthError
        }.`,
        400,
      );
    }

    if (!code) {
      if (url.searchParams.get("setup") !== setupKey) {
        return html("This private setup link is not valid.", 403);
      }
      const selectedAccount = accountKey(url.searchParams.get("account"));
      const oauthState = crypto.randomUUID().replaceAll("-", "");
      await supabase.from("instagram_direct_oauth_states").delete()
        .lt("expires_at", new Date().toISOString());
      const { error } = await supabase.from("instagram_direct_oauth_states").insert({
        state: oauthState,
        account_key: selectedAccount,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) return html("Could not prepare the Instagram connection.", 500);

      const authorize = new URL(AUTHORIZE_URL);
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("scope", SCOPES);
      authorize.searchParams.set("state", oauthState);
      authorize.searchParams.set("enable_fb_login", "0");
      authorize.searchParams.set("force_authentication", "1");
      return Response.redirect(authorize.toString(), 302);
    }

    if (!state) return html("The callback did not include a security state.", 400);
    const { data: storedState } = await supabase
      .from("instagram_direct_oauth_states")
      .select("account_key, expires_at")
      .eq("state", state)
      .maybeSingle();
    await supabase.from("instagram_direct_oauth_states").delete().eq("state", state);
    if (!storedState || new Date(storedState.expires_at).getTime() < Date.now()) {
      return html("The Instagram connection link expired. Start it again.", 400);
    }

    try {
      const shortToken = await exchangeCode(code, clientId, clientSecret, redirectUri);
      const longToken = await exchangeLongLivedToken(
        String(shortToken.access_token || ""),
        clientSecret,
      );
      const profile = await instagramProfile(String(longToken.access_token || ""));
      const instagramUserId = String(
        profile.user_id || profile.id || shortToken.user_id || "",
      );
      if (!instagramUserId) throw new Error("Instagram did not return an account ID.");
      const expiresIn = Number(longToken.expires_in || 60 * 24 * 60 * 60);
      const { error } = await supabase.from("instagram_direct_tokens").upsert({
        account_key: accountKey(String(storedState.account_key || "")),
        instagram_user_id: instagramUserId,
        username: String(profile.username || ""),
        access_token: String(longToken.access_token || ""),
        scope: SCOPES,
        access_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_key" });
      if (error) throw error;
      return Response.redirect(DASHBOARD_URL, 302);
    } catch (error) {
      console.error("Instagram direct OAuth failed", error);
      return html(
        error instanceof Error ? error.message : "Instagram could not be connected.",
        502,
      );
    }
  },
};
