(function () {
  const config = window.ELLA_CLOUD_CONFIG || {};
  const LOCAL_YOUTUBE_KEY = "ella-crow-social-youtube-v1";
  const LOCAL_META_KEY = "ella-crow-social-instagram-v1";
  const PLATFORM_ORDER = ["youtube", "shorts", "instagram", "facebook", "tiktok"];
  const PLATFORM_LABELS = {
    youtube: "YouTube",
    shorts: "YouTube Shorts",
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok"
  };
  const state = {
    youtube: readJson(LOCAL_YOUTUBE_KEY),
    meta: readJson(LOCAL_META_KEY),
    bio: null,
    bioPeriod: "month",
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
    cards: document.querySelector("#platformOverviewCards"),
    momentumStatus: document.querySelector("#momentumStatus"),
    momentumHeadline: document.querySelector("#momentumHeadline"),
    momentumCopy: document.querySelector("#momentumCopy"),
    momentumBars: document.querySelector("#momentumBars"),
    actions: document.querySelector("#growthActions"),
    bioViews: document.querySelector("#bioTotalViews"),
    bioClicks: document.querySelector("#bioTotalClicks"),
    bioRate: document.querySelector("#bioClickRate"),
    bioTop: document.querySelector("#bioTopButton"),
    bioList: document.querySelector("#bioPlatformList"),
    bioEmpty: document.querySelector("#bioEmptyState"),
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

  function youtubeContent(platform) {
    const videos = state.youtube?.current?.videos || [];
    if (platform === "shorts") {
      return videos.filter((video) =>
        isShort(video) && (!video.publishedAt || sameMonth(video.publishedAt))
      );
    }
    return videos.filter((video) => !isShort(video));
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
      const content = youtubeContent(platform);
      const total = totals(content);
      const rates = engagementRates(content);
      const base = baseline(state.youtube, platform);
      const baseContent = (base?.videos || []).filter((video) =>
        platform === "shorts" ? isShort(video) : !isShort(video)
      );
      const baseViews = totals(baseContent).views;
      return {
        connected: Boolean(current),
        audience: numberValue(current?.channel?.subscribers),
        audienceLabel: "subscribers",
        reach: total.views,
        reachLabel: platform === "shorts" ? "Shorts views" : "video views",
        output: content.length,
        outputLabel: platform === "shorts" ? "Shorts this month" : "recent videos",
        engagement: rates.engagement,
        likes: rates.likes,
        comments: rates.comments,
        audienceDelta: base
          ? numberValue(current?.channel?.subscribers) - numberValue(base.channel?.subscribers)
          : null,
        reachDelta: base ? total.views - baseViews : null,
        content,
        checkedAt: current?.checkedAt
      };
    }

    if (platform === "instagram") {
      const current = state.meta?.current;
      const media = current?.media || [];
      const measuredReach = totals(media, "reach").views;
      const rates = engagementRates(media, "reach");
      const base = baseline(state.meta, platform);
      return {
        connected: Boolean(current?.account),
        audience: numberValue(current?.account?.followers),
        audienceLabel: "followers",
        reach: numberValue(current?.month?.reach) || measuredReach,
        reachLabel: "accounts reached",
        output: numberValue(current?.month?.posts),
        outputLabel: "posts and Reels",
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
      const posts = facebook?.posts || [];
      const rates = engagementRates(posts);
      const base = baseline(state.meta, platform);
      return {
        connected: Boolean(facebook?.page),
        audience: numberValue(facebook?.page?.followers),
        audienceLabel: "page followers",
        reach: numberValue(facebook?.month?.views) || totals(posts).views,
        reachLabel: "content views",
        output: numberValue(facebook?.month?.posts),
        outputLabel: "posts this month",
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

    return {
      connected: false,
      comingSoon: true,
      audience: 0,
      audienceLabel: "followers",
      reach: 0,
      reachLabel: "video views",
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
      shorts: "S",
      instagram: "IG",
      facebook: "FB",
      tiktok: "TT"
    }[platform];
  }

  function metricDelta(value, noun) {
    if (value == null) return "Baseline building";
    if (value === 0) return `No ${noun} change yet`;
    return `${value > 0 ? "+" : ""}${full(value)} this month`;
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
        <strong>${PLATFORM_LABELS[platform]}</strong>
        <span class="platform-card-number">${data.connected ? compact(data.audience) : "-"}</span>
        <small>${data.audienceLabel}</small>
        <span class="platform-card-signal">${
          data.comingSoon
            ? "API connection prepared"
            : data.connected
              ? `${compact(data.reach)} ${data.reachLabel}`
              : "Data unavailable"
        }</span>
        <b>Open insight &rarr;</b>`;
      card.addEventListener("click", () => openDrilldown(platform));
      elements.cards.append(card);
    });
  }

  function momentumScore(data) {
    if (!data.connected) return 0;
    const audienceSignal = data.audienceDelta == null
      ? 8
      : Math.min(Math.max(data.audienceDelta, 0) * 3, 28);
    const reachSignal = Math.min(Math.log10(data.reach + 1) * 10, 35);
    const engagementSignal = Math.min(data.engagement * 8, 37);
    return Math.round(audienceSignal + reachSignal + engagementSignal);
  }

  function renderMomentum() {
    const scored = PLATFORM_ORDER
      .filter((platform) => platform !== "tiktok")
      .map((platform) => ({
        platform,
        data: platformData(platform),
        score: momentumScore(platformData(platform))
      }))
      .filter((item) => item.data.connected)
      .sort((a, b) => b.score - a.score);

    elements.momentumBars.replaceChildren();
    if (!scored.length) {
      elements.momentumHeadline.textContent = "Connecting the picture";
      elements.momentumCopy.textContent =
        "Refresh the connected platforms to reveal the strongest source of momentum.";
      return;
    }

    const leader = scored[0];
    elements.momentumStatus.textContent = "Live comparison";
    elements.momentumHeadline.textContent =
      `${PLATFORM_LABELS[leader.platform]} has the strongest current signal`;
    elements.momentumCopy.textContent =
      `${compact(leader.data.reach)} ${leader.data.reachLabel} at a ${percent(leader.data.engagement)} interaction rate across the content currently measured.`;
    const maximum = Math.max(...scored.map((item) => item.score), 1);
    scored.forEach((item) => {
      const row = document.createElement("div");
      row.className = "momentum-bar-row";
      row.innerHTML = `
        <span>${PLATFORM_LABELS[item.platform]}</span>
        <i><b style="width:${Math.max(item.score / maximum * 100, 5)}%"></b></i>
        <strong>${item.score}</strong>`;
      elements.momentumBars.append(row);
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

  function renderActions() {
    const connected = PLATFORM_ORDER
      .filter((platform) => platform !== "tiktok")
      .map((platform) => ({ platform, data: platformData(platform) }))
      .filter((item) => item.data.connected);
    const actions = [];

    connected.forEach(({ platform, data }) => {
      const best = bestContent(platform, data);
      if (best) {
        const title = best.title || best.caption || "Top content";
        actions.push({
          priority: data.engagement >= 3 ? "Repeat" : "Learn",
          title: `Build on ${PLATFORM_LABELS[platform]}'s strongest format`,
          copy: `"${title.split("\n")[0].slice(0, 78)}" is the clearest current content signal. Reuse its hook, subject or format rather than simply reposting it.`,
          score: momentumScore(data) + data.engagement
        });
      }
    });

    const instagram = platformData("instagram");
    const shorts = platformData("shorts");
    if (instagram.connected && shorts.connected) {
      actions.push({
        priority: "Cross-post",
        title: "Treat Reels and Shorts as one experiment",
        copy: "Compare the same opening idea across both platforms. Keep the better hook and edit the next version around its first three seconds.",
        score: 70
      });
    }
    actions.push({
      priority: "Measure",
      title: "Use the bio links as the conversion check",
      copy: "Reach shows attention. Spotify, ticket and community clicks show whether that attention is becoming useful artist growth.",
      score: 60
    });

    elements.actions.replaceChildren();
    actions.sort((a, b) => b.score - a.score).slice(0, 4).forEach((action, index) => {
      const item = document.createElement("article");
      item.className = "social-action-item";
      item.innerHTML = `
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div><small>${action.priority}</small><strong>${action.title}</strong><p>${action.copy}</p></div>`;
      elements.actions.append(item);
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
    elements.bioRate.textContent = percent(totalViews ? totalClicks / totalViews * 100 : 0);
    elements.bioTop.textContent = topButton?.[0] || "No clicks yet";

    ["instagram", "tiktok", "facebook", "youtube"].forEach((platform) => {
      const entry = totalsByPlatform.get(platform) || { views: 0, clicks: 0, buttons: new Map() };
      const best = [...entry.buttons.entries()].sort((a, b) => b[1] - a[1])[0];
      const rate = entry.views ? entry.clicks / entry.views * 100 : 0;
      const item = document.createElement("article");
      item.className = "bio-platform-row";
      item.innerHTML = `
        <div class="bio-platform-name"><i>${platformMark(platform)}</i><strong>${PLATFORM_LABELS[platform]}</strong></div>
        <div><span>Visits</span><strong>${full(entry.views)}</strong></div>
        <div><span>Clicks</span><strong>${full(entry.clicks)}</strong></div>
        <div><span>Clicks per visit</span><strong>${percent(rate)}</strong></div>
        <div><span>Most chosen</span><strong>${best?.[0] || "-"}</strong></div>`;
      elements.bioList.append(item);
    });
  }

  function contentType(platform, item) {
    if (platform === "shorts") return "Short";
    if (platform === "youtube") return "Video";
    if (platform === "instagram") return item.productType === "REELS" ? "Reel" : "Post";
    return "Facebook post";
  }

  function contentUrl(platform, item) {
    if (platform === "youtube" || platform === "shorts") {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`;
    }
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

  function renderContent(platform, data) {
    elements.content.replaceChildren();
    const content = [...data.content].sort((a, b) =>
      contentPerformance(b) - contentPerformance(a)
    );
    elements.drillEmpty.hidden = content.length > 0;
    if (!content.length) {
      elements.drillEmpty.innerHTML = platform === "tiktok"
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

    if (platform === "tiktok") {
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
    elements.title.textContent = PLATFORM_LABELS[platform];
    elements.description.textContent = {
      youtube: "Long-form video performance, audience growth and the subjects worth developing.",
      shorts: "Short-form reach, interaction and the creative ideas worth repeating.",
      instagram: "Reels, posts and the signals converting reach into a returning audience.",
      facebook: "Page growth, post response and Ella's community activity on Facebook.",
      tiktok: "A retention-led short-form view, ready for the TikTok API connection."
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
        <p>${data.audienceLabel}</p>
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
    elements.contentEyebrow.textContent = platform === "tiktok" ? "Prepared view" : "Content performance";
    elements.contentTitle.textContent = platform === "shorts"
      ? "Shorts this month"
      : platform === "instagram"
        ? "Posts and Reels this month"
        : platform === "facebook"
          ? "Facebook this month"
          : platform === "tiktok"
            ? "TikTok content"
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
    renderMomentum();
    renderActions();
    renderBio();
    const dates = [
      state.youtube?.current?.checkedAt,
      state.meta?.current?.checkedAt
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
  }

  async function loadBio() {
    const client = await ensureSupabase();
    if (!client) return;
    const days = state.bioPeriod === "month" ? 0 : Number(state.bioPeriod);
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
    setMessage("Fetching YouTube, Instagram and Facebook...", "loading");
    const results = await Promise.allSettled([
      fetchSnapshot(config.youtubeStatsUrl, "YouTube"),
      fetchSnapshot(config.instagramStatsUrl, "Instagram and Facebook")
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

  elements.refresh.addEventListener("click", refreshAll);
  elements.back.addEventListener("click", closeDrilldown);
  document.querySelectorAll("[data-bio-period]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-bio-period]").forEach((item) =>
        item.classList.toggle("active", item === button)
      );
      state.bioPeriod = button.dataset.bioPeriod || "month";
      await loadBio();
      renderBio();
    });
  });

  async function initialise() {
    renderOverview();
    await Promise.allSettled([loadCloudSnapshots(), loadBio()]);
    const requestedPlatform = location.hash.slice(1);
    if (PLATFORM_ORDER.includes(requestedPlatform)) openDrilldown(requestedPlatform);
    else renderOverview();

    const newest = Math.max(
      new Date(state.youtube?.current?.checkedAt || 0).getTime(),
      new Date(state.meta?.current?.checkedAt || 0).getTime()
    );
    if (!newest || Date.now() - newest > 12 * 60 * 60 * 1000) refreshAll();
  }

  initialise();
})();
