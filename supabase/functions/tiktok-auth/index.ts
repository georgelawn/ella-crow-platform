import { createClient } from "npm:@supabase/supabase-js@2";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const DASHBOARD_URL =
  "https://georgelawn.github.io/ella-crow-platform/social.html#tiktok";
const SCOPES = "user.info.basic,user.info.stats,video.list";

function html(message: string, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>TikTok connection</title>
    <style>body{background:#ead58d;color:#21150e;font:18px Arial,sans-serif;display:grid;min-height:100vh;margin:0;place-items:center}.card{background:#fff7dc;border:2px solid #21150e;border-radius:20px;box-shadow:8px 8px 0 #21150e;max-width:580px;padding:32px;text-align:center}</style>
    <main class="card"><h1>TikTok connection</h1><p>${message}</p></main>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function exchangeToken(body: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error_description || payload.message || "TikTok token exchange failed.",
    );
  }
  return payload;
}

export default {
  async fetch(request: Request) {
    if (request.method !== "GET") return html("Method not allowed.", 405);

    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const redirectUri = Deno.env.get("TIKTOK_REDIRECT_URI");
    const setupKey = Deno.env.get("TIKTOK_SETUP_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (
      !clientKey || !clientSecret || !redirectUri || !setupKey ||
      !supabaseUrl || !serviceRoleKey
    ) {
      return html("The TikTok connection is not fully configured in Supabase.", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const url = new URL(request.url);
    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (oauthError) {
      return html(
        `TikTok did not authorise the connection: ${
          url.searchParams.get("error_description") || oauthError
        }.`,
        400,
      );
    }

    if (!code) {
      if (url.searchParams.get("setup") !== setupKey) {
        return html("This private setup link is not valid.", 403);
      }
      const oauthState = crypto.randomUUID().replaceAll("-", "");
      const { error } = await supabase.from("tiktok_oauth_states").insert({
        state: oauthState,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) return html("Could not prepare the TikTok connection.", 500);

      const authorize = new URL(AUTHORIZE_URL);
      authorize.searchParams.set("client_key", clientKey);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("scope", SCOPES);
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("state", oauthState);
      return Response.redirect(authorize.toString(), 302);
    }

    if (!state) return html("The callback did not include a security state.", 400);
    const { data: storedState } = await supabase
      .from("tiktok_oauth_states")
      .select("expires_at")
      .eq("state", state)
      .maybeSingle();
    await supabase.from("tiktok_oauth_states").delete().eq("state", state);
    if (!storedState || new Date(storedState.expires_at).getTime() < Date.now()) {
      return html("The TikTok connection link expired. Start it again.", 400);
    }

    try {
      const token = await exchangeToken(new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }));
      const now = Date.now();
      const { error } = await supabase.from("tiktok_tokens").upsert({
        id: 1,
        open_id: token.open_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        scope: token.scope || "",
        access_expires_at: new Date(now + Number(token.expires_in) * 1000).toISOString(),
        refresh_expires_at: new Date(
          now + Number(token.refresh_expires_in) * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return Response.redirect(DASHBOARD_URL, 302);
    } catch (error) {
      console.error("TikTok OAuth failed", error);
      return html(
        error instanceof Error ? error.message : "TikTok could not be connected.",
        502,
      );
    }
  },
};
