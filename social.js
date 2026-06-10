(function () {
  const DATA_KEY = "ella-crow-social-youtube-v1";
  const config = window.ELLA_CLOUD_CONFIG || {};
  const youtubeStatsUrl = config.youtubeStatsUrl || "";
  const refreshButton = document.querySelector("#refreshYouTubeButton");
  const message = document.querySelector("#socialMessage");
  const emptyState = document.querySelector("#socialEmptyState");
  const videoList = document.querySelector("#videoPerformanceList");

  let savedData = readJson(DATA_KEY);

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

    const response = await fetch(youtubeStatsUrl);
    const payload = await response.json();
    if (!response.ok || !payload?.ok || !payload.snapshot) {
      throw new Error(payload?.error || "YouTube could not return this data.");
    }
    return payload.snapshot;
  }

  function setMessage(text, state = "") {
    message.textContent = text;
    message.dataset.state = state;
  }

  function setLoading(loading) {
    refreshButton.disabled = loading;
    if (loading) setMessage("Fetching the latest YouTube numbers...", "loading");
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

  function calculateEngagement(videos) {
    const totals = videos.reduce((result, video) => {
      result.views += video.views;
      result.actions += video.likes + video.comments;
      return result;
    }, { views: 0, actions: 0 });
    return totals.views ? (totals.actions / totals.views) * 100 : 0;
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

    const gains = months.map((month) =>
      Math.max(month.last.channel.views - month.first.channel.views, 0)
    );
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
      document.querySelector("#engagementMomentum").textContent = "-";
      document.querySelector("#topVideoTitle").textContent = "No video data yet";
      document.querySelector("#topVideoSignal").textContent =
        "The first snapshot will identify the strongest content signal.";
      document.querySelector("#engagementRate").textContent = "-";
      document.querySelector("#viewsPerSubscriber").textContent = "-";
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
    const engagement = calculateEngagement(current.videos);
    const recentViews = current.videos.reduce((sum, video) => sum + video.views, 0);
    const viewsPerSubscriber = current.channel.subscribers
      ? recentViews / current.channel.subscribers
      : 0;
    const score = Math.round(Math.min(
      100,
      35 + Math.min(subscriberGrowth * 12, 25) + Math.min(viewGrowth * 18, 20) + Math.min(engagement * 5, 20)
    ));
    const hasMonthlyMovement = Boolean(subscriberGain || viewGain);
    const topVideo = [...current.videos].sort((a, b) => b.views - a.views)[0];
    const months = monthlyData(data.history);

    document.querySelector("#pulseScore").textContent = score;
    document.querySelector("#pulseRing").style.setProperty("--pulse-score", `${score * 3.6}deg`);
    document.querySelector("#pulseStatus").textContent = hasMonthlyMovement ? "Tracking live" : "Baseline month";
    document.querySelector("#pulseHeadline").textContent =
      score >= 75 ? "Strong momentum" : score >= 55 ? "Healthy signal" : "Baseline building";
    document.querySelector("#pulseExplanation").textContent = hasMonthlyMovement
      ? `YouTube has added ${fullNumber(viewGain)} views and ${fullNumber(subscriberGain)} subscribers this month.`
      : "Keep refreshing over time to reveal true month-on-month momentum.";
    document.querySelector("#audienceMomentum").textContent =
      baseline ? `${subscriberGain >= 0 ? "+" : ""}${fullNumber(subscriberGain)}` : "Baseline";
    document.querySelector("#viewMomentum").textContent =
      baseline ? `${viewGain >= 0 ? "+" : ""}${compactNumber(viewGain)}` : "Baseline";
    document.querySelector("#engagementMomentum").textContent = percentage(engagement);
    document.querySelector("#growthPeriod").textContent = months.length > 1
      ? `Last ${months.length} months`
      : "First month";
    document.querySelector("#topVideoTitle").textContent = topVideo?.title || "No recent videos";
    document.querySelector("#topVideoSignal").textContent = topVideo
      ? `${compactNumber(topVideo.views)} views, ${compactNumber(topVideo.likes)} likes and ${compactNumber(topVideo.comments)} comments.`
      : "Publish or connect recent videos to reveal the strongest content.";
    document.querySelector("#engagementRate").textContent = percentage(engagement);
    document.querySelector("#viewsPerSubscriber").textContent =
      current.channel.subscribers ? viewsPerSubscriber.toFixed(1) : "-";
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

      const date = document.createElement("p");
      date.textContent = video.publishedAt
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(video.publishedAt))
        : "Publish date unavailable";

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

      copy.append(heading, date, metrics, track);
      card.append(rank, image, copy);
      videoList.append(card);
    });
  }

  function render(data) {
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

    const current = data.current;
    const baseline = currentMonthBaseline(data);
    const recentViews = current.videos.reduce((sum, video) => sum + video.views, 0);
    const averageViews = current.videos.length ? Math.round(recentViews / current.videos.length) : 0;

    document.querySelector("#channelName").textContent = current.channel.title;
    document.querySelector("#channelDescription").textContent =
      current.channel.description || "Latest channel and content performance from YouTube.";
    document.querySelector("#socialLastUpdated").textContent = formatDate(current.checkedAt);
    document.querySelector("#subscriberCount").textContent =
      current.channel.subscribersHidden ? "Hidden" : compactNumber(current.channel.subscribers);
    document.querySelector("#channelViewCount").textContent = compactNumber(current.channel.views);
    document.querySelector("#videoCount").textContent = fullNumber(current.channel.videos);
    document.querySelector("#recentViewCount").textContent = compactNumber(recentViews);
    document.querySelector("#averageRecentViews").textContent = compactNumber(averageViews);
    document.querySelector("#subscriberDelta").textContent = current.channel.subscribersHidden
      ? "Subscriber count is private"
      : deltaText(current.channel.subscribers, baseline?.channel?.subscribers, "subscriber");
    document.querySelector("#viewDelta").textContent =
      deltaText(current.channel.views, baseline?.channel?.views, "view");
    document.querySelector("#videoDelta").textContent =
      deltaText(current.channel.videos, baseline?.channel?.videos, "video");
    renderVideos(current.videos);
    renderIntelligence(data);
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

  refreshButton.addEventListener("click", refreshYouTube);

  window.addEventListener("ella-cloud-data-updated", (event) => {
    if (!event.detail?.keys?.includes(DATA_KEY)) return;
    savedData = readJson(DATA_KEY);
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
