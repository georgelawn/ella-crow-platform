const CALENDAR_ID = "ellacrowmusic@gmail.com";
const TIMEZONE = "Europe/London";
const DEFAULT_DURATION_MINUTES = 60;
const MARKER_LABEL = "Ella dashboard ID";
const YOUTUBE_CHANNEL_ID = "UCbZAHmVbINt96YrYrotvB1Q";
const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const DEFAULT_SUPABASE_URL = "https://hmwnkhgsocdevehebjpq.supabase.co";
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwhJpMVQ1AQ0p5evufgLTmL2_Mnjk4P91WTPwHWYiD1nly69IyMc2V3WwowJRC-LJ8/exec";
const ELLA_STORE_TABLE = "ella_crow_store";
const DUE_DIGEST_DEFAULT_HOUR = 9;

const STORE_KEYS = {
  gigs: "ella-crow-gigs-v2",
  sessions: "ella-crow-sessions-v1",
  finance: "ella-crow-finance-v1",
  manualTodos: "ella-crow-manual-todos-v1",
  todoSnoozes: "ella-crow-todo-snoozes-v1",
  autoTodoCompletions: "ella-crow-auto-todo-completions-v1",
  opportunities: "ella-crow-opportunities-v1"
};

const EVENT_COLORS = {
  gig: CalendarApp.EventColor.RED,
  rehearsal: CalendarApp.EventColor.GREEN,
  recording: CalendarApp.EventColor.BLUE,
  meeting: CalendarApp.EventColor.MAUVE
};

function doGet(event) {
  try {
    const action = String(event && event.parameter && event.parameter.action || "");
    if (action !== "youtube") {
      return jsonp_({ ok: false, error: "Unknown action" }, event);
    }

    return jsonp_({
      ok: true,
      snapshot: youtubeSnapshot_()
    }, event);
  } catch (error) {
    return jsonp_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    }, event);
  }
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    if (payload.message || payload.edited_message) {
      return json_(handleTelegramUpdate_(payload));
    }

    const action = payload.action || "upsert";
    const itemType = payload.itemType;
    const item = payload.item || {};
    const previousItem = payload.previousItem || null;

    if (!itemType || !item.id) {
      return json_({ ok: false, error: "Missing itemType or item.id" });
    }

    if (action === "delete") {
      deleteEvent_(itemType, item);
      return json_({ ok: true, deleted: true });
    }

    const calendarEvent = upsertEvent_(itemType, item, previousItem);
    return json_({
      ok: true,
      eventId: calendarEvent.getId(),
      htmlLink: "",
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function youtubeSnapshot_() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("YOUTUBE_API_KEY");
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured in Apps Script Properties.");
  }

  const channelPayload = youtubeRequest_("channels", {
    part: "snippet,statistics,contentDetails",
    id: YOUTUBE_CHANNEL_ID
  }, apiKey);
  const channel = channelPayload.items && channelPayload.items[0];
  if (!channel) throw new Error("Ella Crow's YouTube channel could not be found.");

  const uploadsPlaylist = channel.contentDetails &&
    channel.contentDetails.relatedPlaylists &&
    channel.contentDetails.relatedPlaylists.uploads;
  let videos = [];

  if (uploadsPlaylist) {
    const playlistPayload = youtubeRequest_("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylist,
      maxResults: "12"
    }, apiKey);
    const videoIds = (playlistPayload.items || [])
      .map(function (item) { return item.contentDetails && item.contentDetails.videoId; })
      .filter(Boolean);

    if (videoIds.length) {
      const videoPayload = youtubeRequest_("videos", {
        part: "snippet,statistics",
        id: videoIds.join(",")
      }, apiKey);
      const order = {};
      videoIds.forEach(function (id, index) { order[id] = index; });
      videos = (videoPayload.items || []).sort(function (a, b) {
        return order[a.id] - order[b.id];
      });
    }
  }

  const channelStats = channel.statistics || {};
  return {
    checkedAt: new Date().toISOString(),
    channel: {
      id: channel.id,
      title: channel.snippet && channel.snippet.title || "Ella Crow",
      description: channel.snippet && channel.snippet.description || "",
      thumbnail: thumbnailUrl_(channel.snippet && channel.snippet.thumbnails),
      subscribers: number_(channelStats.subscriberCount),
      views: number_(channelStats.viewCount),
      videos: number_(channelStats.videoCount),
      subscribersHidden: Boolean(channelStats.hiddenSubscriberCount)
    },
    videos: videos.map(function (video) {
      const stats = video.statistics || {};
      return {
        id: video.id,
        title: video.snippet && video.snippet.title || "Untitled video",
        publishedAt: video.snippet && video.snippet.publishedAt || "",
        thumbnail: thumbnailUrl_(video.snippet && video.snippet.thumbnails),
        views: number_(stats.viewCount),
        likes: number_(stats.likeCount),
        comments: number_(stats.commentCount)
      };
    })
  };
}

function youtubeRequest_(path, params, apiKey) {
  const query = Object.keys(params)
    .map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    })
    .concat("key=" + encodeURIComponent(apiKey))
    .join("&");
  const response = UrlFetchApp.fetch(YOUTUBE_API_ROOT + "/" + path + "?" + query, {
    muteHttpExceptions: true
  });
  const payload = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(payload.error && payload.error.message || "YouTube API request failed.");
  }
  return payload;
}

function thumbnailUrl_(thumbnails) {
  if (!thumbnails) return "";
  return thumbnails.medium && thumbnails.medium.url ||
    thumbnails.default && thumbnails.default.url ||
    "";
}

function number_(value) {
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : 0;
}

function sendTelegramDueDigest(options) {
  const force = Boolean(options && options.force);
  const dueTodos = dueTodos_();
  if (!dueTodos.length && !force) {
    return { ok: true, sent: false, count: 0 };
  }

  const message = dueDigestMessage_(dueTodos);
  const result = sendTelegramMessage_(message);
  return { ok: true, sent: true, count: dueTodos.length, telegram: result };
}

function testTelegramDueDigest() {
  return sendTelegramDueDigest({ force: true });
}

function installTelegramDueDigestTrigger() {
  const hour = Number(PropertiesService.getScriptProperties().getProperty("DUE_DIGEST_HOUR") || DUE_DIGEST_DEFAULT_HOUR);
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() === "sendTelegramDueDigest";
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("sendTelegramDueDigest")
    .timeBased()
    .everyDays(1)
    .atHour(isFinite(hour) ? Math.max(0, Math.min(23, hour)) : DUE_DIGEST_DEFAULT_HOUR)
    .inTimezone(TIMEZONE)
    .create();

  return { ok: true, hour: hour, timezone: TIMEZONE };
}

function installTelegramUpdateWebhook() {
  const props = PropertiesService.getScriptProperties();
  const webAppUrl = props.getProperty("TELEGRAM_WEBHOOK_URL") || props.getProperty("WEB_APP_URL") || DEFAULT_WEB_APP_URL;
  const result = telegramRequest_("setWebhook", {
    url: webAppUrl,
    allowed_updates: ["message", "edited_message"]
  });
  return { ok: true, webhookUrl: webAppUrl, telegram: result };
}

function installTelegramUpdatePollingTrigger() {
  telegramRequest_("deleteWebhook", {});
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() === "pollTelegramUpdates";
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("pollTelegramUpdates")
    .timeBased()
    .everyMinutes(1)
    .create();

  return { ok: true, interval: "1 minute" };
}

function pollTelegramUpdates() {
  const props = PropertiesService.getScriptProperties();
  const offset = Number(props.getProperty("TELEGRAM_UPDATE_OFFSET") || 0);
  const updates = telegramRequest_("getUpdates", {
    offset: offset || undefined,
    timeout: 0,
    allowed_updates: ["message", "edited_message"]
  });
  let nextOffset = offset;
  let handled = 0;

  asArray_(updates).forEach(function (update) {
    if (typeof update.update_id === "number") {
      nextOffset = Math.max(nextOffset, update.update_id + 1);
    }
    const result = handleTelegramUpdate_(update);
    if (result.sent) handled += 1;
  });

  if (nextOffset !== offset) {
    props.setProperty("TELEGRAM_UPDATE_OFFSET", String(nextOffset));
  }

  return { ok: true, updates: asArray_(updates).length, handled: handled };
}

function handleTelegramUpdate_(update) {
  const message = update.message || update.edited_message || {};
  const chatId = message.chat && message.chat.id;
  const expectedChatId = PropertiesService.getScriptProperties().getProperty("TELEGRAM_CHAT_ID");
  if (!chatId || String(chatId) !== String(expectedChatId)) {
    return { ok: true, ignored: true };
  }

  const text = String(message.text || "").trim().toLowerCase();
  if (text !== "update" && text !== "/update") {
    return { ok: true, ignored: true, message: "Only the update command is enabled." };
  }

  const digest = dueDigestMessage_(dueTodos_());
  sendTelegramMessage_(digest, chatId);
  return { ok: true, sent: true };
}

function dueTodos_() {
  const store = loadEllaStore_();
  const todos = allDashboardTodos_(store);
  const today = todayKey_();
  return todos
    .filter(function (todo) {
      return !todo.done &&
        validDateKey_(todo.dueDate) &&
        todo.dueDate <= today &&
        !isTodoSnoozed_(todo, store.todoSnoozes, today) &&
        !store.autoTodoCompletions[todo.id];
    })
    .sort(function (a, b) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return String(a.category || "").localeCompare(String(b.category || ""));
    });
}

function isTodoSnoozed_(todo, snoozes, today) {
  const snoozedUntil = snoozes[todo.id];
  return validDateKey_(snoozedUntil) && snoozedUntil >= today;
}

function allDashboardTodos_(store) {
  return []
    .concat(autoGigTodos_(store.gigs))
    .concat(autoSessionTodos_(store.sessions))
    .concat(autoFinanceTodos_(store.finance))
    .concat(autoOpportunityTodos_(store.opportunities))
    .concat(manualTodos_(store.manualTodos));
}

function manualTodos_(todos) {
  return asArray_(todos).map(function (todo) {
    return {
      id: todo.id,
      type: "manual",
      category: todo.category || "Gigs",
      title: todo.title || "Untitled task",
      dueDate: todo.dueDate,
      done: Boolean(todo.done),
      meta: todo.notes || ""
    };
  });
}

function autoGigTodos_(gigs) {
  return asArray_(gigs).reduce(function (todos, gig) {
    const status = derivedStatus_(gig);
    const isUpcoming = validDateKey_(gig.date) && gig.date >= todayKey_();

    if (status === "complete" && !gig.prsSetlistLogged) {
      todos.push({
        id: `gig-prs-setlist:${gig.id}`,
        type: "auto-gig-prs-setlist",
        category: "Gigs",
        title: `Log setlist with PRS: ${gig.title || "Gig"}`,
        dueDate: gig.date,
        done: false,
        meta: `${gig.venue || "Venue not added"} - gig on ${formatDate_(gig.date)}`
      });
    }

    if (!isUpcoming || ["booked", "pending"].indexOf(status) === -1) return todos;

    if (status === "pending") {
      todos.push({
        id: `gig-confirm:${gig.id}`,
        type: "auto-gig-confirm",
        category: "Gigs",
        title: `Confirm gig: ${gig.title || "Gig"}`,
        dueDate: addMonths_(gig.date, -1),
        done: false,
        meta: `${gig.venue || "Venue TBC"} - gig on ${formatDate_(gig.date)}`
      });
    }

    normalizePlayers_(gig.players)
      .filter(function (player) {
        return player.status === "pending";
      })
      .forEach(function (player, index) {
        todos.push({
          id: `gig-player:${gig.id}:${index}:${player.name}`,
          type: "auto-gig-player",
          category: "Gigs",
          title: `Confirm ${player.name} for ${gig.title || "Gig"}`,
          dueDate: addDays_(gig.date, -14),
          done: false,
          meta: `${gig.venue || "Venue TBC"} - gig on ${formatDate_(gig.date)}`
        });
      });

    return todos;
  }, []);
}

function autoSessionTodos_(sessions) {
  return asArray_(sessions).reduce(function (todos, session) {
    const status = derivedSessionStatus_(session);
    const isUpcoming = validDateKey_(session.date) && session.date >= todayKey_();
    if (!isUpcoming || ["booked", "pending"].indexOf(status) === -1) return todos;

    normalizeSessionMusicians_(session)
      .filter(function (musician) {
        return musician.status === "pending";
      })
      .forEach(function (musician, index) {
        todos.push({
          id: `session-musician:${session.id}:${index}:${musician.name}`,
          type: "auto-session-musician",
          category: "Sessions",
          title: `Confirm ${musician.name} for ${session.title || "Session"}`,
          dueDate: addDays_(session.date, -14),
          done: false,
          meta: `${session.location || "Location TBC"} - ${session.type || "Session"} on ${formatDate_(session.date)}`
        });
      });

    return todos;
  }, []);
}

function autoFinanceTodos_(transactions) {
  return asArray_(transactions)
    .filter(function (transaction) {
      return transaction.type === "revenue" && transaction.invoiceStatus === "pending";
    })
    .map(function (transaction) {
      return {
        id: `finance-invoice:${transaction.id}`,
        type: "auto-finance-invoice",
        category: "Finance",
        title: `Invoice pending: ${transaction.category || transaction.description || "Revenue"}`,
        dueDate: transaction.invoiceDueDate || transaction.date,
        done: false,
        meta: `${money_(transaction.amount)} - recorded ${formatDate_(transaction.date)}`
      };
    });
}

function autoOpportunityTodos_(opportunities) {
  return asArray_(opportunities)
    .filter(function (opportunity) {
      return !isClosedOpportunity_(opportunity) && opportunity.followUpDate && !opportunity.followUpDone;
    })
    .map(function (opportunity) {
      return {
        id: `opportunity-follow-up:${opportunity.id}`,
        type: "auto-opportunity-follow-up",
        category: "Opportunities",
        title: `Follow up: ${opportunity.title || "Opportunity"}`,
        dueDate: opportunity.followUpDate,
        done: false,
        meta: `${opportunity.contact || "No contact added"}${opportunity.source ? ` - ${opportunity.source}` : ""}`
      };
    });
}

function dueDigestMessage_(todos) {
  const today = todayKey_();
  const overdueCount = todos.filter(function (todo) {
    return todo.dueDate < today;
  }).length;
  const dueTodayCount = todos.length - overdueCount;
  const categories = ["Gigs", "Sessions", "Finance", "Opportunities"];
  const lines = [
    "<b>Ella daily update</b>",
    formatDate_(today),
    "",
    digestSummaryLine_(todos.length, overdueCount, dueTodayCount)
  ];

  if (!todos.length) {
    lines.push("", "Nothing due or overdue right now.");
    return truncateTelegramMessage_(lines.join("\n"));
  }

  categories.forEach(function (category) {
    const categoryTodos = todos.filter(function (todo) {
      return todo.category === category;
    });
    if (!categoryTodos.length) return;

    lines.push("");
    lines.push(`<b>${escapeTelegramHtml_(category)}</b>`);
    categoryTodos.forEach(function (todo, index) {
      lines.push(formatDigestTodo_(todo, index + 1, today));
    });
  });

  return truncateTelegramMessage_(lines.join("\n"));
}

function digestSummaryLine_(totalCount, overdueCount, dueTodayCount) {
  if (!totalCount) return "<b>0 open due items</b>";
  const parts = [];
  if (overdueCount) parts.push(`${overdueCount} overdue`);
  if (dueTodayCount) parts.push(`${dueTodayCount} due today`);
  return `<b>${totalCount} open due item${totalCount === 1 ? "" : "s"}</b>${parts.length ? ` - ${parts.join(", ")}` : ""}`;
}

function formatDigestTodo_(todo, number, today) {
  const status = todo.dueDate < today ? "OVERDUE" : "DUE TODAY";
  const lines = [
    `${number}. <b>${escapeTelegramHtml_(todo.title)}</b>`,
    `   ${status}: ${escapeTelegramHtml_(formatDate_(todo.dueDate))}`
  ];
  if (todo.meta) {
    lines.push(`   ${escapeTelegramHtml_(todo.meta)}`);
  }
  return lines.join("\n");
}

function sendTelegramMessage_(message, chatIdOverride) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = chatIdOverride || props.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured in Apps Script Properties.");
  }

  return telegramRequest_("sendMessage", {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

function telegramRequest_(method, payload) {
  const token = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN must be configured in Apps Script Properties.");
  }

  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });
  const result = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed.`);
  }
  return result.result;
}

function loadEllaStore_() {
  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = String(props.getProperty("SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const supabaseKey = props.getProperty("SUPABASE_ANON_KEY");
  if (!supabaseKey) {
    throw new Error("SUPABASE_ANON_KEY must be configured in Apps Script Properties.");
  }

  const keys = Object.keys(STORE_KEYS).map(function (name) {
    return STORE_KEYS[name];
  });
  const filter = encodeURIComponent(`in.(${keys.map(function (key) { return `"${key}"`; }).join(",")})`);
  const response = UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/${ELLA_STORE_TABLE}?select=key,value&key=${filter}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    },
    muteHttpExceptions: true
  });
  const text = response.getContentText() || "[]";
  const payload = JSON.parse(text);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(payload.message || text || "Supabase store fetch failed.");
  }

  const rowsByKey = {};
  payload.forEach(function (row) {
    rowsByKey[row.key] = row.value;
  });

  return {
    gigs: asArray_(rowsByKey[STORE_KEYS.gigs]),
    sessions: asArray_(rowsByKey[STORE_KEYS.sessions]),
    finance: asArray_(rowsByKey[STORE_KEYS.finance]),
    manualTodos: asArray_(rowsByKey[STORE_KEYS.manualTodos]),
    todoSnoozes: asObject_(rowsByKey[STORE_KEYS.todoSnoozes]),
    autoTodoCompletions: asObject_(rowsByKey[STORE_KEYS.autoTodoCompletions]),
    opportunities: asArray_(rowsByKey[STORE_KEYS.opportunities])
  };
}

function derivedStatus_(gig) {
  if (gig.manualStatus) return gig.status || "booked";
  if (validDateKey_(gig.date) && gig.date < todayKey_()) return "complete";
  return gig.status || "booked";
}

function derivedSessionStatus_(session) {
  if (session.manualStatus) return session.status || "booked";
  if (validDateKey_(session.date) && session.date < todayKey_()) return "complete";
  return session.status || "booked";
}

function normalizePlayers_(players) {
  if (!Array.isArray(players)) return [];
  return players
    .map(function (player) {
      if (typeof player === "string") return { name: player, status: "confirmed" };
      return {
        name: player.name || "",
        status: player.status === "pending" ? "pending" : "confirmed"
      };
    })
    .filter(function (player) {
      return player.name;
    });
}

function normalizeSessionMusicians_(session) {
  if (Array.isArray(session.musicians)) {
    return session.musicians
      .map(function (person) {
        if (typeof person === "string") return { name: person, status: "confirmed" };
        return {
          name: person.name || "",
          status: person.status === "pending" ? "pending" : "confirmed"
        };
      })
      .filter(function (person) {
        return person.name;
      });
  }

  return String(session.people || "")
    .split(",")
    .map(function (name) {
      return name.trim();
    })
    .filter(Boolean)
    .map(function (name) {
      return { name: name, status: "confirmed" };
    });
}

function isClosedOpportunity_(opportunity) {
  return ["won", "lost", "closed", "complete", "completed"].indexOf(String(opportunity.status || "").toLowerCase()) !== -1;
}

function todayKey_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
}

function validDateKey_(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""));
}

function addDays_(dateString, days) {
  if (!validDateKey_(dateString)) return "";
  const date = dateOnly_(dateString);
  date.setDate(date.getDate() + days);
  return Utilities.formatDate(date, TIMEZONE, "yyyy-MM-dd");
}

function addMonths_(dateString, months) {
  if (!validDateKey_(dateString)) return "";
  const date = dateOnly_(dateString);
  const targetDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== targetDay) {
    date.setDate(0);
  }
  return Utilities.formatDate(date, TIMEZONE, "yyyy-MM-dd");
}

function formatDate_(dateString) {
  if (!validDateKey_(dateString)) return "No date";
  return Utilities.formatDate(dateOnly_(dateString), TIMEZONE, "d MMM yyyy");
}

function money_(amount) {
  const parsed = Number(amount || 0);
  return `GBP ${parsed.toFixed(2)}`;
}

function escapeTelegramHtml_(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function asArray_(value) {
  return Array.isArray(value) ? value : [];
}

function asObject_(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function truncateTelegramMessage_(message) {
  const limit = 3900;
  if (message.length <= limit) return message;
  return `${message.slice(0, limit)}\n...truncated`;
}

function upsertEvent_(itemType, item, previousItem) {
  const calendar = calendar_();
  const key = eventKey_(itemType, item.id);
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(key);
  let calendarEvent = existingId ? calendar.getEventById(existingId) : null;

  if (!calendarEvent && item.googleCalendarEventId && !String(item.googleCalendarEventId).startsWith("apps-script:")) {
    calendarEvent = calendar.getEventById(item.googleCalendarEventId);
  }

  if (!calendarEvent) {
    calendarEvent = findMarkedEvent_(calendar, key);
  }

  if (!calendarEvent) {
    calendarEvent = findMatchingEvent_(calendar, itemType, previousItem || item);
  }

  if (!calendarEvent) {
    calendarEvent = createEvent_(calendar, itemType, item);
    props.setProperty(key, calendarEvent.getId());
    cleanupStaleEvents_(calendar, itemType, item, previousItem, calendarEvent.getId());
    return calendarEvent;
  }

  updateEvent_(calendarEvent, itemType, item);
  props.setProperty(key, calendarEvent.getId());
  cleanupStaleEvents_(calendar, itemType, item, previousItem, calendarEvent.getId());
  return calendarEvent;
}

function createEvent_(calendar, itemType, item) {
  const options = eventOptions_(itemType, item);
  let calendarEvent;

  if (!item.time) {
    const start = dateOnly_(item.date);
    const end = dateOnly_(item.date);
    end.setDate(end.getDate() + 1);
    calendarEvent = calendar.createAllDayEvent(eventSummary_(itemType, item), start, end, options);
  } else {
    calendarEvent = calendar.createEvent(
      eventSummary_(itemType, item),
      dateTime_(item.date, item.time, 0),
      dateTime_(item.date, item.time, DEFAULT_DURATION_MINUTES),
      options
    );
  }

  setEventColor_(calendarEvent, itemType, item);
  return calendarEvent;
}

function updateEvent_(calendarEvent, itemType, item) {
  calendarEvent.setTitle(eventSummary_(itemType, item));
  calendarEvent.setDescription(eventDescription_(itemType, item));
  calendarEvent.setLocation(itemType === "gig" ? gigLocation_(item) : (item.location || ""));

  if (!item.time) {
    const start = dateOnly_(item.date);
    const end = dateOnly_(item.date);
    end.setDate(end.getDate() + 1);
    calendarEvent.setAllDayDates(start, end);
  } else {
    calendarEvent.setTime(
      dateTime_(item.date, item.time, 0),
      dateTime_(item.date, item.time, DEFAULT_DURATION_MINUTES)
    );
  }

  setEventColor_(calendarEvent, itemType, item);
}

function deleteEvent_(itemType, item) {
  const calendar = calendar_();
  const key = eventKey_(itemType, item.id);
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(key);
  let calendarEvent = existingId ? calendar.getEventById(existingId) : null;
  if (!calendarEvent) calendarEvent = findMarkedEvent_(calendar, key);
  if (!calendarEvent) calendarEvent = findMatchingEvent_(calendar, itemType, item);
  if (calendarEvent) calendarEvent.deleteEvent();
  props.deleteProperty(key);
}

function calendar_() {
  return CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
}

function eventKey_(itemType, id) {
  return `${itemType}:${id}`;
}

function eventOptions_(itemType, item) {
  return {
    description: eventDescription_(itemType, item),
    location: itemType === "gig" ? gigLocation_(item) : (item.location || "")
  };
}

function dateOnly_(dateString) {
  const parts = String(dateString).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dateTime_(dateString, timeString, minutesToAdd) {
  const dateParts = String(dateString).split("-").map(Number);
  const timeParts = String(timeString || "00:00").split(":").map(Number);
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1] + minutesToAdd, 0);
}

function line_(label, value) {
  const clean = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "").trim();
  return clean ? `${label}: ${clean}` : "";
}

function peopleList_(item) {
  const people = item.players || item.musicians || [];
  if (!Array.isArray(people)) return "";
  return people
    .map((person) => {
      if (typeof person === "string") return person;
      const status = person.status ? ` (${person.status})` : "";
      return person.name ? `${person.name}${status}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function gigLocation_(item) {
  return [item.venue, item.location].filter(Boolean).join(", ");
}

function eventSummary_(itemType, item) {
  if (itemType === "gig") {
    const location = item.venue || item.location || "Location TBC";
    return `${item.title} @ ${location}`;
  }
  return item.title;
}

function eventDescription_(itemType, item) {
  if (itemType === "gig") {
    return [
      line_(MARKER_LABEL, eventKey_(itemType, item.id)),
      line_("Type", "Gig"),
      line_("Status", item.statusLabel || item.status),
      line_("Venue", item.venue),
      line_("Location", item.location),
      line_("Time", item.time),
      line_("Ticket sales", item.tickets),
      line_("Contact / promoter", item.contact),
      line_("People playing", peopleList_(item)),
      line_("Notes", item.notes)
    ].filter(Boolean).join("\n");
  }

  return [
    line_(MARKER_LABEL, eventKey_(itemType, item.id)),
    line_("Type", item.type),
    line_("Status", item.statusLabel || item.status),
    line_("Location / studio", item.location),
    line_("Time", item.time),
    line_("Cost", item.cost),
    line_("Musicians involved", peopleList_(item)),
    line_("Notes", item.notes)
  ].filter(Boolean).join("\n");
}

function findMarkedEvent_(calendar, key) {
  const start = new Date(2024, 0, 1);
  const end = new Date(2035, 11, 31);
  const events = calendar.getEvents(start, end, { search: key });
  return events.find((event) => String(event.getDescription() || "").indexOf(`${MARKER_LABEL}: ${key}`) !== -1) || null;
}

function findMatchingEvent_(calendar, itemType, item) {
  if (!item || !item.date) return null;
  return matchingEvents_(calendar, itemType, item)[0] || null;
}

function matchingEvents_(calendar, itemType, item) {
  if (!item || !item.date) return [];
  const summary = eventSummary_(itemType, item);
  const window = eventWindow_(item.date);
  return calendar.getEvents(window.start, window.end)
    .filter((event) => event.getTitle() === summary);
}

function cleanupStaleEvents_(calendar, itemType, item, previousItem, keeperId) {
  const candidates = []
    .concat(matchingEvents_(calendar, itemType, item))
    .concat(nearbyMatchingEvents_(calendar, itemType, item))
    .concat(previousItem ? matchingEvents_(calendar, itemType, previousItem) : []);
  const seen = {};

  candidates.forEach((event) => {
    const id = event.getId();
    if (seen[id] || id === keeperId) return;
    seen[id] = true;
    event.deleteEvent();
  });
}

function eventWindow_(dateString) {
  const start = dateOnly_(dateString);
  start.setDate(start.getDate() - 1);
  const end = dateOnly_(dateString);
  end.setDate(end.getDate() + 2);
  return { start, end };
}

function nearbyMatchingEvents_(calendar, itemType, item) {
  if (!item || !item.date) return [];
  const summary = eventSummary_(itemType, item);
  const start = dateOnly_(item.date);
  start.setDate(start.getDate() - 45);
  const end = dateOnly_(item.date);
  end.setDate(end.getDate() + 45);
  return calendar.getEvents(start, end)
    .filter((event) => event.getTitle() === summary);
}

function setEventColor_(calendarEvent, itemType, item) {
  const color = itemType === "gig"
    ? EVENT_COLORS.gig
    : (item.type === "Recording" ? EVENT_COLORS.recording : (item.type === "Meeting" ? EVENT_COLORS.meeting : EVENT_COLORS.rehearsal));
  calendarEvent.setColor(color);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(payload, event) {
  const callback = String(event && event.parameter && event.parameter.callback || "");
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return json_(payload);
  }
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
