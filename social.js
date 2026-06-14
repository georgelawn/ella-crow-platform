(function () {
  const DATA_KEY = "ella-crow-social-youtube-v1";
  const INSTAGRAM_DATA_KEY = "ella-crow-social-instagram-v1";
  const config = window.ELLA_CLOUD_CONFIG || {};
  const youtubeStatsUrl = config.youtubeStatsUrl || "";
  const instagramStatsUrl = config.instagramStatsUrl || "";
  const refreshButton = document.querySelector("#refreshYouTubeButton");
  const message = document.querySelector("#socialMessage");
  const emptyState = document.querySelector("#socialEmptyState");
  const videoList = document.querySelector("#videoPerformanceList");
  const platformTabs = [...document.querySelectorAll(".platform-tab[data-view]")];

  let savedData = readJson(DATA_KEY);
  let savedInstagramData = readJson(INSTAGRAM_DATA_KEY);
  let activeView = "youtube";

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function compactNumber(value) {
    return new Intl.NumberFormat("en-GB", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(numberValue(value));
  }

  function fullNumber(value) {
    return new Intl.NumberFormat("en-GB").format(numberValue(value));
  }

  function formatDate(value) {
    if (!value) return "Not connected";
    return `Updated ${new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))}`;
  }

  async function fetchYouTubeSnapshot() {
    if (!youtubeStatsUrl) {
      throw new Error("The YouTube connection is not configured.");
    }

    const url = new URL(youtubeStatsUrl);
    url.searchParams.set("refresh", String(Date.now()));
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload?.ok || !payload.snapshot) {
      throw new Error(payload?.error || "YouTube could not return this data.");
    }
    return payload.snapshot;
  }

  async function fetchInstagramSnapshot() {
    if (!instagramStatsUrl) {
      throw new Error("The Instagram connection is not configured.");
    }

    const url = new URL(instagramStatsUrl);
    url.searchParams.set("refresh", String(Date.now()));
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload?.ok || !payload.snapshot) {
      throw new Error(payload?.error || "Instagram could not return this data.");
    }
    return payload.snapshot;
  }

  function setMessage(text, state = "") {
    message.textContent = text;
    message.dataset.state = state;
  }

  function setLoading(loading) {
    refreshButton.disabled = loading;
    if (loading) {
      const platform = activeView === "facebook"
        ? "Facebook"
        : activeView === "instagram"
          ? "Instagram"
          : "YouTube";
      setMessage(`Fetching the latest ${platform} numbers...`, "loading");
    }
  }

  function deltaText(current, previous, label) {
    if (!previous) return "Building this month's baseline";
    const difference = numberValue(current) - numberValue(previous);
    if (!difference) return `No ${label} change this month`;
    return `${difference > 0 ? "+" : ""}${fullNumber(difference)} this month`;
  }

  function dayKey(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  function monthKey(value) {
    return new Date(value).toISOString().slice(0, 7);
  }

  function appendHistory(history, snapshot) {
    const snapshots = Array.isArray(history) ? [...history] : [];
    const today = dayKey(snapshot.checkedAt);
    const existingIndex = snapshots.findIndex((item) => dayKey(item.checkedAt) === today);
    if (existingIndex >= 0) {
      snapshots[existingIndex] = snapshot;
    } else {
      snapshots.push(snapshot);
    }
    return snapshots
      .sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt))
      .slice(-400);
  }

  function monthlyData(history) {
    const months = new Map();
    (history || []).forEach((snapshot) => {
      const key = monthKey(snapshot.checkedAt);
      const existing = months.get(key);
      if (!existing) {
        months.set(key, { key, first: snapshot, last: snapshot });
        return;
      }
      if (new Date(snapshot.checkedAt) < new Date(existing.first.checkedAt)) existing.first = snapshot;
      if (new Date(snapshot.checkedAt) > new Date(existing.last.checkedAt)) existing.last = snapshot;
    });
    return [...months.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  }

  function currentMonthBaseline(data) {
    const history = data?.history || [];
    const currentKey = monthKey(data.current.checkedAt);
    return history.find((snapshot) => monthKey(snapshot.checkedAt) === currentKey) || null;
  }

  function percentage(value) {
    return `${numberValue(value).toFixed(1)}%`;
  }

  function calculateRates(videos) {
    const totals = videos.reduce((result, video) => {
      result.views += video.views;
      result.likes += video.likes;
      result.comments += video.comments;
      return result;
    }, { views: 0, likes: 0, comments: 0 });
    return {
      likes: totals.views ? (totals.likes / totals.views) * 100 : 0,
      comments: totals.views ? (totals.comments / totals.views) * 100 : 0
    };
  }

  function fallbackIsShort(video) {
    if (typeof video.isShort === "boolean") return video.isShort;
    const title = video.title || "";
    const isProducedPerformance =
      /\b(acoustic session|live @|debut|cover|official video|music video)\b/i.test(title);
    if (isProducedPerformance) return false;
    if (video.durationSeconds) return video.durationSeconds <= 180;
    return title.length >= 70;
  }

  function videosForView(snapshot, view = activeView) {
    const videos = (snapshot?.videos || []).filter((video) =>
      view === "shorts" ? fallbackIsShort(video) : !fallbackIsShort(video)
    );
    if (view !== "shorts") return videos;

    const now = new Date(snapshot?.checkedAt || Date.now());
    return videos.filter((video) => {
      const published = new Date(video.publishedAt);
      return published.getFullYear() === now.getFullYear() &&
        published.getMonth() === now.getMonth();
    });
  }

  function viewSnapshot(snapshot, view = activeView) {
    if (!snapshot) return null;
    const videos = videosForView(snapshot, view);
    return {
      ...snapshot,
      channel: {
        ...snapshot.channel,
        views: videos.reduce((sum, video) => sum + video.views, 0),
        videos: videos.length
      },
      videos
    };
  }

  function dataForView(data, view = activeView) {
    if (!data?.current) return null;
    return {
      ...data,
      current: viewSnapshot(data.current, view),
      previous: viewSnapshot(data.previous, view),
      history: (data.history || []).map((snapshot) => viewSnapshot(snapshot, view))
    };
  }

  function renderGrowthChart(months) {
    const chart = document.querySelector("#growthChart");
    chart.replaceChildren();

    if (!months.length) {
      const empty = document.createElement("p");
      empty.className = "chart-empty";
      empty.textContent = "Monthly tracking begins with the first YouTube refresh.";
      chart.append(empty);
      return;
    }

    const gains = months.map((month) => Math.max(
      month.last.videos.reduce((sum, video) => sum + video.views, 0) -
      month.first.videos.reduce((sum, video) => sum + video.views, 0),
      0
    ));
    const maximum = Math.max(...gains, 1);

    months.forEach((month, index) => {
      const column = document.createElement("div");
      column.className = "chart-column";
      const value = document.createElement("strong");
      value.textContent = gains[index] ? `+${compactNumber(gains[index])}` : "0";
      const bar = document.createElement("span");
      bar.className = "chart-bar";
      bar.style.height = `${Math.max((gains[index] / maximum) * 100, 5)}%`;
      const label = document.createElement("small");
      label.textContent = new Intl.DateTimeFormat("en-GB", { month: "short" })
        .format(new Date(`${month.key}-01T12:00:00`));
      column.append(value, bar, label);
      chart.append(column);
    });
  }

  function renderIntelligence(data) {
    if (!data?.current) {
      document.querySelector("#pulseScore").textContent = "-";
      document.querySelector("#pulseHeadline").textContent = "Waiting for first snapshot";
      document.querySelector("#pulseExplanation").textContent =
        "This score will blend audience growth, views and engagement across every connected platform.";
      document.querySelector("#pulseStatus").textContent = "Building baseline";
      document.querySelector("#growthPeriod").textContent = "Waiting for data";
      document.querySelector("#audienceMomentum").textContent = "-";
      document.querySelector("#viewMomentum").textContent = "-";
      document.querySelector("#likeMomentum").textContent = "-";
      document.querySelector("#commentMomentum").textContent = "-";
      document.querySelector("#topVideoTitle").textContent = "No video data yet";
      document.querySelector("#topVideoSignal").textContent =
        "The first snapshot will identify the strongest content signal.";
      document.querySelector("#likeRate").textContent = "-";
      document.querySelector("#commentRate").textContent = "-";
      document.querySelector("#pulseRing").style.setProperty("--pulse-score", "0deg");
      renderGrowthChart([]);
      return;
    }

    const current = data.current;
    const baseline = currentMonthBaseline(data);
    const subscriberGain = baseline ? current.channel.subscribers - baseline.channel.subscribers : 0;
    const viewGain = baseline ? current.channel.views - baseline.channel.views : 0;
    const subscriberGrowth = baseline?.channel?.subscribers
      ? (subscriberGain / baseline.channel.subscribers) * 100
      : 0;
    const viewGrowth = baseline?.channel?.views
      ? (viewGain / baseline.channel.views) * 100
      : 0;
    const rates = calculateRates(current.videos);
    const recentViews = current.videos.reduce((sum, video) => sum + video.views, 0);
    const viewsPerSubscriber = current.channel.subscribers
      ? recentViews / current.channel.subscribers
      : 0;
    const score = Math.round(Math.min(
      100,
      35 + Math.min(subscriberGrowth * 12, 25) + Math.min(viewGrowth * 18, 20) +
      Math.min((rates.likes + rates.comments) * 5, 20)
    ));
    const hasMonthlyMovement = Boolean(subscriberGain || viewGain);
    const topVideo = [...current.videos].sort((a, b) => b.views - a.views)[0];
    const months = monthlyData(data.history);

    document.querySelector("#pulseScore").textContent = score;
    document.querySelector("#pulseRing").style.setProperty("--pulse-score", `${score * 3.6}deg`);
    document.querySelector("#pulseStatus").textContent = hasMonthlyMovement ? "Tracking live" : "Baseline month";
    document.querySelector("#pulseHeadline").textContent =
      score >= 75 ? "Strong momentum" : score >= 55 ? "Healthy signal" : "Baseline building";
    const platformLabel = activeView === "shorts" ? "Shorts" : "Long-form YouTube";
    document.querySelector("#pulseExplanation").textContent = hasMonthlyMovement
      ? `${platformLabel} has added ${fullNumber(viewGain)} views this month. The ${fullNumber(subscriberGain)} subscriber change is channel-wide.`
      : "Keep refreshing over time to reveal true month-on-month momentum.";
    document.querySelector("#audienceMomentum").textContent =
      baseline ? `${subscriberGain >= 0 ? "+" : ""}${fullNumber(subscriberGain)}` : "Baseline";
    document.querySelector("#viewMomentum").textContent =
      baseline ? `${viewGain >= 0 ? "+" : ""}${compactNumber(viewGain)}` : "Baseline";
    document.querySelector("#likeMomentum").textContent = percentage(rates.likes);
    document.querySelector("#commentMomentum").textContent = percentage(rates.comments);
    document.querySelector("#growthPeriod").textContent = months.length > 1
      ? `Last ${months.length} months`
      : "First month";
    document.querySelector("#topVideoTitle").textContent = topVideo?.title || "No recent videos";
    document.querySelector("#topVideoSignal").textContent = topVideo
      ? `${compactNumber(topVideo.views)} views, ${compactNumber(topVideo.likes)} likes and ${compactNumber(topVideo.comments)} comments.`
      : "Publish or connect recent videos to reveal the strongest content.";
    document.querySelector("#likeRate").textContent = percentage(rates.likes);
    document.querySelector("#commentRate").textContent = percentage(rates.comments);
    renderGrowthChart(months);
  }

  function createMetric(label, value) {
    const item = document.createElement("span");
    item.className = "video-metric";

    const strong = document.createElement("strong");
    strong.textContent = compactNumber(value);
    item.append(strong, ` ${label}`);
    return item;
  }

  function formatDuration(seconds) {
    if (!seconds) return "";
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function renderVideos(videos) {
    videoList.replaceChildren();
    emptyState.hidden = videos.length > 0;

    if (!videos.length) return;
    const maximumViews = Math.max(...videos.map((video) => video.views), 1);

    videos.forEach((video, index) => {
      const card = document.createElement("a");
      card.className = "video-performance-card";
      card.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
      card.target = "_blank";
      card.rel = "noreferrer";

      const rank = document.createElement("span");
      rank.className = "video-rank";
      rank.textContent = String(index + 1).padStart(2, "0");

      const image = document.createElement("img");
      image.src = video.thumbnail;
      image.alt = "";
      image.loading = "lazy";

      const copy = document.createElement("div");
      copy.className = "video-performance-copy";

      const heading = document.createElement("h3");
      heading.textContent = video.title;

      const badge = document.createElement("span");
      badge.className = `content-format-badge${fallbackIsShort(video) ? " short" : ""}`;
      badge.textContent = fallbackIsShort(video) ? "Short" : "Video";

      const date = document.createElement("p");
      const dateText = video.publishedAt
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(video.publishedAt))
        : "Publish date unavailable";
      const durationText = formatDuration(video.durationSeconds);
      date.textContent = durationText ? `${dateText} · ${durationText}` : dateText;

      const metrics = document.createElement("div");
      metrics.className = "video-metrics";
      metrics.append(
        createMetric("views", video.views),
        createMetric("likes", video.likes),
        createMetric("comments", video.comments)
      );

      const track = document.createElement("span");
      track.className = "performance-track";
      const fill = document.createElement("span");
      fill.style.width = `${Math.max((video.views / maximumViews) * 100, 2)}%`;
      track.append(fill);

      copy.append(badge, heading, date, metrics, track);
      card.append(rank, image, copy);
      videoList.append(card);
    });
  }

  function instagramRates(media) {
    const totals = (media || []).reduce((result, item) => {
      result.reach += item.reach || item.views;
      result.likes += item.likes;
      result.comments += item.comments;
      return result;
    }, { reach: 0, likes: 0, comments: 0 });
    return {
      likes: totals.reach ? (totals.likes / totals.reach) * 100 : 0,
      comments: totals.reach ? (totals.comments / totals.reach) * 100 : 0
    };
  }

  function renderInstagramGrowth(data) {
    const chart = document.querySelector("#growthChart");
    chart.replaceChildren();
    const snapshots = data?.history || [];
    const months = new Map();
    snapshots.forEach((snapshot) => {
      const key = monthKey(snapshot.checkedAt);
      months.set(key, snapshot);
    });
    const entries = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "chart-empty";
      empty.textContent = "Monthly tracking begins with the first Instagram refresh.";
      chart.append(empty);
      return;
    }

    const values = entries.map(([, snapshot]) =>
      snapshot.month?.reach || snapshot.month?.views || 0
    );
    const maximum = Math.max(...values, 1);
    entries.forEach(([key], index) => {
      const column = document.createElement("div");
      column.className = "chart-column";
      const value = document.createElement("strong");
      value.textContent = compactNumber(values[index]);
      const bar = document.createElement("span");
      bar.className = "chart-bar instagram-chart-bar";
      bar.style.height = `${Math.max((values[index] / maximum) * 100, 5)}%`;
      const label = document.createElement("small");
      label.textContent = new Intl.DateTimeFormat("en-GB", { month: "short" })
        .format(new Date(`${key}-01T12:00:00`));
      column.append(value, bar, label);
      chart.append(column);
    });
  }

  function renderInstagramMedia(media) {
    videoList.replaceChildren();
    emptyState.hidden = media.length > 0;
    emptyState.querySelector("strong").textContent = "No Instagram posts this month";
    emptyState.querySelector("p").textContent =
      "New posts and Reels will appear here after the next Instagram refresh.";
    if (!media.length) return;

    const maximumReach = Math.max(...media.map((item) => item.reach || item.views), 1);
    media.forEach((item, index) => {
      const card = document.createElement("a");
      card.className = "video-performance-card instagram-performance-card";
      card.href = item.permalink || `https://www.instagram.com/${encodeURIComponent(item.id)}`;
      card.target = "_blank";
      card.rel = "noreferrer";

      const rank = document.createElement("span");
      rank.className = "video-rank";
      rank.textContent = String(index + 1).padStart(2, "0");

      const image = document.createElement("img");
      image.src = item.thumbnail;
      image.alt = "";
      image.loading = "lazy";

      const copy = document.createElement("div");
      copy.className = "video-performance-copy";
      const badge = document.createElement("span");
      badge.className = "content-format-badge instagram";
      badge.textContent = item.productType === "REELS" ? "Reel" : "Post";
      const heading = document.createElement("h3");
      heading.textContent = item.caption.split("\n")[0].slice(0, 120) || "Instagram post";
      const date = document.createElement("p");
      date.textContent = item.publishedAt
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.publishedAt))
        : "Publish date unavailable";
      const metrics = document.createElement("div");
      metrics.className = "video-metrics";
      metrics.append(
        createMetric(item.views ? "views" : "reached", item.views || item.reach),
        createMetric("likes", item.likes),
        createMetric("comments", item.comments)
      );
      const track = document.createElement("span");
      track.className = "performance-track";
      const fill = document.createElement("span");
      fill.style.width =
        `${Math.max(((item.reach || item.views) / maximumReach) * 100, 2)}%`;
      track.append(fill);
      copy.append(badge, heading, date, metrics, track);
      card.append(rank, image, copy);
      videoList.append(card);
    });
  }

  function renderInstagram(data) {
    refreshButton.textContent = "Refresh Instagram";
    document.querySelector("#channelName").textContent = data?.current
      ? `@${data.current.account.username} Instagram`
      : "Instagram overview";
    document.querySelector("#channelDescription").textContent =
      "Follower growth, monthly reach and the posts and Reels driving engagement.";
    document.querySelector(".social-summary article:first-child p").textContent = "Followers";
    document.querySelector("#viewCountLabel").textContent = "Accounts reached this month";
    document.querySelector("#videoCountLabel").textContent = "Posts and Reels this month";
    document.querySelector("#averageViewLabel").textContent = "Profile views this month";
    document.querySelector("#recentViewNote").textContent = "Current calendar month";
    document.querySelector("#boardAverageLabel").textContent = "Average reach";
    document.querySelector("#trendFutureLabel").textContent = "Instagram tracked separately";
    document.querySelector(".trend-legend span:first-child").lastChild.textContent =
      "Instagram accounts reached";
    document.querySelector(".social-board h2").textContent = "Instagram this month";
    document.querySelector(".signal-feature > span").textContent = "Top Instagram post";

    if (!data?.current) {
      document.querySelector("#socialLastUpdated").textContent = "Not connected";
      ["subscriberCount", "channelViewCount", "videoCount", "recentViewCount", "averageRecentViews"]
        .forEach((id) => { document.querySelector(`#${id}`).textContent = "-"; });
      document.querySelector("#subscriberDelta").textContent = "Monthly baseline not started";
      document.querySelector("#viewDelta").textContent = "Monthly baseline not started";
      document.querySelector("#videoDelta").textContent = "Monthly baseline not started";
      renderInstagramMedia([]);
      document.querySelector("#pulseScore").textContent = "-";
      document.querySelector("#pulseHeadline").textContent = "Waiting for first snapshot";
      document.querySelector("#pulseExplanation").textContent =
        "Instagram growth and engagement will appear after the secure connection is complete.";
      document.querySelector("#pulseStatus").textContent = "Building baseline";
      document.querySelector("#growthPeriod").textContent = "Waiting for data";
      document.querySelector("#audienceMomentum").textContent = "-";
      document.querySelector("#viewMomentum").textContent = "-";
      document.querySelector("#likeMomentum").textContent = "-";
      document.querySelector("#commentMomentum").textContent = "-";
      document.querySelector("#topVideoTitle").textContent = "No Instagram data yet";
      document.querySelector("#topVideoSignal").textContent =
        "The first snapshot will identify the strongest post or Reel.";
      document.querySelector("#likeRate").textContent = "-";
      document.querySelector("#commentRate").textContent = "-";
      document.querySelector("#pulseRing").style.setProperty("--pulse-score", "0deg");
      renderInstagramGrowth(null);
      return;
    }

    const current = data.current;
    const baseline = currentMonthBaseline(data);
    const rates = instagramRates(current.media);
    const followerGain = baseline
      ? current.account.followers - baseline.account.followers
      : 0;
    const reach = current.month.reach ||
      current.media.reduce((sum, item) => sum + (item.reach || item.views), 0);
    const measuredMediaReach = current.media.reduce(
      (sum, item) => sum + (item.reach || item.views),
      0
    );
    const averageReach = current.media.length
      ? Math.round(measuredMediaReach / current.media.length)
      : 0;
    const topPost = [...current.media].sort(
      (a, b) => (b.reach || b.views) - (a.reach || a.views)
    )[0];
    const score = Math.round(Math.min(
      100,
      35 + Math.min(Math.max(followerGain, 0) * 2, 20) +
      Math.min(rates.likes * 5, 25) + Math.min(rates.comments * 20, 20)
    ));

    document.querySelector("#socialLastUpdated").textContent = formatDate(current.checkedAt);
    document.querySelector("#subscriberCount").textContent = compactNumber(current.account.followers);
    document.querySelector(".social-summary article:first-child p").textContent = "Followers";
    document.querySelector("#channelViewCount").textContent = compactNumber(reach);
    document.querySelector("#videoCount").textContent = fullNumber(current.month.posts);
    document.querySelector("#recentViewCount").textContent = compactNumber(current.month.profileViews);
    document.querySelector("#averageRecentViews").textContent = compactNumber(averageReach);
    document.querySelector("#subscriberDelta").textContent = baseline
      ? `${followerGain >= 0 ? "+" : ""}${fullNumber(followerGain)} this month`
      : "Building this month's baseline";
    document.querySelector("#viewDelta").textContent = "Current calendar month";
    document.querySelector("#videoDelta").textContent = "Current calendar month";
    document.querySelector("#pulseScore").textContent = score;
    document.querySelector("#pulseRing").style.setProperty("--pulse-score", `${score * 3.6}deg`);
    document.querySelector("#pulseStatus").textContent = baseline ? "Tracking live" : "Baseline month";
    document.querySelector("#pulseHeadline").textContent =
      score >= 75 ? "Strong momentum" : score >= 55 ? "Healthy signal" : "Baseline building";
    document.querySelector("#pulseExplanation").textContent =
      `${compactNumber(reach)} accounts reached across ${current.month.posts} posts and Reels this month.`;
    document.querySelector("#audienceMomentum").textContent = baseline
      ? `${followerGain >= 0 ? "+" : ""}${fullNumber(followerGain)}`
      : "Baseline";
    document.querySelector("#viewMomentum").textContent = compactNumber(reach);
    document.querySelector("#likeMomentum").textContent = percentage(rates.likes);
    document.querySelector("#commentMomentum").textContent = percentage(rates.comments);
    document.querySelector("#growthPeriod").textContent =
      data.history?.length > 1 ? "Month on month" : "First month";
    document.querySelector("#topVideoTitle").textContent =
      topPost?.caption.split("\n")[0].slice(0, 100) || "No posts this month";
    document.querySelector("#topVideoSignal").textContent = topPost
      ? `${compactNumber(topPost.reach || topPost.views)} reached, ${compactNumber(topPost.likes)} likes and ${compactNumber(topPost.comments)} comments.`
      : "The strongest post will appear after Instagram returns this month's media.";
    document.querySelector("#likeRate").textContent = percentage(rates.likes);
    document.querySelector("#commentRate").textContent = percentage(rates.comments);
    renderInstagramGrowth(data);
    renderInstagramMedia(current.media);
  }

  function facebookRates(posts) {
    const totals = (posts || []).reduce((result, post) => {
      result.views += post.views || post.reach;
      result.likes += post.likes;
      result.comments += post.comments;
      return result;
    }, { views: 0, likes: 0, comments: 0 });
    return {
      likes: totals.views ? (totals.likes / totals.views) * 100 : 0,
      comments: totals.views ? (totals.comments / totals.views) * 100 : 0
    };
  }

  function renderFacebookGrowth(data) {
    const chart = document.querySelector("#growthChart");
    chart.replaceChildren();
    const months = new Map();
    (data?.history || []).forEach((snapshot) => {
      if (!snapshot.facebook) return;
      months.set(monthKey(snapshot.checkedAt), snapshot.facebook);
    });
    const entries = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "chart-empty";
      empty.textContent = "Monthly tracking begins with the first Facebook refresh.";
      chart.append(empty);
      return;
    }

    const values = entries.map(([, facebook]) => facebook.page?.followers || 0);
    const maximum = Math.max(...values, 1);
    entries.forEach(([key], index) => {
      const column = document.createElement("div");
      column.className = "chart-column";
      const value = document.createElement("strong");
      value.textContent = compactNumber(values[index]);
      const bar = document.createElement("span");
      bar.className = "chart-bar facebook-chart-bar";
      bar.style.height = `${Math.max((values[index] / maximum) * 100, 5)}%`;
      const label = document.createElement("small");
      label.textContent = new Intl.DateTimeFormat("en-GB", { month: "short" })
        .format(new Date(`${key}-01T12:00:00`));
      column.append(value, bar, label);
      chart.append(column);
    });
  }

  function renderFacebookPosts(posts) {
    videoList.replaceChildren();
    emptyState.hidden = posts.length > 0;
    if (!posts.length) return;

    const maximumEngagement = Math.max(
      ...posts.map((post) => post.likes + post.comments + post.shares),
      1
    );
    posts.forEach((post, index) => {
      const card = document.createElement("a");
      card.className = "video-performance-card facebook-performance-card";
      card.href = post.permalink || "#";
      card.target = "_blank";
      card.rel = "noreferrer";

      const rank = document.createElement("span");
      rank.className = "video-rank";
      rank.textContent = String(index + 1).padStart(2, "0");

      const image = document.createElement("img");
      image.src = post.thumbnail;
      image.alt = "";
      image.loading = "lazy";

      const copy = document.createElement("div");
      copy.className = "video-performance-copy";
      const badge = document.createElement("span");
      badge.className = "content-format-badge facebook";
      badge.textContent = "Facebook post";
      const heading = document.createElement("h3");
      heading.textContent = post.caption.split("\n")[0].slice(0, 120) || "Facebook post";
      const date = document.createElement("p");
      date.textContent = post.publishedAt
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(post.publishedAt))
        : "Publish date unavailable";
      const metrics = document.createElement("div");
      metrics.className = "video-metrics";
      metrics.append(
        createMetric("reactions", post.likes),
        createMetric("comments", post.comments),
        createMetric("shares", post.shares)
      );
      const engagement = post.likes + post.comments + post.shares;
      const track = document.createElement("span");
      track.className = "performance-track";
      const fill = document.createElement("span");
      fill.style.width = `${Math.max((engagement / maximumEngagement) * 100, 2)}%`;
      track.append(fill);
      copy.append(badge, heading, date, metrics, track);
      card.append(rank, image, copy);
      videoList.append(card);
    });
  }

  function renderFacebook(data) {
    const current = data?.current;
    const facebook = current?.facebook;
    const posts = facebook?.posts || [];
    const postsAvailable = facebook?.access?.posts === true;
    const insightsAvailable = facebook?.access?.insights === true;
    const baselineSnapshot = (data?.history || []).find((snapshot) =>
      monthKey(snapshot.checkedAt) === monthKey(current?.checkedAt || Date.now())
    );
    const baselineFollowers = baselineSnapshot?.facebook?.page?.followers;
    const followerGain = baselineFollowers == null
      ? null
      : facebook.page.followers - baselineFollowers;
    const rates = facebookRates(posts);
    const topPost = [...posts].sort(
      (a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)
    )[0];

    refreshButton.textContent = "Refresh Facebook";
    document.querySelector("#channelName").textContent = facebook
      ? `${facebook.page.name} Facebook`
      : "Facebook overview";
    document.querySelector("#channelDescription").textContent =
      "Page audience, publishing activity and the posts building Ella's Facebook presence.";
    document.querySelector(".social-summary article:first-child p").textContent = "Page followers";
    document.querySelector("#viewCountLabel").textContent = "Page views this month";
    document.querySelector("#videoCountLabel").textContent = "Posts this month";
    document.querySelector("#averageViewLabel").textContent = "Engagements this month";
    document.querySelector("#recentViewNote").textContent =
      insightsAvailable ? "Current calendar month" : "Awaiting Meta access";
    document.querySelector("#boardAverageLabel").textContent = "Page followers";
    document.querySelector("#trendFutureLabel").textContent = "Facebook tracked separately";
    document.querySelector(".trend-legend span:first-child").lastChild.textContent =
      "Facebook followers";
    document.querySelector(".social-board h2").textContent = "Facebook this month";
    document.querySelector(".signal-feature > span").textContent = "Top Facebook post";

    if (!facebook) {
      document.querySelector("#socialLastUpdated").textContent = "Not connected";
      ["subscriberCount", "channelViewCount", "videoCount", "recentViewCount", "averageRecentViews"]
        .forEach((id) => { document.querySelector(`#${id}`).textContent = "-"; });
      document.querySelector("#subscriberDelta").textContent = "Monthly baseline not started";
      document.querySelector("#viewDelta").textContent = "Monthly baseline not started";
      document.querySelector("#videoDelta").textContent = "Monthly baseline not started";
      renderFacebookPosts([]);
      renderFacebookGrowth(null);
      return;
    }

    emptyState.querySelector("strong").textContent = postsAvailable
      ? "No Facebook posts this month"
      : "Facebook post insights are pending";
    emptyState.querySelector("p").textContent = postsAvailable
      ? "New Page posts will appear here after the next Facebook refresh."
      : "The Page is connected. Meta has not yet released its post-level engagement data to this app.";

    document.querySelector("#socialLastUpdated").textContent = formatDate(current.checkedAt);
    document.querySelector("#subscriberCount").textContent = compactNumber(facebook.page.followers);
    document.querySelector("#channelViewCount").textContent = insightsAvailable
      ? compactNumber(facebook.month.views)
      : "-";
    document.querySelector("#videoCount").textContent = postsAvailable
      ? fullNumber(facebook.month.posts)
      : "-";
    document.querySelector("#recentViewCount").textContent = insightsAvailable
      ? compactNumber(facebook.month.engagements)
      : "-";
    document.querySelector("#averageRecentViews").textContent =
      compactNumber(facebook.page.followers);
    document.querySelector("#subscriberDelta").textContent = followerGain == null
      ? "Building this month's baseline"
      : `${followerGain >= 0 ? "+" : ""}${fullNumber(followerGain)} this month`;
    document.querySelector("#viewDelta").textContent = insightsAvailable
      ? "Current calendar month"
      : "Meta permission pending";
    document.querySelector("#videoDelta").textContent = postsAvailable
      ? "Current calendar month"
      : "Meta permission pending";
    document.querySelector("#pulseScore").textContent = insightsAvailable ? "50" : "-";
    document.querySelector("#pulseRing").style.setProperty(
      "--pulse-score",
      insightsAvailable ? "180deg" : "0deg"
    );
    document.querySelector("#pulseStatus").textContent =
      insightsAvailable ? "Tracking live" : "Page connected";
    document.querySelector("#pulseHeadline").textContent =
      insightsAvailable ? "Facebook baseline" : "Audience connected";
    document.querySelector("#pulseExplanation").textContent = insightsAvailable
      ? `${compactNumber(facebook.month.engagements)} engagements across ${facebook.month.posts} posts this month.`
      : postsAvailable
        ? "Follower and post tracking are live. Page-level engagement insights are still awaiting Meta access."
        : "Follower tracking is live. Post and engagement insights will appear once Meta releases access.";
    document.querySelector("#audienceMomentum").textContent = followerGain == null
      ? "Baseline"
      : `${followerGain >= 0 ? "+" : ""}${fullNumber(followerGain)}`;
    document.querySelector("#viewMomentum").textContent = insightsAvailable
      ? compactNumber(facebook.month.views)
      : "Pending";
    document.querySelector("#likeMomentum").textContent = insightsAvailable
      ? percentage(rates.likes)
      : "-";
    document.querySelector("#commentMomentum").textContent = insightsAvailable
      ? percentage(rates.comments)
      : "-";
    document.querySelector("#growthPeriod").textContent =
      data.history?.length > 1 ? "Month on month" : "First month";
    document.querySelector("#topVideoTitle").textContent =
      topPost?.caption.split("\n")[0].slice(0, 100) ||
      (postsAvailable ? "No posts this month" : "Post insights pending");
    document.querySelector("#topVideoSignal").textContent = topPost
      ? `${compactNumber(topPost.likes)} reactions, ${compactNumber(topPost.comments)} comments and ${compactNumber(topPost.shares)} shares.`
      : postsAvailable
        ? "The Page connection is healthy. New posts will be measured here automatically."
        : "The Page connection is healthy; Meta is not yet returning post-level performance.";
    document.querySelector("#likeRate").textContent = insightsAvailable
      ? percentage(rates.likes)
      : "-";
    document.querySelector("#commentRate").textContent = insightsAvailable
      ? percentage(rates.comments)
      : "-";
    renderFacebookGrowth(data);
    renderFacebookPosts(posts);
  }

  function render(data) {
    if (activeView === "instagram") {
      renderInstagram(savedInstagramData);
      return;
    }
    if (activeView === "facebook") {
      renderFacebook(savedInstagramData);
      return;
    }
    refreshButton.textContent = "Refresh YouTube";
    document.querySelector(".social-summary article:first-child p").textContent = "Subscribers";
    document.querySelector(".signal-feature > span").textContent = "Top recent video";
    if (!data?.current) {
      document.querySelector("#channelName").textContent = "YouTube overview";
      document.querySelector("#channelDescription").textContent =
        "Ella's YouTube growth, audience momentum and recent video performance.";
      document.querySelector("#socialLastUpdated").textContent = "Not connected";
      ["subscriberCount", "channelViewCount", "videoCount", "recentViewCount", "averageRecentViews"]
        .forEach((id) => { document.querySelector(`#${id}`).textContent = "-"; });
      document.querySelector("#subscriberDelta").textContent = "Monthly baseline not started";
      document.querySelector("#viewDelta").textContent = "Monthly baseline not started";
      document.querySelector("#videoDelta").textContent = "Monthly baseline not started";
      renderVideos([]);
      renderIntelligence(null);
      return;
    }

    const selectedData = dataForView(data);
    const current = selectedData.current;
    const baseline = currentMonthBaseline(selectedData);
    const recentViews = current.videos.reduce((sum, video) => sum + video.views, 0);
    const averageViews = current.videos.length ? Math.round(recentViews / current.videos.length) : 0;

    const isShorts = activeView === "shorts";
    document.querySelector("#channelName").textContent = isShorts
      ? `${current.channel.title} Shorts`
      : `${current.channel.title} YouTube`;
    document.querySelector("#channelDescription").textContent =
      isShorts
        ? "Short-form reach, engagement and recent Shorts performance."
        : "Long-form video reach, engagement and recent performance.";
    document.querySelector("#socialLastUpdated").textContent = formatDate(current.checkedAt);
    document.querySelector("#subscriberCount").textContent =
      current.channel.subscribersHidden ? "Hidden" : compactNumber(current.channel.subscribers);
    document.querySelector("#channelViewCount").textContent = compactNumber(current.channel.views);
    document.querySelector("#videoCount").textContent = fullNumber(current.channel.videos);
    document.querySelector("#recentViewCount").textContent = compactNumber(averageViews);
    document.querySelector("#averageRecentViews").textContent = compactNumber(averageViews);
    document.querySelector("#subscriberDelta").textContent = current.channel.subscribersHidden
      ? "Subscriber count is private"
      : deltaText(current.channel.subscribers, baseline?.channel?.subscribers, "subscriber");
    document.querySelector("#viewDelta").textContent =
      deltaText(current.channel.views, baseline?.channel?.views, "view");
    document.querySelector("#videoDelta").textContent =
      deltaText(current.channel.videos, baseline?.channel?.videos, isShorts ? "Short" : "video");
    document.querySelector("#viewCountLabel").textContent = isShorts ? "Shorts views this month" : "Recent video views";
    document.querySelector("#videoCountLabel").textContent = isShorts ? "Shorts this month" : "Recent uploads";
    document.querySelector("#averageViewLabel").textContent = isShorts ? "Average views this month" : "Average video views";
    document.querySelector("#recentViewNote").textContent = isShorts ? "Current calendar month" : "Long-form performance";
    document.querySelector("#boardAverageLabel").textContent = isShorts ? "This month's average" : "Long-form average";
    document.querySelector("#trendFutureLabel").textContent = isShorts ? "Long-form tracked separately" : "Shorts tracked separately";
    document.querySelector(".trend-legend span:first-child").lastChild.textContent =
      isShorts ? "YouTube Shorts views gained" : "YouTube video views gained";
    document.querySelector(".social-board h2").textContent = isShorts ? "Shorts this month" : "Recent videos";
    renderVideos(current.videos);
    renderIntelligence(selectedData);
  }

  async function refreshYouTube() {
    setLoading(true);
    try {
      const current = await fetchYouTubeSnapshot();
      savedData = {
        current,
        previous: savedData?.current || null,
        history: appendHistory(savedData?.history, current)
      };
      localStorage.setItem(DATA_KEY, JSON.stringify(savedData));
      render(savedData);
      setMessage(`YouTube updated with ${current.videos.length} recent videos.`, "success");
    } catch (error) {
      console.error("YouTube refresh failed", error);
      setMessage(error.message || "YouTube could not be refreshed.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshInstagram() {
    setLoading(true);
    try {
      const current = await fetchInstagramSnapshot();
      savedInstagramData = {
        current,
        previous: savedInstagramData?.current || null,
        history: appendHistory(savedInstagramData?.history, current)
      };
      localStorage.setItem(INSTAGRAM_DATA_KEY, JSON.stringify(savedInstagramData));
      render(savedData);
      const platform = activeView === "facebook" ? "Facebook" : "Instagram";
      const detail = activeView === "facebook"
        ? `${current.facebook.page.followers} Page followers`
        : `${current.media.length} posts and Reels this month`;
      setMessage(`${platform} updated with ${detail}.`, "success");
    } catch (error) {
      console.error("Instagram refresh failed", error);
      setMessage(error.message || "Instagram could not be refreshed.", "error");
    } finally {
      setLoading(false);
    }
  }

  refreshButton.addEventListener("click", () => {
    if (activeView === "instagram" || activeView === "facebook") {
      refreshInstagram();
      return;
    }
    refreshYouTube();
  });

  platformTabs.forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view || "youtube";
      platformTabs.forEach((tabButton) => {
        tabButton.classList.toggle("active", tabButton === button);
      });
      render(savedData);
      if (activeView === "instagram" || activeView === "facebook") {
        const lastCheck = savedInstagramData?.current?.checkedAt
          ? new Date(savedInstagramData.current.checkedAt).getTime()
          : 0;
        if (Date.now() - lastCheck > 12 * 60 * 60 * 1000) refreshInstagram();
      }
    });
  });

  window.addEventListener("ella-cloud-data-updated", (event) => {
    const keys = event.detail?.keys || [];
    if (keys.includes(DATA_KEY)) savedData = readJson(DATA_KEY);
    if (keys.includes(INSTAGRAM_DATA_KEY)) {
      savedInstagramData = readJson(INSTAGRAM_DATA_KEY);
    }
    if (!keys.includes(DATA_KEY) && !keys.includes(INSTAGRAM_DATA_KEY)) return;
    render(savedData);
  });

  refreshButton.disabled = false;
  render(savedData);

  const lastCheckTime = savedData?.current?.checkedAt
    ? new Date(savedData.current.checkedAt).getTime()
    : 0;
  const refreshAge = Date.now() - lastCheckTime;
  if (refreshAge > 12 * 60 * 60 * 1000) {
    refreshYouTube();
  }
})();
