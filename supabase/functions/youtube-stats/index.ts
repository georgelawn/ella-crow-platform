const CHANNEL_ID = "UCbZAHmVbINt96YrYrotvB1Q";
const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const VERIFIED_SHORT_IDS = new Set([
  "KuCyjNmbXlI",
  "FQAQAZrLXBk",
  "bYlb7Rca6eM",
  "Hl6CmRAuw1E",
  "wlVvBqYXLM8",
]);
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function thumbnailUrl(thumbnails: Record<string, { url?: string }> | undefined) {
  return thumbnails?.medium?.url || thumbnails?.default?.url || "";
}

function durationSeconds(duration: string | undefined) {
  const match = String(duration || "").match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!match) return 0;
  return numberValue(match[1]) * 86400 +
    numberValue(match[2]) * 3600 +
    numberValue(match[3]) * 60 +
    numberValue(match[4]);
}

function isLikelyShort(id: string, title: string, duration: number, tags: string[]) {
  if (VERIFIED_SHORT_IDS.has(id)) return true;
  if (/\b(acoustic session|debut|official video|music video)\b|live\s*@/i.test(title)) {
    return false;
  }
  if (tags.some((tag) => String(tag).toLowerCase().replace("#", "") === "shorts")) {
    return true;
  }
  if (!duration || duration > 180) return false;

  return true;
}

async function youtubeRequest(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_ROOT}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "YouTube API request failed.");
  }
  return payload;
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

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) {
    return json({ ok: false, error: "YouTube is not configured." }, 500, origin);
  }

  try {
    const channelPayload = await youtubeRequest("channels", {
      part: "snippet,statistics,contentDetails",
      id: CHANNEL_ID,
    }, apiKey);
    const channel = channelPayload.items?.[0];
    if (!channel) throw new Error("Ella Crow's YouTube channel could not be found.");

    const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;
    let videos = [];

    if (uploadsPlaylist) {
      const playlistPayload = await youtubeRequest("playlistItems", {
        part: "contentDetails",
        playlistId: uploadsPlaylist,
        maxResults: "50",
      }, apiKey);
      const videoIds = (playlistPayload.items || [])
        .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
        .filter(Boolean);

      if (videoIds.length) {
        const videoPayload = await youtubeRequest("videos", {
          part: "snippet,statistics,contentDetails",
          id: videoIds.join(","),
        }, apiKey);
        const order = new Map(videoIds.map((id: string, index: number) => [id, index]));
        videos = (videoPayload.items || []).sort(
          (a: { id: string }, b: { id: string }) =>
            (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
        );
      }
    }

    const stats = channel.statistics || {};
    return json({
      ok: true,
      snapshot: {
        checkedAt: new Date().toISOString(),
        channel: {
          id: channel.id,
          title: channel.snippet?.title || "Ella Crow",
          description: channel.snippet?.description || "",
          thumbnail: thumbnailUrl(channel.snippet?.thumbnails),
          subscribers: numberValue(stats.subscriberCount),
          views: numberValue(stats.viewCount),
          videos: numberValue(stats.videoCount),
          subscribersHidden: Boolean(stats.hiddenSubscriberCount),
        },
        videos: videos.map((video: {
          id: string;
          snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            thumbnails?: Record<string, { url?: string }>;
            tags?: string[];
          };
          statistics?: {
            viewCount?: string;
            likeCount?: string;
            commentCount?: string;
          };
          contentDetails?: {
            duration?: string;
          };
        }) => {
          const title = video.snippet?.title || "Untitled video";
          const duration = durationSeconds(video.contentDetails?.duration);
          const tags = (video.snippet as { tags?: string[] } | undefined)?.tags || [];
          return {
            id: video.id,
            title,
            description: video.snippet?.description || "",
            tags,
            publishedAt: video.snippet?.publishedAt || "",
            thumbnail: thumbnailUrl(video.snippet?.thumbnails),
            views: numberValue(video.statistics?.viewCount),
            likes: numberValue(video.statistics?.likeCount),
            comments: numberValue(video.statistics?.commentCount),
            durationSeconds: duration,
            isShort: isLikelyShort(video.id, title, duration, tags),
          };
        }),
      },
    }, 200, origin);
  } catch (error) {
    console.error("YouTube stats failed", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "YouTube data is unavailable.",
    }, 502, origin);
  }
  },
};
