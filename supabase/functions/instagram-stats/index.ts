const GRAPH_API_ROOT = "https://graph.facebook.com/v25.0";
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

async function graphRequest(
  path: string,
  params: Record<string, string>,
  accessToken: string,
) {
  const url = new URL(`${GRAPH_API_ROOT}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Instagram API request failed.");
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

async function accountInsight(
  instagramId: string,
  metric: string,
  accessToken: string,
) {
  try {
    const payload = await graphRequest(`${instagramId}/insights`, {
      metric,
      period: "day",
      since: monthStartIso(),
      until: new Date().toISOString(),
    }, accessToken);
    return insightValue(payload);
  } catch (error) {
    console.warn(`Instagram ${metric} insight unavailable`, error);
    return 0;
  }
}

async function mediaInsights(
  mediaId: string,
  accessToken: string,
) {
  try {
    const payload = await graphRequest(`${mediaId}/insights`, {
      metric: "views,reach,saved,shares,total_interactions",
    }, accessToken);
    return Object.fromEntries(
      (payload.data || []).map((metric: {
        name?: string;
        values?: Array<{ value?: unknown }>;
      }) => [
        metric.name,
        numberValue(metric.values?.[0]?.value),
      ]),
    );
  } catch (error) {
    console.warn(`Instagram media insights unavailable for ${mediaId}`, error);
    return {};
  }
}

function startOfMonthSeconds() {
  return Math.floor(new Date(monthStartIso()).getTime() / 1000);
}

async function pageInsight(
  pageId: string,
  metric: string,
  accessToken: string,
) {
  try {
    const payload = await graphRequest(`${pageId}/insights`, {
      metric,
      period: "day",
      since: String(startOfMonthSeconds()),
      until: String(Math.floor(Date.now() / 1000)),
    }, accessToken);
    return { available: true, value: insightValue(payload) };
  } catch (error) {
    console.warn(`Facebook ${metric} insight unavailable`, error);
    return { available: false, value: 0 };
  }
}

async function postInsight(
  postId: string,
  metrics: string[],
  accessToken: string,
) {
  for (const metric of metrics) {
    try {
      const payload = await graphRequest(`${postId}/insights`, {
        metric,
        period: "lifetime",
      }, accessToken);
      return {
        available: true,
        value: insightValue(payload),
      };
    } catch (error) {
      console.warn(`Facebook ${metric} unavailable for ${postId}`, error);
    }
  }
  return { available: false, value: 0 };
}

async function facebookVideoViews(
  videoId: string | undefined,
  accessToken: string,
) {
  if (!videoId) return 0;

  try {
    const video = await graphRequest(videoId, { fields: "views" }, accessToken);
    const views = numberValue(video.views);
    if (views) return views;
  } catch (error) {
    console.warn(`Facebook video views field unavailable for ${videoId}`, error);
  }

  for (const metric of ["total_video_views", "total_video_impressions"]) {
    try {
      const payload = await graphRequest(`${videoId}/video_insights`, {
        metric,
      }, accessToken);
      const views = insightValue(payload);
      if (views) return views;
    } catch (error) {
      console.warn(`Facebook ${metric} unavailable for ${videoId}`, error);
    }
  }

  return 0;
}

function facebookVideoAttachments(post: {
  attachments?: {
    data?: Array<{
      target?: { id?: string };
      media_type?: string;
      type?: string;
    }>;
  };
}) {
  return (post.attachments?.data || []).filter((attachment) => {
    const text = `${attachment.media_type || ""} ${attachment.type || ""}`.toLowerCase();
    return Boolean(attachment.target?.id) &&
      (text.includes("video") || text.includes("reel"));
  });
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

  const configuredAccessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!configuredAccessToken) {
    return json({ ok: false, error: "Instagram is not configured." }, 500, origin);
  }

  try {
    let page: {
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    } | undefined;

    try {
      const tokenOwner = await graphRequest("me", {
        fields: "id,name,instagram_business_account",
      }, configuredAccessToken);
      if (tokenOwner.instagram_business_account?.id) {
        page = tokenOwner;
      }
    } catch (error) {
      console.warn("Configured token is not a direct Page token", error);
    }

    if (!page) {
      const pagesPayload = await graphRequest("me/accounts", {
        fields: "id,name,access_token",
        limit: "100",
      }, configuredAccessToken);

      const connectedPages = await Promise.all(
        (pagesPayload.data || []).map(async (
          candidate: { id: string; name?: string; access_token?: string },
        ) => {
          const pageAccessToken = candidate.access_token || configuredAccessToken;
          try {
            const connection = await graphRequest(candidate.id, {
              fields: "instagram_business_account",
            }, pageAccessToken);
            return { ...candidate, ...connection };
          } catch (error) {
            console.warn(`Could not inspect Facebook Page ${candidate.id}`, error);
            return candidate;
          }
        }),
      );
      page = connectedPages.find(
        (candidate: { instagram_business_account?: { id?: string } }) =>
          candidate.instagram_business_account?.id,
      );
    }

    if (!page?.instagram_business_account?.id) {
      throw new Error(
        "No Instagram professional account is connected to a Facebook Page managed by this login.",
      );
    }

    const accessToken = page.access_token || configuredAccessToken;
    const account = await graphRequest(page.instagram_business_account.id, {
      fields: "id,username,name,profile_picture_url,followers_count,media_count",
    }, accessToken);
    let pageDetails: {
      fan_count?: number;
      followers_count?: number;
      picture?: { data?: { url?: string } };
      link?: string;
    } = {};
    try {
      pageDetails = await graphRequest(page.id, {
        fields: "fan_count,followers_count,picture.type(large),link",
      }, accessToken);
    } catch (error) {
      console.warn("Facebook Page details unavailable", error);
    }
    const mediaPayload = await graphRequest(`${account.id}/media`, {
      fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: "24",
    }, accessToken);
    let pagePostsPayload: {
      data?: Array<{
        id: string;
        message?: string;
        created_time?: string;
        permalink_url?: string;
        full_picture?: string;
        shares?: { count?: number };
        comments?: { summary?: { total_count?: number } };
        reactions?: { summary?: { total_count?: number } };
        attachments?: {
          data?: Array<{
            target?: { id?: string };
            media_type?: string;
            type?: string;
          }>;
        };
      }>;
    } = { data: [] };
    let pagePostsAvailable = false;
    try {
      pagePostsPayload = await graphRequest(`${page.id}/posts`, {
        fields: "id,message,created_time,permalink_url,full_picture,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true),attachments{target{id},media_type,type}",
        limit: "24",
      }, accessToken);
      pagePostsAvailable = true;
    } catch (error) {
      console.warn("Facebook Page posts unavailable", error);
    }

    const recentMedia = (mediaPayload.data || []).filter(
      (media: { timestamp?: string }) => media.timestamp &&
        new Date(media.timestamp) >= new Date(monthStartIso()),
    );
    const insights = await Promise.all(
      recentMedia.map((media: { id: string }) => mediaInsights(media.id, accessToken)),
    );
    const [reach, profileViews, accountViews, pageImpressions, pageEngagedUsers] = await Promise.all([
      accountInsight(account.id, "reach", accessToken),
      accountInsight(account.id, "profile_views", accessToken),
      accountInsight(account.id, "views", accessToken),
      pageInsight(page.id, "page_media_view,page_views_total", accessToken),
      pageInsight(page.id, "page_post_engagements", accessToken),
    ]);
    const recentPagePosts = (pagePostsPayload.data || []).filter(
      (post: { created_time?: string }) => post.created_time &&
        new Date(post.created_time) >= new Date(monthStartIso()),
    );
    const recentVideoPosts = recentPagePosts.filter((post: {
      attachments?: {
        data?: Array<{
          target?: { id?: string };
          media_type?: string;
          type?: string;
        }>;
      };
    }) => facebookVideoAttachments(post).length > 0);
    const pagePostInsights = await Promise.all(
      recentVideoPosts.map(async (post: {
        id: string;
        attachments?: { data?: Array<{ target?: { id?: string } }> };
      }) => {
        const videoId = facebookVideoAttachments(post)[0]?.target?.id;
        const [views, postReach, videoViews] = await Promise.all([
          postInsight(post.id, ["post_media_view", "post_video_views"], accessToken),
          postInsight(post.id, ["post_impressions_unique"], accessToken),
          facebookVideoViews(videoId, accessToken),
        ]);
        return {
          views: {
            available: views.available || videoViews > 0,
            value: views.value || videoViews,
          },
          reach: postReach,
        };
      }),
    );
    const measuredPostViews = pagePostInsights.reduce(
      (total, item) => total + item.views.value,
      0,
    );
    const measuredPostEngagements = recentVideoPosts.reduce(
      (total, post: {
        shares?: { count?: number };
        comments?: { summary?: { total_count?: number } };
        reactions?: { summary?: { total_count?: number } };
      }) =>
        total +
        numberValue(post.reactions?.summary?.total_count) +
        numberValue(post.comments?.summary?.total_count) +
        numberValue(post.shares?.count),
      0,
    );

    return json({
      ok: true,
      snapshot: {
        checkedAt: new Date().toISOString(),
        facebook: {
          page: {
            id: page.id,
            name: page.name || "Ella Crow",
            thumbnail: pageDetails.picture?.data?.url || "",
            link: pageDetails.link || "",
            followers: numberValue(
              pageDetails.followers_count || pageDetails.fan_count,
            ),
          },
          month: {
            views: pageImpressions.value || measuredPostViews,
            engagements: pageEngagedUsers.value || measuredPostEngagements,
            posts: recentVideoPosts.length,
          },
          access: {
            posts: pagePostsAvailable,
            insights: pageImpressions.available || pageEngagedUsers.available,
          },
          posts: recentVideoPosts.map((post: {
            id: string;
            message?: string;
            created_time?: string;
            permalink_url?: string;
            full_picture?: string;
            shares?: { count?: number };
            comments?: { summary?: { total_count?: number } };
            reactions?: { summary?: { total_count?: number } };
            attachments?: {
              data?: Array<{
                target?: { id?: string };
                media_type?: string;
                type?: string;
              }>;
            };
          }, index: number) => {
            const attachments = facebookVideoAttachments(post);
            return {
              id: post.id,
              caption: post.message || "Facebook reel",
              thumbnail: post.full_picture || "",
              permalink: post.permalink_url || "",
              publishedAt: post.created_time || "",
              likes: numberValue(post.reactions?.summary?.total_count),
              comments: numberValue(post.comments?.summary?.total_count),
              shares: numberValue(post.shares?.count),
              views: pagePostInsights[index]?.views.value || 0,
              reach: pagePostInsights[index]?.reach.value || 0,
              attachments: attachments.map((attachment) => ({
                targetId: attachment.target?.id || "",
                mediaType: attachment.media_type || "",
                type: attachment.type || "",
              })),
            };
          }),
        },
        account: {
          id: account.id,
          username: account.username || "3llacrow",
          name: account.name || "Ella Crow",
          thumbnail: account.profile_picture_url || "",
          followers: numberValue(account.followers_count),
          mediaCount: numberValue(account.media_count),
        },
        month: {
          reach,
          profileViews,
          views: accountViews,
          posts: recentMedia.length,
        },
        media: recentMedia.map((media: {
          id: string;
          caption?: string;
          media_type?: string;
          media_product_type?: string;
          media_url?: string;
          thumbnail_url?: string;
          permalink?: string;
          timestamp?: string;
          like_count?: number;
          comments_count?: number;
        }, index: number) => ({
          id: media.id,
          caption: media.caption || "Instagram post",
          mediaType: media.media_type || "",
          productType: media.media_product_type || "",
          thumbnail: media.thumbnail_url || media.media_url || "",
          permalink: media.permalink || "",
          publishedAt: media.timestamp || "",
          likes: numberValue(media.like_count),
          comments: numberValue(media.comments_count),
          views: numberValue(insights[index]?.views),
          reach: numberValue(insights[index]?.reach),
          saved: numberValue(insights[index]?.saved),
          shares: numberValue(insights[index]?.shares),
          interactions: numberValue(insights[index]?.total_interactions),
        })),
      },
    }, 200, origin);
  } catch (error) {
    console.error("Instagram stats failed", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Instagram data is unavailable.",
    }, 502, origin);
  }
  },
};
