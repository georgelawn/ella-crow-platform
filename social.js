(function () {
  const config = window.ELLA_CLOUD_CONFIG || {};
  const LOCAL_YOUTUBE_KEY = "ella-crow-social-youtube-v1";
  const LOCAL_META_KEY = "ella-crow-social-instagram-v1";
  const LOCAL_INSTAGRAM_DIRECT_KEY = "ella-crow-social-instagram-direct-v1";
  const LOCAL_TIKTOK_KEY = "ella-crow-social-tiktok-v1";
  const LOCAL_CREATIVE_MATCHES_KEY = "ella-crow-social-creative-matches-v1";
  const SOCIAL_HISTORY_START = "2026-06-01";
  const INSTAGRAM_DIRECT_VISIBLE = false;
  const PLATFORM_ORDER = [
    "youtube", "shorts", "instagram",
    ...(INSTAGRAM_DIRECT_VISIBLE ? ["instagram-direct"] : []),
    "facebook", "tiktok"
  ];
  const COMPARISON_PLATFORMS = [
    "shorts", "instagram",
    ...(INSTAGRAM_DIRECT_VISIBLE ? ["instagram-direct"] : []),
    "facebook", "tiktok"
  ];
  const HISTORY_PLATFORMS = ["shorts", "instagram", "facebook", "tiktok"];
  const CREATIVE_PLATFORMS = [
    "tiktok", "youtube", "instagram",
    ...(INSTAGRAM_DIRECT_VISIBLE ? ["instagram-direct"] : []),
    "facebook"
  ];
  const PLATFORM_LABELS = {
    youtube: "YouTube",
    shorts: "YouTube Shorts",
    instagram: "Instagram",
    "instagram-direct": "Instagram Direct",
    facebook: "Facebook",
    tiktok: "TikTok"
  };
  const SOCIAL_PERIODS = {
    "7": { days: 7, label: "Last 7 days", suffix: "last 7 days" },
    "30": { days: 30, label: "Last 30 days", suffix: "last 30 days" },
    all: { days: null, label: "All time", suffix: "all time" }
  };
  const BIO_PERIODS = {
    "3": { days: 3, label: "Last 3 days" },
    "7": { days: 7, label: "Last 7 days" },
    "30": { days: 30, label: "Last 30 days" },
    all: { days: 366, label: "All time" }
  };
  const CREATIVE_PERIODS = {
    all: { label: "All time", suffix: "all time" },
    "30": { label: "Last 30 days", suffix: "last 30 days" },
    "7": { label: "Last 7 days", suffix: "last 7 days" }
  };
  const state = {
    youtube: readJson(LOCAL_YOUTUBE_KEY),
    meta: readJson(LOCAL_META_KEY),
    instagramDirect: readJson(LOCAL_INSTAGRAM_DIRECT_KEY),
    tiktok: readJson(LOCAL_TIKTOK_KEY),
    manualCreativeMatches: readJson(LOCAL_CREATIVE_MATCHES_KEY) || {},
    selectedCreativeGroups: new Set(),
    creativeVisibleCount: 5,
    creativePeriod: "all",
    creativeSearch: null,
    socialPeriod: "30",
    bioPeriod: "30",
    historyPlatforms: new Set(HISTORY_PLATFORMS),
    historyZoom: 1,
    bio: null,
    activePlatform: null,
    supabase: null,
    refreshing: false
  };

  const elements = {
    overview: document.querySelector("#socialOverview"),
    drilldown: document.querySelector("#socialDrilldown"),
    title: document.querySelector("#socialTitle"),
    eyebrow: document.querySelector("#socialEyebrow"),
    description: document.querySelector("#socialDescription"),
    updated: document.querySelector("#socialLastUpdated"),
    message: document.querySelector("#socialMessage"),
    refresh: document.querySelector("#refreshSocialButton"),
    viewSharePeriod: document.querySelector("#viewSharePeriod"),
    cards: document.querySelector("#platformOverviewCards"),
    historyRange: document.querySelector("#socialHistoryRange"),
    historyFilters: document.querySelector("#socialHistoryFilters"),
    historyYAxis: document.querySelector("#socialHistoryYAxis"),
    historyScroll: document.querySelector("#socialHistoryScroll"),
    historyChart: document.querySelector("#socialHistoryChart"),
    historyZoom: document.querySelector("#socialHistoryZoom"),
    historyZoomOut: document.querySelector("#socialHistoryZoomOut"),
    historyZoomIn: document.querySelector("#socialHistoryZoomIn"),
    historyZoomValue: document.querySelector("#socialHistoryZoomValue"),
    viewShareDonut: document.querySelector("#viewShareDonut"),
    viewShareLegend: document.querySelector("#viewShareLegend"),
    totalPlatformViews: document.querySelector("#totalPlatformViews"),
    weekdayPerformance: document.querySelector("#weekdayPerformance"),
    bioViews: document.querySelector("#bioTotalViews"),
    bioClicks: document.querySelector("#bioTotalClicks"),
    bioRate: document.querySelector("#bioClickRate"),
    bioTop: document.querySelector("#bioTopButton"),
    bioDestinationTable: document.querySelector("#bioDestinationTable"),
    bioList: document.querySelector("#bioPlatformList"),
    bioEmpty: document.querySelector("#bioEmptyState"),
    creativeSummary: document.querySelector("#creativeMatchSummary"),
    creativeTopPeriod: document.querySelector("#creativeTopPeriod"),
    creativeRecentPeriod: document.querySelector("#creativeRecentPeriod"),
    creativeMergeBar: document.querySelector("#creativeMergeBar"),
    creativeSelectionSummary: document.querySelector("#creativeSelectionSummary"),
    mergeCreative: document.querySelector("#mergeCreativeButton"),
    clearCreativeSelection: document.querySelector("#clearCreativeSelectionButton"),
    creativeTopMatches: document.querySelector("#creativeTopMatches"),
    creativeMatches: document.querySelector("#creativeMatches"),
    creativeSearchPanel: document.querySelector("#creativeSearchPanel"),
    creativeShowMore: document.querySelector("#creativeShowMore"),
    creativeEmpty: document.querySelector("#creativeMatchEmpty"),
    back: document.querySelector("#socialBackButton"),
    drillHero: document.querySelector("#drilldownHero"),
    drillMetrics: document.querySelector("#drilldownMetrics"),
    drillInsights: document.querySelector("#drilldownInsights"),
    contentEyebrow: document.querySelector("#contentEyebrow"),
    contentTitle: document.querySelector("#contentTitle"),
    contentSummary: document.querySelector("#contentSummary"),
    content: document.querySelector("#drilldownContent"),
    drillEmpty: document.querySelector("#drilldownEmpty")
  };

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

  function compact(value) {
    return new Intl.NumberFormat("en-GB", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(numberValue(value));
  }

  function full(value) {
    return new Intl.NumberFormat("en-GB").format(numberValue(value));
  }

  function percent(value, digits = 1) {
    return `${numberValue(value).toFixed(digits)}%`;
  }

  function formatDate(value) {
    if (!value) return "Awaiting first refresh";
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function monthKey(value) {
    return new Date(value).toISOString().slice(0, 7);
  }

  function sameMonth(value, comparison = new Date()) {
    return monthKey(value) === monthKey(comparison);
  }

  function shiftedMonth(offset) {
    const date = new Date();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  }

  function selectedPeriod() {
    return SOCIAL_PERIODS[state.socialPeriod] || SOCIAL_PERIODS["30"];
  }

  function selectedCreativePeriod() {
    return CREATIVE_PERIODS[state.creativePeriod] || CREATIVE_PERIODS.all;
  }

  function creativePeriodIncludes(group) {
    if (state.creativePeriod === "all") return true;
    const latest = new Date(group.latestTime);
    if (!Number.isFinite(latest.getTime())) return false;
    if (state.creativePeriod === "30" || state.creativePeriod === "7") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(state.creativePeriod));
      return latest >= cutoff && latest < new Date();
    }
    return true;
  }

  function periodSuffix() {
    return selectedPeriod().suffix;
  }

  function periodLabel() {
    return selectedPeriod().label;
  }

  function periodOutputLabel(noun) {
    return selectedPeriod().days == null
      ? `${noun} all time`
      : `${noun} in ${periodSuffix()}`;
  }

  function periodCutoff(previous = false) {
    const days = selectedPeriod().days;
    if (days == null) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days * (previous ? 2 : 1));
    return cutoff;
  }

  function previousPeriodEnd() {
    const days = selectedPeriod().days;
    if (days == null) return null;
    const end = new Date();
    end.setDate(end.getDate() - days);
    return end;
  }

  function appendHistory(history, snapshot) {
    const next = Array.isArray(history) ? [...history] : [];
    const day = new Date(snapshot.checkedAt).toISOString().slice(0, 10);
    const index = next.findIndex((item) =>
      new Date(item.checkedAt).toISOString().slice(0, 10) === day
    );
    if (index >= 0) next[index] = snapshot;
    else next.push(snapshot);
    return next
      .sort((a, b) => new Date(a.checkedAt) - new Date(b.checkedAt))
      .slice(-400);
  }

  function baseline(data, platform) {
    if (!data?.current) return null;
    const key = monthKey(data.current.checkedAt);
    const history = data.history || [];
    return history.find((snapshot) => {
      if (monthKey(snapshot.checkedAt) !== key) return false;
      if (platform === "facebook") return Boolean(snapshot.facebook);
      return true;
    }) || null;
  }

  function isShort(video) {
    if (typeof video?.isShort === "boolean") return video.isShort;
    return numberValue(video?.durationSeconds) > 0 &&
      numberValue(video?.durationSeconds) <= 180;
  }

  function isFacebookVideoPost(item) {
    if (numberValue(item?.views) > 0) return true;
    if (numberValue(item?.durationSeconds) > 0) return true;
    const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
    return attachments.some((attachment) => {
      const text = `${attachment.mediaType || ""} ${attachment.type || ""}`.toLowerCase();
      return text.includes("video") || text.includes("reel");
    });
  }

  function youtubeContent(platform = "youtube") {
    const videos = state.youtube?.current?.videos || [];
    if (platform === "shorts") return videos.filter((video) => isShort(video));
    return videos.filter((video) => !isShort(video));
  }

  function allPlatformContent(platform) {
    let content = [];
    if (platform === "youtube" || platform === "shorts") {
      content = youtubeContent(platform);
    }
    if (platform === "instagram") content = state.meta?.current?.media || [];
    if (platform === "instagram-direct") {
      content = state.instagramDirect?.current?.media || [];
    }
    if (platform === "facebook") {
      content = (state.meta?.current?.facebook?.posts || []).filter(isFacebookVideoPost);
    }
    if (platform === "tiktok") content = state.tiktok?.current?.videos || [];
    return content;
  }

  function contentForPeriod(platform, previous = false) {
    const content = allPlatformContent(platform);
    const days = selectedPeriod().days;
    if (days == null) return content;
    const start = periodCutoff(previous);
    const end = previous ? previousPeriodEnd() : new Date();
    return content.filter((item) => {
      if (!item.publishedAt) return false;
      const published = new Date(item.publishedAt);
      return published >= start && published < end;
    });
  }

  function totals(items, reachField = "views") {
    return (items || []).reduce((result, item) => {
      result.views += numberValue(item[reachField] || item.views || item.reach);
      result.likes += numberValue(item.likes);
      result.comments += numberValue(item.comments);
      result.shares += numberValue(item.shares);
      result.saves += numberValue(item.saved);
      return result;
    }, { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  }

  function engagementRates(items, reachField = "views") {
    const total = totals(items, reachField);
    return {
      likes: total.views ? total.likes / total.views * 100 : 0,
      comments: total.views ? total.comments / total.views * 100 : 0,
      engagement: total.views
        ? (total.likes + total.comments + total.shares + total.saves) / total.views * 100
        : 0
    };
  }

  function platformData(platform) {
    if (platform === "youtube" || platform === "shorts") {
      const current = state.youtube?.current;
      const content = contentForPeriod(platform);
      const total = totals(content);
      const rates = engagementRates(content);
      const previousContent = contentForPeriod(platform, true);
      const previousReach = totals(previousContent).views;
      return {
        connected: Boolean(current),
        reach: total.views,
        reachLabel: `views ${periodSuffix()}`,
        previousReach,
        hasPreviousPeriod: previousContent.length > 0,
        output: content.length,
        outputLabel: platform === "shorts"
          ? periodOutputLabel("Shorts")
          : periodOutputLabel("videos"),
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audience: numberValue(current?.channel?.subscribers),
        audienceLabel: "subscribers",
        audienceDelta: null,
        reachDelta: previousContent.length ? total.views - previousReach : null,
        content,
        checkedAt: current?.checkedAt
      };
    }

    if (platform === "instagram") {
      const current = state.meta?.current;
      const accountCount = numberValue(current?.accountCount) ||
        (Array.isArray(current?.accounts) ? current.accounts.length : 0);
      const media = contentForPeriod(platform);
      const measuredReach = totals(media, "reach").views;
      const rates = engagementRates(media, "reach");
      const base = baseline(state.meta, platform);
      return {
        connected: Boolean(current?.account),
        accountCount,
        audience: numberValue(current?.account?.followers),
        audienceLabel: "followers",
        reach: measuredReach,
        reachLabel: `views ${periodSuffix()}`,
        previousReach: 0,
        hasPreviousPeriod: false,
        output: media.length,
        outputLabel: periodOutputLabel("posts and Reels"),
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audienceDelta: base
          ? numberValue(current.account.followers) - numberValue(base.account?.followers)
          : null,
        reachDelta: null,
        content: media,
        checkedAt: current?.checkedAt
      };
    }

    if (platform === "instagram-direct") {
      const current = state.instagramDirect?.current;
      const media = contentForPeriod(platform);
      const measuredReach = totals(media, "reach").views;
      const rates = engagementRates(media, "reach");
      const base = baseline(state.instagramDirect, platform);
      return {
        connected: Boolean(current?.account),
        identityLabel: current?.account?.username
          ? `@${current.account.username}`
          : "Instagram Direct",
        audience: numberValue(current?.account?.followers),
        audienceLabel: "followers",
        reach: measuredReach,
        reachLabel: `views ${periodSuffix()}`,
        previousReach: 0,
        hasPreviousPeriod: false,
        output: media.length,
        outputLabel: periodOutputLabel("posts and Reels"),
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audienceDelta: base
          ? numberValue(current.account.followers) - numberValue(base.account?.followers)
          : null,
        reachDelta: null,
        content: media,
        checkedAt: current?.checkedAt
      };
    }

    if (platform === "facebook") {
      const current = state.meta?.current;
      const facebook = current?.facebook;
      const posts = contentForPeriod(platform);
      const rates = engagementRates(posts);
      const base = baseline(state.meta, platform);
      return {
        connected: Boolean(facebook?.page),
        audience: numberValue(facebook?.page?.followers),
        audienceLabel: "page followers",
        reach: totals(posts).views,
        reachLabel: `views ${periodSuffix()}`,
        previousReach: 0,
        hasPreviousPeriod: false,
        output: posts.length,
        outputLabel: periodOutputLabel("posts"),
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audienceDelta: base?.facebook
          ? numberValue(facebook.page.followers) -
            numberValue(base.facebook.page?.followers)
          : null,
        reachDelta: null,
        content: posts,
        checkedAt: current?.checkedAt,
        access: facebook?.access || {}
      };
    }

    if (platform === "tiktok") {
      const current = state.tiktok?.current;
      const accountCount = numberValue(current?.accountCount) ||
        (Array.isArray(current?.accounts) ? current.accounts.length : 0);
      const content = contentForPeriod(platform);
      const total = totals(content);
      const rates = engagementRates(content);
      const previousContent = contentForPeriod(platform, true);
      const previousReach = totals(previousContent).views;
      const base = baseline(state.tiktok, platform);
      return {
        connected: Boolean(current?.account),
        comingSoon: false,
        accountCount,
        audience: numberValue(current?.account?.followers),
        audienceLabel: "followers",
        reach: total.views,
        reachLabel: `views ${periodSuffix()}`,
        previousReach,
        hasPreviousPeriod: previousContent.length > 0,
        output: content.length,
        outputLabel: periodOutputLabel("TikToks"),
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audienceDelta: base
          ? numberValue(current.account.followers) -
            numberValue(base.account?.followers)
          : null,
        reachDelta: previousContent.length ? total.views - previousReach : null,
        content,
        checkedAt: current?.checkedAt
      };
    }

    return {
      connected: false,
      comingSoon: true,
      audience: 0,
      audienceLabel: "followers",
      reach: 0,
      reachLabel: "video views",
      previousReach: 0,
      hasPreviousPeriod: false,
      output: 0,
      outputLabel: "posts",
      engagement: 0,
      likes: 0,
      comments: 0,
      audienceDelta: null,
      reachDelta: null,
      content: []
    };
  }

  function platformMark(platform) {
    return {
      youtube: "YT",
      shorts: "SHORTS",
      instagram: "IG",
      "instagram-direct": "IG2",
      facebook: "FB",
      tiktok: "TT"
    }[platform];
  }

  function metricDelta(value, noun) {
    if (value == null) return "Baseline building";
    if (value === 0) return `No ${noun} change yet`;
    return `${value > 0 ? "+" : ""}${full(value)} change`;
  }

  function reachDeltaText(data) {
    if (selectedPeriod().days == null) return "All available content";
    if (!data.hasPreviousPeriod) return "Previous-period baseline unavailable";
    return `${compact(data.previousReach)} previous period · ${data.reachDelta >= 0 ? "+" : ""}${compact(data.reachDelta)}`;
  }

  function syncPeriodButtons() {
    document.querySelectorAll("[data-social-period]").forEach((button) =>
      button.classList.toggle("active", button.dataset.socialPeriod === state.socialPeriod)
    );
    document.querySelectorAll("[data-bio-period]").forEach((button) =>
      button.classList.toggle("active", button.dataset.bioPeriod === state.bioPeriod)
    );
    document.querySelectorAll("[data-creative-period]").forEach((button) =>
      button.classList.toggle("active", button.dataset.creativePeriod === state.creativePeriod)
    );
  }

  function renderPlatformCards() {
    elements.cards.replaceChildren();
    PLATFORM_ORDER.forEach((platform) => {
      const data = platformData(platform);
      const card = document.createElement("button");
      card.className = `platform-overview-card platform-${platform}`;
      card.type = "button";
      card.dataset.platform = platform;
      card.innerHTML = `
        <span class="platform-card-top">
          <i>${platformMark(platform)}</i>
          <span>${data.comingSoon ? "Coming soon" : data.connected ? "Live" : "Connect"}</span>
        </span>
        <strong>${data.identityLabel || PLATFORM_LABELS[platform]}</strong>
        <span class="platform-card-number">${data.connected ? compact(data.reach) : "-"}</span>
        <small>${data.reachLabel}</small>
        <span class="platform-card-signal">${
          data.comingSoon
            ? "API connection prepared"
            : data.connected
              ? `${data.accountCount > 1 ? `${data.accountCount} accounts · ` : ""}${reachDeltaText(data)}`
              : "Data unavailable"
        }</span>
        <b>Open insight &rarr;</b>`;
      card.addEventListener("click", () => openDrilldown(platform));
      elements.cards.append(card);
    });
  }

  const PLATFORM_COLOURS = {
    youtube: "#8f3527",
    shorts: "#c45b45",
    instagram: "#a55f78",
    "instagram-direct": "#c4839d",
    facebook: "#506f91",
    tiktok: "#23170f"
  };

  function publishedViewSeries(platform) {
    const byDay = new Map();
    allPlatformContent(platform).forEach((item) => {
      const time = new Date(item?.publishedAt).getTime();
      if (!Number.isFinite(time)) return;
      const day = new Date(time).toISOString().slice(0, 10);
      byDay.set(
        day,
        numberValue(byDay.get(day)) + numberValue(item.views || item.reach)
      );
    });
    return byDay;
  }

  function dateRange(seriesByPlatform) {
    const dates = [...new Set(
      [...seriesByPlatform.values()].flatMap((series) => [...series.keys()])
    )].sort();
    if (!dates.length) return [];
    const start = new Date(`${SOCIAL_HISTORY_START}T00:00:00Z`);
    const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    if (end < start) return [];
    const result = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      result.push(cursor.toISOString().slice(0, 10));
    }
    return result;
  }

  function rollingAverage(values, index) {
    const sample = values.slice(Math.max(0, index - 29), index + 1)
      .filter((value) => value != null);
    return sample.length
      ? sample.reduce((sum, value) => sum + value, 0) / sample.length
      : null;
  }

  function svgPath(points, x, y) {
    let path = "";
    let drawing = false;
    points.forEach((value, index) => {
      if (value == null) {
        drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
      drawing = true;
    });
    return path.trim();
  }

  function renderHistoryFilters() {
    elements.historyFilters.replaceChildren();
    HISTORY_PLATFORMS.forEach((platform) => {
      const label = document.createElement("label");
      label.className = "social-history-filter";
      label.innerHTML = `
        <input type="checkbox" data-history-platform="${platform}" ${state.historyPlatforms.has(platform) ? "checked" : ""}>
        <i style="--platform-colour:${PLATFORM_COLOURS[platform]}"></i>
        <span>${PLATFORM_LABELS[platform]}</span>`;
      elements.historyFilters.append(label);
    });
  }

  function niceAxisMaximum(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function syncHistoryZoomControl() {
    const percentValue = Math.round(state.historyZoom * 100);
    elements.historyZoom.value = String(percentValue);
    elements.historyZoomValue.value = `${percentValue}%`;
    elements.historyZoomValue.textContent = `${percentValue}%`;
  }

  function renderHistoryChart({ scrollToLatest = true } = {}) {
    renderHistoryFilters();
    syncHistoryZoomControl();
    const seriesByPlatform = new Map(
      HISTORY_PLATFORMS.map((platform) => [platform, publishedViewSeries(platform)])
    );
    const dates = dateRange(seriesByPlatform);
    const visible = HISTORY_PLATFORMS.filter((platform) => state.historyPlatforms.has(platform));
    elements.historyChart.replaceChildren();
    elements.historyYAxis.replaceChildren();
    if (!dates.length || !visible.length) {
      elements.historyRange.textContent = dates.length ? "No platforms selected" : "Awaiting daily snapshots";
      elements.historyChart.innerHTML = `<div class="social-history-empty"><strong>${dates.length ? "Choose a platform" : "No published content yet"}</strong><span>${dates.length ? "Use the filters above to add chart lines." : "Published posts and Shorts will appear here after the next refresh."}</span></div>`;
      return;
    }

    const series = visible.map((platform) => {
      const actual = dates.map((date) => seriesByPlatform.get(platform).has(date)
        ? seriesByPlatform.get(platform).get(date)
        : null);
      return { platform, average: actual.map((value, index) => rollingAverage(actual, index)) };
    });
    const maximum = niceAxisMaximum(Math.max(1, ...series.flatMap((item) => item.average)
      .filter((value) => value != null)));
    const daySpacing = 44 * state.historyZoom;
    const chartWidth = Math.max(
      elements.historyScroll.clientWidth || 760,
      48 + Math.max(dates.length - 1, 1) * daySpacing
    );
    const chartHeight = 360;
    const left = 14;
    const right = 28;
    const top = 24;
    const bottom = 58;
    const plotHeight = chartHeight - top - bottom;
    const x = (index) => left + index * ((chartWidth - left - right) / Math.max(dates.length - 1, 1));
    const y = (value) => top + plotHeight - value / maximum * plotHeight;
    const formatAxis = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
    const formatDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
    const axis = Array.from({ length: 5 }, (_, index) => {
      const value = maximum * index / 4;
      return `<line x1="0" y1="${y(value)}" x2="${chartWidth}" y2="${y(value)}"></line>`;
    }).join("");
    const yAxis = Array.from({ length: 5 }, (_, index) => {
      const value = maximum * index / 4;
      return `<text x="52" y="${y(value) + 4}" text-anchor="end">${formatAxis.format(value)}</text><line x1="58" y1="${y(value)}" x2="64" y2="${y(value)}"></line>`;
    }).join("");
    const tickInterval = Math.max(1, Math.ceil(72 / daySpacing));
    const dateTicks = dates.map((date, index) => {
      if (index !== 0 && index !== dates.length - 1 && index % tickInterval !== 0) return "";
      return `<text x="${x(index)}" y="${chartHeight - 20}" text-anchor="middle">${formatDay.format(new Date(`${date}T12:00:00Z`))}</text>`;
    }).join("");
    const lines = series.map(({ platform, average }) => {
      const colour = PLATFORM_COLOURS[platform];
      const points = average.map((value, index) => value == null ? "" : `
        <circle cx="${x(index)}" cy="${y(value)}" r="6" tabindex="0" aria-label="${PLATFORM_LABELS[platform]}, ${dates[index]}: ${full(Math.round(value))} rolling 30-day average views">
          <title>${PLATFORM_LABELS[platform]} · ${formatDay.format(new Date(`${dates[index]}T12:00:00Z`))}: ${full(Math.round(value))} rolling 30-day average views</title>
        </circle>`).join("");
      return `<g class="history-series" style="--series-colour:${colour}">
        <path class="history-trend-line" d="${svgPath(average, x, y)}"></path>
        <g class="history-points">${points}</g>
      </g>`;
    }).join("");
    elements.historyYAxis.innerHTML = `<svg viewBox="0 0 64 ${chartHeight}" width="64" height="${chartHeight}"><g class="history-y-labels">${yAxis}</g></svg>`;
    elements.historyChart.innerHTML = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}" role="img" aria-label="Rolling 30-day platform view averages"><g class="history-grid">${axis}</g><g class="history-dates">${dateTicks}</g>${lines}</svg>`;
    elements.historyRange.textContent = `${formatDay.format(new Date(`${dates[0]}T12:00:00Z`))} – ${formatDay.format(new Date(`${dates[dates.length - 1]}T12:00:00Z`))}`;
    if (scrollToLatest) requestAnimationFrame(() => {
      elements.historyScroll.scrollLeft = elements.historyScroll.scrollWidth;
    });
  }

  function setHistoryZoom(nextZoom, anchorClientX = null) {
    const scroll = elements.historyScroll;
    const rect = scroll.getBoundingClientRect();
    const anchorOffset = anchorClientX == null
      ? scroll.clientWidth / 2
      : Math.min(Math.max(anchorClientX - rect.left, 0), scroll.clientWidth);
    const anchorRatio = scroll.scrollWidth
      ? (scroll.scrollLeft + anchorOffset) / scroll.scrollWidth
      : 1;
    state.historyZoom = Math.min(3, Math.max(0.4, nextZoom));
    renderHistoryChart({ scrollToLatest: false });
    requestAnimationFrame(() => {
      scroll.scrollLeft = anchorRatio * scroll.scrollWidth - anchorOffset;
    });
  }

  function renderViewShare() {
    elements.viewSharePeriod.textContent = periodLabel();
    const entries = COMPARISON_PLATFORMS.map((platform) => ({
      platform,
      views: platformData(platform).connected
        ? platformData(platform).reach
        : 0
    }));
    const totalViews = entries.reduce((sum, item) => sum + item.views, 0);
    elements.totalPlatformViews.textContent = compact(totalViews);
    elements.viewShareLegend.replaceChildren();

    let cursor = 0;
    const segments = entries.map((item) => {
      const share = totalViews ? item.views / totalViews * 100 : 0;
      const start = cursor;
      cursor += share;
      return `${PLATFORM_COLOURS[item.platform]} ${start}% ${cursor}%`;
    });
    elements.viewShareDonut.style.setProperty(
      "--view-share-gradient",
      totalViews
        ? `conic-gradient(${segments.join(",")})`
        : "conic-gradient(rgba(82, 62, 38, 0.15) 0 100%)"
    );

    entries.forEach((item) => {
      const share = totalViews ? item.views / totalViews * 100 : 0;
      const row = document.createElement("div");
      row.innerHTML = `
        <i style="background:${PLATFORM_COLOURS[item.platform]}"></i>
        <span>${PLATFORM_LABELS[item.platform]}</span>
        <strong>${compact(item.views)}</strong>
        <small>${percent(share)}</small>`;
      elements.viewShareLegend.append(row);
    });
  }

  function bestContent(platform, data) {
    return [...data.content].sort((a, b) => {
      const aValue = numberValue(a.views || a.reach) +
        numberValue(a.likes) * 3 + numberValue(a.comments) * 8 +
        numberValue(a.shares) * 10 + numberValue(a.saved) * 10;
      const bValue = numberValue(b.views || b.reach) +
        numberValue(b.likes) * 3 + numberValue(b.comments) * 8 +
        numberValue(b.shares) * 10 + numberValue(b.saved) * 10;
      return bValue - aValue;
    })[0];
  }

  function renderWeekdays() {
    const weekdayOrder = [
      "Monday", "Tuesday", "Wednesday", "Thursday",
      "Friday", "Saturday", "Sunday"
    ];
    const dayData = new Map(weekdayOrder.map((day) => [
      day,
      Object.fromEntries(COMPARISON_PLATFORMS.map((platform) => [platform, 0]))
    ]));

    COMPARISON_PLATFORMS.forEach((platform) => {
      const content = platform === "shorts"
        ? contentForPeriod("shorts")
        : platformData(platform).content;
      content.forEach((item) => {
        if (!item.publishedAt) return;
        const day = new Intl.DateTimeFormat("en-GB", { weekday: "long" })
          .format(new Date(item.publishedAt));
        const entry = dayData.get(day);
        if (entry) entry[platform] += numberValue(item.views || item.reach);
      });
    });

    const rows = [...dayData.entries()].map(([day, values]) => ({
      day,
      values,
      total: Object.values(values).reduce((sum, value) => sum + value, 0)
    })).sort((a, b) => b.total - a.total);
    const maximum = Math.max(...rows.map((row) => row.total), 1);
    elements.weekdayPerformance.replaceChildren();

    rows.forEach((row, index) => {
      const leader = Object.entries(row.values).sort((a, b) => b[1] - a[1])[0];
      const item = document.createElement("div");
      item.className = "weekday-row";
      const segments = COMPARISON_PLATFORMS
        .filter((platform) => row.values[platform] > 0)
        .map((platform) =>
          `<i style="width:${row.values[platform] / maximum * 100}%;background:${PLATFORM_COLOURS[platform]}"></i>`
        ).join("");
      item.innerHTML = `
        <span>${index === 0 && row.total ? "Best · " : ""}${row.day}</span>
        <div>${segments}</div>
        <strong>${compact(row.total)}</strong>
        <small>${row.total ? PLATFORM_LABELS[leader[0]] : "No posts"}</small>`;
      elements.weekdayPerformance.append(item);
    });
  }

  function normalizedBioRows() {
    if (!state.bio) return [];
    if (Array.isArray(state.bio)) return state.bio;
    if (Array.isArray(state.bio.rows)) return state.bio.rows;
    return [];
  }

  function renderBio() {
    const rows = normalizedBioRows();
    elements.bioEmpty.hidden = rows.length > 0;
    elements.bioList.replaceChildren();
    elements.bioDestinationTable.replaceChildren();
    if (!rows.length) {
      elements.bioViews.textContent = "-";
      elements.bioClicks.textContent = "-";
      elements.bioRate.textContent = "-";
      elements.bioTop.textContent = "-";
      return;
    }

    const totalsByPlatform = new Map();
    rows.forEach((row) => {
      const platform = row.platform;
      if (!totalsByPlatform.has(platform)) {
        totalsByPlatform.set(platform, { views: 0, clicks: 0, buttons: new Map() });
      }
      const entry = totalsByPlatform.get(platform);
      entry.views = Math.max(entry.views, numberValue(row.views));
      entry.clicks += numberValue(row.clicks);
      if (row.button_name) {
        entry.buttons.set(
          row.button_name,
          numberValue(entry.buttons.get(row.button_name)) + numberValue(row.clicks)
        );
      }
    });

    let totalViews = 0;
    let totalClicks = 0;
    const allButtons = new Map();
    totalsByPlatform.forEach((entry) => {
      totalViews += entry.views;
      totalClicks += entry.clicks;
      entry.buttons.forEach((clicks, button) => {
        allButtons.set(button, numberValue(allButtons.get(button)) + clicks);
      });
    });
    const topButton = [...allButtons.entries()].sort((a, b) => b[1] - a[1])[0];
    elements.bioViews.textContent = full(totalViews);
    elements.bioClicks.textContent = full(totalClicks);
    elements.bioRate.textContent = totalViews
      ? `${(totalClicks / totalViews).toFixed(2)}x`
      : "-";
    elements.bioTop.textContent = topButton?.[0] || "No clicks yet";

    const sourceOrder = ["instagram", "tiktok", "facebook", "youtube"];
    const destinationOrder = [
      "WhatsApp Community",
      "Next Gig Tickets",
      "SoundCloud",
      "Spotify",
      "Apple Music"
    ];
    const destinationHeader = document.createElement("div");
    destinationHeader.className = "bio-destination-row bio-destination-head";
    destinationHeader.innerHTML = `
      <span>Destination</span><span>Total clicks</span>
      ${sourceOrder.map((platform) => `<span>${PLATFORM_LABELS[platform]}</span>`).join("")}`;
    elements.bioDestinationTable.append(destinationHeader);

    destinationOrder.forEach((destination) => {
      const sourceClicks = sourceOrder.map((platform) =>
        numberValue(totalsByPlatform.get(platform)?.buttons.get(destination))
      );
      const destinationTotal = sourceClicks.reduce((sum, clicks) => sum + clicks, 0);
      const item = document.createElement("div");
      item.className = "bio-destination-row";
      item.innerHTML = `
        <strong>${destination}</strong>
        <b>${full(destinationTotal)}</b>
        ${sourceClicks.map((clicks) => `
          <span><strong>${full(clicks)}</strong><small>${
            destinationTotal ? percent(clicks / destinationTotal * 100, 0) : "0%"
          }</small></span>`
        ).join("")}`;
      elements.bioDestinationTable.append(item);
    });

    sourceOrder.forEach((platform) => {
      const entry = totalsByPlatform.get(platform) || { views: 0, clicks: 0, buttons: new Map() };
      const sourceShare = totalClicks ? entry.clicks / totalClicks * 100 : 0;
      const item = document.createElement("article");
      item.className = "bio-platform-row";
      item.innerHTML = `
        <div class="bio-platform-name"><i>${platformMark(platform)}</i><strong>${PLATFORM_LABELS[platform]}</strong></div>
        <div><span>Visits</span><strong>${full(entry.views)}</strong></div>
        <div><span>Clicks</span><strong>${full(entry.clicks)}</strong></div>
        <div><span>Click actions per visit</span><strong>${
          entry.views ? `${(entry.clicks / entry.views).toFixed(2)}x` : "-"
        }</strong></div>
        <div><span>Share of clicks</span><strong>${percent(sourceShare)}</strong></div>`;
      elements.bioList.append(item);
    });
  }

  function contentType(platform, item) {
    if (platform === "shorts") return "Short";
    if (platform === "youtube") return "Video";
    if (platform === "instagram" || platform === "instagram-direct") {
      const type = item.productType === "REELS" ? "Reel" : "Post";
      return item.accountUsername ? `${type} · @${item.accountUsername}` : type;
    }
    if (platform === "tiktok") return item.accountName ? `TikTok · ${item.accountName}` : "TikTok";
    return "Facebook post";
  }

  function contentUrl(platform, item) {
    if (platform === "youtube" || platform === "shorts") {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`;
    }
    if (platform === "tiktok") return item.shareUrl || "#";
    return item.permalink || "#";
  }

  function contentTitle(item) {
    return (item.title || item.caption || "Untitled content").split("\n")[0];
  }

  function contentPerformance(item) {
    return numberValue(item.views || item.reach) +
      numberValue(item.likes) * 3 +
      numberValue(item.comments) * 8 +
      numberValue(item.shares) * 10 +
      numberValue(item.saved) * 10;
  }

  function contentText(item) {
    return [
      item.title,
      item.caption,
      item.description,
      Array.isArray(item.tags) ? item.tags.join(" ") : ""
    ].filter(Boolean).join(" ");
  }

  function extractHashtags(text) {
    return [...String(text).toLowerCase().matchAll(/#[a-z0-9_]+/g)]
      .map((match) => match[0].slice(1));
  }

  function textTokens(text) {
    return String(text)
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\w#]+/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/^#/, ""))
      .filter((token) => token.length > 2);
  }

  function overlapScore(left, right) {
    const a = new Set(left);
    const b = new Set(right);
    if (!a.size || !b.size) return 0;
    const shared = [...a].filter((token) => b.has(token)).length;
    return shared / Math.max(a.size, b.size);
  }

  function sharedTokenCount(left, right) {
    const rightTokens = new Set(right);
    return [...new Set(left)].filter((token) => rightTokens.has(token)).length;
  }

  function creativeContentByPlatform() {
    return {
      tiktok: state.tiktok?.current?.videos || [],
      youtube: youtubeContent("shorts"),
      instagram: state.meta?.current?.media || [],
      "instagram-direct": state.instagramDirect?.current?.media || [],
      facebook: (state.meta?.current?.facebook?.posts || []).filter(isFacebookVideoPost)
    };
  }

  function comparableContent() {
    const byPlatform = creativeContentByPlatform();
    return CREATIVE_PLATFORMS.flatMap((platform) =>
      (byPlatform[platform] || [])
        .filter((item) => item.publishedAt)
        .map((item) => {
          const text = contentText(item);
          return {
            platform,
            item,
            id: `${platform}:${item.id}`,
            contentId: String(item.id || ""),
            publishedTime: new Date(item.publishedAt).getTime(),
            title: contentTitle(item),
            hashtags: extractHashtags(text),
            tokens: textTokens(text),
            duration: numberValue(item.durationSeconds),
            views: numberValue(item.views || item.reach),
            performance: contentPerformance(item)
          };
        })
    ).filter((entry) => Number.isFinite(entry.publishedTime));
  }

  function matchScore(a, b) {
    if (a.platform === b.platform) return null;
    const minutesApart = Math.abs(a.publishedTime - b.publishedTime) / 60000;
    if (minutesApart > 72 * 60) return null;

    let score = 0;
    const reasons = [];
    if (minutesApart <= 120) {
      score += 45;
      reasons.push("same upload window");
    } else if (minutesApart <= 8 * 60) {
      score += 36;
      reasons.push("same-day upload window");
    } else if (minutesApart <= 24 * 60) {
      score += 26;
      reasons.push("posted within 24 hours");
    } else {
      score += 12;
      reasons.push("posted within 3 days");
    }

    const hashtagOverlap = overlapScore(a.hashtags, b.hashtags);
    if (hashtagOverlap) {
      score += hashtagOverlap * 10;
      reasons.push("matching hashtags");
    }

    if (a.duration && b.duration) {
      const durationGap = Math.abs(a.duration - b.duration);
      if (durationGap <= 2) {
        score += 20;
        reasons.push("same duration");
      } else if (durationGap <= 6) {
        score += 12;
        reasons.push("similar duration");
      }
    }

    const tokenOverlap = overlapScore(a.tokens, b.tokens);
    if (tokenOverlap) {
      score += tokenOverlap * 16;
      reasons.push("similar title or caption");
    }
    if (minutesApart <= 8 * 60 && sharedTokenCount(a.tokens, b.tokens) >= 4) {
      score += 6;
      reasons.push("shared phrase");
    }

    return {
      score: Math.min(Math.round(score), 99),
      reasons: [...new Set(reasons)]
    };
  }

  function platformEntryMap(entries) {
    return entries.reduce((map, entry) => {
      if (!map[entry.platform] || entry.performance > map[entry.platform].performance) {
        map[entry.platform] = entry;
      }
      return map;
    }, {});
  }

  function groupIdForEntries(entries) {
    const earliest = [...entries].sort((a, b) => a.publishedTime - b.publishedTime)[0];
    return earliest?.id || `creative:${Date.now()}`;
  }

  function saveManualCreativeMatches() {
    localStorage.setItem(
      LOCAL_CREATIVE_MATCHES_KEY,
      JSON.stringify(state.manualCreativeMatches)
    );
  }

  function manualMergedGroupIds() {
    return Array.isArray(state.manualCreativeMatches.__mergedGroups)
      ? state.manualCreativeMatches.__mergedGroups
        .filter((groupIds) => Array.isArray(groupIds) && groupIds.length > 1)
        .map((groupIds) => [...new Set(groupIds.map(String))])
      : [];
  }

  function hasPlatformCollision(entries) {
    const platforms = entries.map((entry) => entry.platform);
    return new Set(platforms).size !== platforms.length;
  }

  function refreshCreativeGroup(group) {
    group.entries = group.entries.sort((a, b) => a.publishedTime - b.publishedTime);
    group.platforms = platformEntryMap(group.entries);
    group.totalViews = group.entries.reduce((sum, entry) => sum + entry.views, 0);
    group.latestTime = Math.max(...group.entries.map((entry) => entry.publishedTime));
    group.earliestTime = Math.min(...group.entries.map((entry) => entry.publishedTime));
    group.title = [...group.entries].sort((a, b) => b.performance - a.performance)[0]?.title || "Matched video";
    return group;
  }

  function applyManualGroupMerges(groups) {
    return manualMergedGroupIds().reduce((nextGroups, mergeIds) => {
      const mergeIdSet = new Set(mergeIds);
      const mergeGroups = nextGroups.filter((group) => mergeIdSet.has(group.id));
      if (mergeGroups.length < 2) return nextGroups;
      const entries = mergeGroups.flatMap((group) => group.entries);
      if (hasPlatformCollision(entries)) return nextGroups;

      const targetId = mergeIds.find((id) => nextGroups.some((group) => group.id === id)) || mergeGroups[0].id;
      const merged = {
        id: targetId,
        confidence: Math.max(...mergeGroups.map((group) => numberValue(group.confidence))),
        reasons: [...new Set([...mergeGroups.flatMap((group) => group.reasons), "manual merge"])],
        entries,
        platforms: {},
        manualPlatforms: new Set(mergeGroups.flatMap((group) => [...group.manualPlatforms])),
        totalViews: 0,
        latestTime: 0,
        earliestTime: 0,
        title: "Matched video"
      };

      return [
        ...nextGroups.filter((group) => !mergeIdSet.has(group.id)),
        refreshCreativeGroup(merged)
      ];
    }, groups);
  }

  function applyManualCreativeMatches(groups, entries) {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    groups.forEach((group) => {
      const manual = state.manualCreativeMatches[group.id] || {};
      Object.entries(manual).forEach(([platform, entryId]) => {
        const entry = byId.get(entryId);
        if (!entry || entry.platform !== platform) return;
        groups.forEach((candidate) => {
          if (candidate === group) return;
          candidate.entries = candidate.entries.filter((item) => item.id !== entry.id);
        });
        group.entries = group.entries.filter((item) => item.platform !== platform);
        group.entries.push(entry);
        group.manualPlatforms.add(platform);
      });
    });

    const matchedGroups = groups
      .filter((group) => group.entries.length)
      .map(refreshCreativeGroup);

    return applyManualGroupMerges(matchedGroups);
  }

  function creativeGroups() {
    const entries = comparableContent().sort((a, b) => b.publishedTime - a.publishedTime);
    const assigned = new Set();
    const groups = [];

    entries.forEach((seed) => {
      if (assigned.has(seed.id)) return;
      const matches = [seed];
      const matchNotes = [];
      const candidates = entries
        .filter((candidate) => !assigned.has(candidate.id) && candidate.id !== seed.id)
        .map((candidate) => ({ candidate, match: matchScore(seed, candidate) }))
        .filter(({ match }) => match && match.score >= 48)
        .sort((a, b) => b.match.score - a.match.score);

      CREATIVE_PLATFORMS.forEach((platform) => {
        if (platform === seed.platform) return;
        const best = candidates.find(({ candidate }) => candidate.platform === platform);
        if (!best) return;
        matches.push(best.candidate);
        matchNotes.push(best.match);
      });

      if (matches.length < 2) return;
      matches.forEach((entry) => assigned.add(entry.id));
      const entriesByTime = [...matches].sort((a, b) => a.publishedTime - b.publishedTime);
      const strongestEntry = [...matches].sort((a, b) => b.performance - a.performance)[0];
      const confidence = Math.round(
        matchNotes.reduce((sum, note) => sum + note.score, 0) / Math.max(matchNotes.length, 1)
      );
      groups.push({
        id: groupIdForEntries(entriesByTime),
        confidence,
        reasons: [...new Set(matchNotes.flatMap((note) => note.reasons))],
        entries: entriesByTime,
        platforms: platformEntryMap(entriesByTime),
        manualPlatforms: new Set(),
        totalViews: matches.reduce((sum, entry) =>
          sum + entry.views, 0
        ),
        latestTime: Math.max(...matches.map((entry) => entry.publishedTime)),
        earliestTime: Math.min(...matches.map((entry) => entry.publishedTime)),
        title: strongestEntry?.title || "Matched video"
      });
    });

    entries.forEach((entry) => {
      if (assigned.has(entry.id)) return;
      groups.push({
        id: entry.id,
        confidence: 0,
        reasons: ["single-platform upload"],
        entries: [entry],
        platforms: { [entry.platform]: entry },
        manualPlatforms: new Set(),
        totalViews: entry.views,
        latestTime: entry.publishedTime,
        earliestTime: entry.publishedTime,
        title: entry.title
      });
    });

    return applyManualCreativeMatches(groups, entries);
  }

  function creativeMatchUrl(platform, item) {
    return contentUrl(platform === "youtube" ? "youtube" : platform, item);
  }

  function creativePlatformLabel(platform) {
    if (platform === "youtube") return "YouTube Shorts";
    return PLATFORM_LABELS[platform] || platformMark(platform);
  }

  function platformCell(group, platform) {
    const entry = group.platforms[platform];
    if (!entry) {
      return `
        <button class="creative-platform-missing" data-creative-search="${group.id}" data-platform="${platform}" type="button">
          <b>${platformMark(platform)}</b>
          <span>Find match</span>
        </button>`;
    }
    const engagement = entry.views
      ? (numberValue(entry.item.likes) + numberValue(entry.item.comments) +
        numberValue(entry.item.shares) + numberValue(entry.item.saved)) / entry.views * 100
      : 0;
    return `
      <a class="${group.manualPlatforms.has(platform) ? "manual" : ""}" href="${creativeMatchUrl(platform, entry.item)}" target="_blank" rel="noreferrer">
        <b>${platformMark(platform)}</b>
        <strong>${compact(entry.views)}</strong>
        <small>${percent(engagement)} interaction</small>
      </a>`;
  }

  function renderCreativeCard(group, rank = null) {
    const topEntry = group.entries.find((entry) => entry.item.thumbnail) || group.entries[0];
    const date = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(group.earliestTime));
    const card = document.createElement("article");
    card.className = `creative-match-card ${state.selectedCreativeGroups.has(group.id) ? "selected" : ""}`;
    card.dataset.creativeId = group.id;
    card.innerHTML = `
      <label class="creative-select-control" title="Select this video group to merge it">
        <input type="checkbox" data-creative-select="${group.id}" ${state.selectedCreativeGroups.has(group.id) ? "checked" : ""}>
        <span>Select to merge</span>
      </label>
      <img src="${topEntry.item.thumbnail || ""}" alt="">
      <div class="creative-match-copy">
        <span>${rank ? `#${rank} performer · ` : ""}${group.confidence ? `${group.confidence}% likely match · ` : ""}${date}</span>
        <strong>${group.title.slice(0, 92)}</strong>
        <p>${group.reasons.slice(0, 3).join(", ")}</p>
        <div class="creative-platform-strip">
          ${CREATIVE_PLATFORMS.map((platform) => platformCell(group, platform)).join("")}
        </div>
      </div>
      <div class="creative-match-total">
        <span>Total views</span>
        <strong>${compact(group.totalViews)}</strong>
      </div>`;
    return card;
  }

  function availableCreativeEntries(platform, groups) {
    const available = groups
      .flatMap((group) => group.entries.map((entry) => ({ ...entry, groupId: group.id })));
    return available
      .filter((entry) =>
        entry.platform === platform &&
        entry.groupId !== state.creativeSearch?.groupId
      )
      .sort((a, b) => b.publishedTime - a.publishedTime);
  }

  function renderCreativeSearch(groups) {
    const search = state.creativeSearch;
    elements.creativeSearchPanel.hidden = !search;
    elements.creativeSearchPanel.replaceChildren();
    document.body.classList.toggle("creative-modal-open", Boolean(search));
    if (!search) return;

    const group = groups.find((item) => item.id === search.groupId) || {
      id: search.groupId,
      title: "this video"
    };
    const options = availableCreativeEntries(search.platform, groups);
    const title = document.createElement("div");
    const dialog = document.createElement("div");
    dialog.className = "creative-search-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `${creativePlatformLabel(search.platform)} available videos`);
    const heading = document.createElement("div");
    heading.className = "creative-search-heading";
    heading.innerHTML = `
      <div>
        <span>Manual match</span>
        <strong>${creativePlatformLabel(search.platform)} available videos</strong>
        <p>Choose the upload that belongs with "${group.title.slice(0, 78)}". Choosing one already linked elsewhere moves it here.</p>
      </div>
      <button class="small-button" data-creative-search-close type="button">Close</button>`;
    dialog.append(heading);

    if (!options.length) {
      const empty = document.createElement("p");
      empty.className = "creative-search-empty";
      empty.textContent = "No videos are available for this platform.";
      dialog.append(empty);
      elements.creativeSearchPanel.append(dialog);
      return;
    }

    const list = document.createElement("div");
    list.className = "creative-search-results";

    options.slice(0, 30).forEach((entry) => {
      const row = document.createElement("button");
      row.className = "creative-search-option";
      row.type = "button";
      row.dataset.creativeManualGroup = group.id;
      row.dataset.creativeManualPlatform = search.platform;
      row.dataset.creativeManualEntry = entry.id;
      row.innerHTML = `
        <img src="${entry.item.thumbnail || ""}" alt="">
        <span>
          <strong>${entry.title.slice(0, 88)}</strong>
          <small>${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.publishedTime))}</small>
        </span>
        <b>${compact(entry.views)}</b>`;
      list.append(row);
    });
    dialog.append(list);
    elements.creativeSearchPanel.append(dialog);
  }

  function renderCreativeMatches() {
    const groups = creativeGroups();
    const matchedGroups = groups.filter((group) =>
      group.entries.length > 1 && creativePeriodIncludes(group)
    );
    const visibleGroupIds = new Set(matchedGroups.map((group) => group.id));
    state.selectedCreativeGroups = new Set(
      [...state.selectedCreativeGroups].filter((groupId) => visibleGroupIds.has(groupId))
    );
    const topGroups = [...matchedGroups].sort((a, b) => b.totalViews - a.totalViews).slice(0, 3);
    const topIds = new Set(topGroups.map((group) => group.id));
    const recentGroups = [...matchedGroups]
      .filter((group) => !topIds.has(group.id))
      .sort((a, b) => b.latestTime - a.latestTime);
    const recentVisible = recentGroups.slice(0, state.creativeVisibleCount);

    elements.creativeTopMatches.replaceChildren();
    elements.creativeMatches.replaceChildren();
    elements.creativeEmpty.hidden = matchedGroups.length > 0;
    elements.creativeTopPeriod.textContent = selectedCreativePeriod().label;
    elements.creativeRecentPeriod.textContent = `Newest first, ${selectedCreativePeriod().suffix}`;
    elements.creativeSummary.textContent = matchedGroups.length
      ? `${matchedGroups.length} matched ${matchedGroups.length === 1 ? "video" : "videos"} ${selectedCreativePeriod().suffix}`
      : "Awaiting matches";

    topGroups.forEach((group, index) =>
      elements.creativeTopMatches.append(renderCreativeCard(group, index + 1))
    );
    recentVisible.forEach((group) =>
      elements.creativeMatches.append(renderCreativeCard(group))
    );
    elements.creativeShowMore.hidden = recentGroups.length <= state.creativeVisibleCount;
    renderCreativeMergeControls();
    renderCreativeSearch(groups);
  }

  function renderCreativeMergeControls(message = "") {
    const selectedCount = state.selectedCreativeGroups.size;
    elements.creativeMergeBar.hidden = selectedCount === 0;
    elements.mergeCreative.disabled = selectedCount < 2;
    elements.creativeSelectionSummary.dataset.state = message ? "error" : "";
    elements.creativeSelectionSummary.textContent = message ||
      `${selectedCount} ${selectedCount === 1 ? "video" : "videos"} selected`;
  }

  function mergeSelectedCreativeGroups() {
    if (state.selectedCreativeGroups.size < 2) return;
    const selectedIds = [...state.selectedCreativeGroups];
    const selectedIdSet = new Set(selectedIds);
    const groups = creativeGroups().filter((group) => selectedIdSet.has(group.id));
    if (groups.length < 2) return;
    const entries = groups.flatMap((group) => group.entries);
    if (hasPlatformCollision(entries)) {
      renderCreativeMergeControls("Can't merge groups with the same platform twice");
      return;
    }

    const mergedGroups = manualMergedGroupIds();
    const mergedSet = new Set(selectedIds);
    const remainingGroups = [];
    mergedGroups.forEach((groupIds) => {
      if (groupIds.some((groupId) => selectedIdSet.has(groupId))) {
        groupIds.forEach((groupId) => mergedSet.add(groupId));
      } else {
        remainingGroups.push(groupIds);
      }
    });
    state.manualCreativeMatches.__mergedGroups = [
      ...remainingGroups,
      [...mergedSet]
    ];
    state.selectedCreativeGroups = new Set();
    saveManualCreativeMatches();
    renderCreativeMatches();
  }

  function renderContent(platform, data) {
    elements.content.replaceChildren();
    const content = [...data.content].sort((a, b) =>
      contentPerformance(b) - contentPerformance(a)
    );
    elements.drillEmpty.hidden = content.length > 0;
    if (!content.length) {
      elements.drillEmpty.innerHTML = platform === "tiktok" && !data.connected
        ? "<strong>TikTok is coming soon</strong><p>The drill-down is ready and will populate when the developer connection is complete.</p>"
        : "<strong>No content returned</strong><p>Refresh the platform after new content is published.</p>";
      return;
    }

    const maximum = Math.max(...content.map(contentPerformance), 1);
    content.forEach((item, index) => {
      const card = document.createElement("a");
      card.className = "drilldown-content-row";
      card.href = contentUrl(platform, item);
      card.target = "_blank";
      card.rel = "noreferrer";
      const views = numberValue(item.views || item.reach);
      const engagement = views
        ? (numberValue(item.likes) + numberValue(item.comments) +
          numberValue(item.shares) + numberValue(item.saved)) / views * 100
        : 0;
      card.innerHTML = `
        <span class="content-rank">${String(index + 1).padStart(2, "0")}</span>
        <img src="${item.thumbnail || ""}" alt="">
        <div class="content-row-copy">
          <small>${contentType(platform, item)}</small>
          <strong>${contentTitle(item).slice(0, 125)}</strong>
          <p>${item.publishedAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.publishedAt)) : "Date unavailable"}</p>
        </div>
        <div class="content-row-metrics">
          <span><strong>${compact(views)}</strong>${item.views ? "views" : "reached"}</span>
          <span><strong>${compact(item.likes)}</strong>${platform === "facebook" ? "reactions" : "likes"}</span>
          <span><strong>${percent(engagement)}</strong>interaction rate</span>
        </div>
        <i class="content-performance-line"><b style="width:${Math.max(contentPerformance(item) / maximum * 100, 2)}%"></b></i>`;
      elements.content.append(card);
    });
  }

  function insightCards(platform, data) {
    const content = data.content || [];
    const top = bestContent(platform, data);
    const typeGroups = new Map();
    content.forEach((item) => {
      const type = contentType(platform, item);
      if (!typeGroups.has(type)) typeGroups.set(type, []);
      typeGroups.get(type).push(item);
    });
    const bestType = [...typeGroups.entries()]
      .map(([type, items]) => ({
        type,
        average: items.length
          ? items.reduce((sum, item) => sum + contentPerformance(item), 0) / items.length
          : 0
      }))
      .sort((a, b) => b.average - a.average)[0];

    const dated = content.filter((item) => item.publishedAt);
    const days = new Map();
    dated.forEach((item) => {
      const day = new Intl.DateTimeFormat("en-GB", { weekday: "long" })
        .format(new Date(item.publishedAt));
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(item);
    });
    const bestDay = [...days.entries()]
      .map(([day, items]) => ({
        day,
        average: items.reduce((sum, item) => sum + contentPerformance(item), 0) / items.length
      }))
      .sort((a, b) => b.average - a.average)[0];

    if (platform === "tiktok" && !data.connected) {
      return [
        ["Connection", "Coming soon", "The interface is ready for TikTok's video, audience and engagement data."],
        ["Planned signal", "Retention first", "The drill-down will prioritise watch time and completion over raw views."],
        ["Cross-platform", "Compare short-form", "TikTok will sit beside Reels and Shorts for like-for-like creative testing."]
      ];
    }

    return [
      [
        "Strongest content",
        top ? contentTitle(top).slice(0, 52) : "Building signal",
        top
          ? `${compact(top.views || top.reach)} ${top.views ? "views" : "reached"} with ${compact(top.comments)} comments.`
          : "More content is needed before a pattern can be called."
      ],
      [
        "Best format",
        bestType?.type || "Not enough data",
        bestType
          ? `${bestType.type} currently produces the strongest average performance signal.`
          : "Format comparison begins after multiple content types are measured."
      ],
      [
        "Publishing pattern",
        bestDay?.day || "Not enough data",
        bestDay
          ? `${bestDay.day} has the strongest average among the recent posts available. Treat this as a test, not a rule.`
          : "Posting-day guidance appears after enough dated content is available."
      ]
    ];
  }

  function renderDrilldown(platform) {
    const data = platformData(platform);
    elements.eyebrow.textContent = "Platform intelligence";
    elements.title.textContent = data.identityLabel || PLATFORM_LABELS[platform];
    elements.description.textContent = {
      youtube: "Long-form video performance, audience growth and the subjects worth developing.",
      shorts: "Short-form video performance, engagement and the creative ideas worth repeating.",
      instagram: "Reels, posts and the signals converting reach into a returning audience.",
      "instagram-direct": "The separately connected Instagram account, tracked without mixing its audience or content into Ella's original account.",
      facebook: "Page growth, post response and Ella's community activity on Facebook.",
      tiktok: "Short-form video performance, engagement and the creative ideas worth repeating."
    }[platform];
    elements.updated.textContent = data.checkedAt
      ? `Updated ${formatDate(data.checkedAt)}`
      : data.comingSoon ? "Coming soon" : "Awaiting data";

    elements.drillHero.className = `drilldown-hero platform-${platform}`;
    elements.drillHero.innerHTML = `
      <div class="drilldown-platform-mark">${platformMark(platform)}</div>
      <div>
        <span>${data.comingSoon ? "Connection prepared" : data.connected ? "Live platform" : "Not connected"}</span>
        <strong>${data.connected ? compact(data.audience) : "-"}</strong>
        <p>${data.accountCount > 1 ? `${data.accountCount} connected accounts` : data.audienceLabel}</p>
      </div>
      <div class="drilldown-hero-signal">
        <span>Current signal</span>
        <strong>${data.comingSoon ? "Coming Soon" : data.connected ? `${compact(data.reach)} ${data.reachLabel}` : "Data unavailable"}</strong>
        <p>${data.comingSoon ? "No invented data. This will activate when TikTok is connected." : metricDelta(data.audienceDelta, data.audienceLabel)}</p>
      </div>`;

    const metrics = [
      [data.audienceLabel, data.connected ? compact(data.audience) : "-", metricDelta(data.audienceDelta, data.audienceLabel)],
      [data.reachLabel, data.connected ? compact(data.reach) : "-", data.reachDelta == null ? "Current measured period" : metricDelta(data.reachDelta, "reach")],
      [data.outputLabel, data.connected ? full(data.output) : "-", "Current content set"],
      ["Interaction rate", data.connected ? percent(data.engagement) : "-", "Likes, comments, saves and shares"]
    ];
    elements.drillMetrics.innerHTML = metrics.map(([label, value, note]) =>
      `<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`
    ).join("");

    elements.drillInsights.innerHTML = insightCards(platform, data)
      .map(([label, title, copy]) =>
        `<article class="social-premium-panel"><span>${label}</span><strong>${title}</strong><p>${copy}</p></article>`
      ).join("");
    elements.contentEyebrow.textContent = "Content performance";
    elements.contentTitle.textContent = platform === "instagram" || platform === "instagram-direct"
        ? `Posts and Reels, ${periodSuffix()}`
        : platform === "facebook"
          ? `Facebook, ${periodSuffix()}`
          : platform === "tiktok"
            ? "TikTok content"
            : platform === "shorts"
              ? `YouTube Shorts, ${periodSuffix()}`
              : "Recent long-form videos";
    elements.contentSummary.textContent = data.connected
      ? `${data.content.length} items measured`
      : data.comingSoon ? "Coming soon" : "Awaiting data";
    renderContent(platform, data);
  }

  function openDrilldown(platform) {
    state.activePlatform = platform;
    elements.overview.hidden = true;
    elements.drilldown.hidden = false;
    renderDrilldown(platform);
    history.replaceState(null, "", `#${platform}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeDrilldown() {
    state.activePlatform = null;
    elements.overview.hidden = false;
    elements.drilldown.hidden = true;
    elements.eyebrow.textContent = "Audience intelligence";
    elements.title.textContent = "Growth overview";
    elements.description.textContent =
      "A clear view of what is building Ella's audience, and what to do next.";
    renderOverview();
    history.replaceState(null, "", location.pathname);
  }

  function renderOverview() {
    renderPlatformCards();
    renderHistoryChart();
    renderViewShare();
    renderWeekdays();
    renderCreativeMatches();
    renderBio();
    const dates = [
      state.youtube?.current?.checkedAt,
      state.meta?.current?.checkedAt,
      state.instagramDirect?.current?.checkedAt,
      state.tiktok?.current?.checkedAt
    ].filter(Boolean).sort();
    elements.updated.textContent = dates.length
      ? `Latest data ${formatDate(dates[dates.length - 1])}`
      : "Awaiting first refresh";
  }

  async function ensureSupabase() {
    if (state.supabase) return state.supabase;
    if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-social-supabase]");
        if (existing) {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.dataset.socialSupabase = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    state.supabase = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
    return state.supabase;
  }

  async function loadCloudSnapshots() {
    const client = await ensureSupabase();
    if (!client) return;
    const { data, error } = await client.rpc("get_social_snapshots", { p_days: 400 });
    if (error) return;
    const youtubeRows = (data || []).filter((row) => row.platform === "youtube");
    const metaRows = (data || []).filter((row) => row.platform === "meta");
    const instagramDirectRows = (data || []).filter(
      (row) => row.platform === "instagram_direct"
    );
    const tiktokRows = (data || []).filter((row) => row.platform === "tiktok");
    if (youtubeRows.length) {
      const current = youtubeRows[youtubeRows.length - 1].payload;
      state.youtube = {
        current,
        previous: youtubeRows.length > 1 ? youtubeRows[youtubeRows.length - 2].payload : null,
        history: youtubeRows.map((row) => row.payload)
      };
    }
    if (metaRows.length) {
      const current = metaRows[metaRows.length - 1].payload;
      state.meta = {
        current,
        previous: metaRows.length > 1 ? metaRows[metaRows.length - 2].payload : null,
        history: metaRows.map((row) => row.payload)
      };
    }
    if (instagramDirectRows.length) {
      const current = instagramDirectRows[instagramDirectRows.length - 1].payload;
      state.instagramDirect = {
        current,
        previous: instagramDirectRows.length > 1
          ? instagramDirectRows[instagramDirectRows.length - 2].payload
          : null,
        history: instagramDirectRows.map((row) => row.payload)
      };
    }
    if (tiktokRows.length) {
      const current = tiktokRows[tiktokRows.length - 1].payload;
      state.tiktok = {
        current,
        previous: tiktokRows.length > 1
          ? tiktokRows[tiktokRows.length - 2].payload
          : null,
        history: tiktokRows.map((row) => row.payload)
      };
    }
  }

  async function loadBio() {
    const client = await ensureSupabase();
    if (!client) return;
    const days = (BIO_PERIODS[state.bioPeriod] || BIO_PERIODS["30"]).days;
    const { data, error } = await client.rpc("get_bio_link_summary", { p_days: days });
    if (!error) state.bio = data;
  }

  async function fetchSnapshot(url, label) {
    if (!url) throw new Error(`${label} is not configured.`);
    const endpoint = new URL(url);
    endpoint.searchParams.set("refresh", String(Date.now()));
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload?.ok || !payload.snapshot) {
      throw new Error(payload?.error || `${label} data is unavailable.`);
    }
    return payload.snapshot;
  }

  function setMessage(text, stateName = "") {
    elements.message.textContent = text;
    elements.message.dataset.state = stateName;
  }

  async function refreshAll() {
    if (state.refreshing) return;
    state.refreshing = true;
    elements.refresh.disabled = true;
    elements.refresh.textContent = "Refreshing";
    setMessage("Fetching YouTube, Instagram, Facebook and TikTok...", "loading");
    const results = await Promise.allSettled([
      fetchSnapshot(config.youtubeStatsUrl, "YouTube"),
      fetchSnapshot(config.instagramStatsUrl, "Instagram and Facebook"),
      fetchSnapshot(config.instagramDirectStatsUrl, "Instagram Direct"),
      fetchSnapshot(config.tiktokStatsUrl, "TikTok")
    ]);
    const errors = [];

    if (results[0].status === "fulfilled") {
      const current = results[0].value;
      state.youtube = {
        current,
        previous: state.youtube?.current || null,
        history: appendHistory(state.youtube?.history, current)
      };
      localStorage.setItem(LOCAL_YOUTUBE_KEY, JSON.stringify(state.youtube));
    } else {
      errors.push(results[0].reason?.message || "YouTube failed");
    }
    if (results[1].status === "fulfilled") {
      const current = results[1].value;
      state.meta = {
        current,
        previous: state.meta?.current || null,
        history: appendHistory(state.meta?.history, current)
      };
      localStorage.setItem(LOCAL_META_KEY, JSON.stringify(state.meta));
    } else {
      errors.push(results[1].reason?.message || "Instagram and Facebook failed");
    }
    if (results[2].status === "fulfilled") {
      const current = results[2].value;
      state.instagramDirect = {
        current,
        previous: state.instagramDirect?.current || null,
        history: appendHistory(state.instagramDirect?.history, current)
      };
      localStorage.setItem(
        LOCAL_INSTAGRAM_DIRECT_KEY,
        JSON.stringify(state.instagramDirect)
      );
    } else if (!String(results[2].reason?.message || "").includes("not been authorised")) {
      errors.push(results[2].reason?.message || "Instagram Direct failed");
    }
    if (results[3].status === "fulfilled") {
      const current = results[3].value;
      state.tiktok = {
        current,
        previous: state.tiktok?.current || null,
        history: appendHistory(state.tiktok?.history, current)
      };
      localStorage.setItem(LOCAL_TIKTOK_KEY, JSON.stringify(state.tiktok));
    } else {
      errors.push(results[3].reason?.message || "TikTok failed");
    }
    await loadBio();
    if (state.activePlatform) renderDrilldown(state.activePlatform);
    else renderOverview();
    setMessage(
      errors.length
        ? `Updated what was available. ${errors.join(" ")}`
        : "All connected platforms are up to date.",
      errors.length ? "error" : "success"
    );
    state.refreshing = false;
    elements.refresh.disabled = false;
    elements.refresh.textContent = "Refresh all";
  }

  async function setSocialPeriod(nextPeriod) {
    if (!SOCIAL_PERIODS[nextPeriod] || state.socialPeriod === nextPeriod) return;
    state.socialPeriod = nextPeriod;
    syncPeriodButtons();
    if (state.activePlatform) renderDrilldown(state.activePlatform);
    else renderOverview();
  }

  async function setBioPeriod(nextPeriod) {
    if (!BIO_PERIODS[nextPeriod] || state.bioPeriod === nextPeriod) return;
    state.bioPeriod = nextPeriod;
    syncPeriodButtons();
    await loadBio();
    renderBio();
  }

  function setCreativePeriod(nextPeriod) {
    if (!CREATIVE_PERIODS[nextPeriod] || state.creativePeriod === nextPeriod) return;
    state.creativePeriod = nextPeriod;
    state.creativeVisibleCount = 5;
    state.creativeSearch = null;
    state.selectedCreativeGroups = new Set();
    syncPeriodButtons();
    renderCreativeMatches();
  }

  elements.refresh.addEventListener("click", refreshAll);
  elements.historyZoom.addEventListener("input", () => {
    setHistoryZoom(numberValue(elements.historyZoom.value) / 100);
  });
  elements.historyZoomOut.addEventListener("click", () => {
    setHistoryZoom(state.historyZoom - 0.2);
  });
  elements.historyZoomIn.addEventListener("click", () => {
    setHistoryZoom(state.historyZoom + 0.2);
  });
  elements.historyScroll.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setHistoryZoom(state.historyZoom * Math.exp(-event.deltaY * 0.012), event.clientX);
  }, { passive: false });
  document.querySelectorAll("[data-social-period]").forEach((button) => {
    button.addEventListener("click", () => setSocialPeriod(button.dataset.socialPeriod || "30"));
  });
  document.querySelectorAll("[data-creative-period]").forEach((button) => {
    button.addEventListener("click", () => setCreativePeriod(button.dataset.creativePeriod || "all"));
  });
  elements.back.addEventListener("click", closeDrilldown);
  elements.creativeShowMore.addEventListener("click", () => {
    state.creativeVisibleCount += 5;
    renderCreativeMatches();
  });
  elements.mergeCreative.addEventListener("click", mergeSelectedCreativeGroups);
  elements.clearCreativeSelection.addEventListener("click", () => {
    state.selectedCreativeGroups = new Set();
    renderCreativeMatches();
  });
  elements.overview.addEventListener("click", (event) => {
    const searchButton = event.target.closest("[data-creative-search]");
    if (searchButton) {
      state.creativeSearch = {
        groupId: searchButton.dataset.creativeSearch,
        platform: searchButton.dataset.platform
      };
      renderCreativeMatches();
      return;
    }

  });
  elements.overview.addEventListener("change", (event) => {
    const historyCheckbox = event.target.closest("[data-history-platform]");
    if (historyCheckbox) {
      if (historyCheckbox.checked) state.historyPlatforms.add(historyCheckbox.dataset.historyPlatform);
      else state.historyPlatforms.delete(historyCheckbox.dataset.historyPlatform);
      renderHistoryChart();
      return;
    }
    const checkbox = event.target.closest("[data-creative-select]");
    if (!checkbox) return;
    if (checkbox.checked) state.selectedCreativeGroups.add(checkbox.dataset.creativeSelect);
    else state.selectedCreativeGroups.delete(checkbox.dataset.creativeSelect);
    renderCreativeMatches();
  });
  elements.creativeSearchPanel.addEventListener("click", (event) => {
    if (event.target.closest("[data-creative-search-close]") ||
      event.target === elements.creativeSearchPanel) {
      state.creativeSearch = null;
      renderCreativeMatches();
      return;
    }

    const manualButton = event.target.closest("[data-creative-manual-entry]");
    if (!manualButton) return;
    const groupId = manualButton.dataset.creativeManualGroup;
    const platform = manualButton.dataset.creativeManualPlatform;
    const entryId = manualButton.dataset.creativeManualEntry;
    if (!groupId || !platform || !entryId) return;
    Object.entries(state.manualCreativeMatches).forEach(([savedGroupId, matches]) => {
      if (savedGroupId === groupId || savedGroupId === "__mergedGroups" ||
        !matches || typeof matches !== "object" || Array.isArray(matches) ||
        matches[platform] !== entryId) return;
      delete matches[platform];
      if (!Object.keys(matches).length) delete state.manualCreativeMatches[savedGroupId];
    });
    state.manualCreativeMatches[groupId] = {
      ...(state.manualCreativeMatches[groupId] || {}),
      [platform]: entryId
    };
    state.creativeSearch = null;
    saveManualCreativeMatches();
    renderCreativeMatches();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.creativeSearch) return;
    state.creativeSearch = null;
    renderCreativeMatches();
  });
  window.addEventListener("ella-cloud-data-updated", (event) => {
    const keys = event.detail?.keys || [];
    if (keys.includes(LOCAL_CREATIVE_MATCHES_KEY)) {
      state.manualCreativeMatches = readJson(LOCAL_CREATIVE_MATCHES_KEY) || {};
      renderCreativeMatches();
    }
    if (keys.includes(LOCAL_TIKTOK_KEY)) {
      state.tiktok = readJson(LOCAL_TIKTOK_KEY);
      if (state.activePlatform === "tiktok") renderDrilldown("tiktok");
      else renderOverview();
    }
  });
  document.querySelectorAll("[data-bio-period]").forEach((button) => {
    button.addEventListener("click", () => setBioPeriod(button.dataset.bioPeriod || "30"));
  });

  async function initialise() {
    syncPeriodButtons();
    renderOverview();
    await Promise.allSettled([loadCloudSnapshots(), loadBio()]);
    const requestedPlatform = location.hash.slice(1);
    if (PLATFORM_ORDER.includes(requestedPlatform)) openDrilldown(requestedPlatform);
    else renderOverview();

    const newest = Math.max(
      new Date(state.youtube?.current?.checkedAt || 0).getTime(),
      new Date(state.meta?.current?.checkedAt || 0).getTime(),
      new Date(state.instagramDirect?.current?.checkedAt || 0).getTime(),
      new Date(state.tiktok?.current?.checkedAt || 0).getTime()
    );
    if (!newest || Date.now() - newest > 12 * 60 * 60 * 1000) refreshAll();
  }

  initialise();
})();
