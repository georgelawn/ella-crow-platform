(function () {
  const config = window.ELLA_CLOUD_CONFIG || {};
  const trackedKeys = [
    "ella-crow-gigs-v2",
    "ella-crow-contacts-v1",
    "ella-crow-sessions-v1",
    "ella-crow-finance-v1",
    "ella-crow-finance-closes-v1",
    "ella-crow-projects-v1",
    "ella-crow-opportunities-v1",
    "ella-crow-opportunities",
    "ella-crow-email-opportunities-v1",
    "ella-crow-manual-todos-v1",
    "ella-crow-todo-snoozes-v1",
    "ella-crow-auto-todo-completions-v1",
    "ella-crow-social-youtube-v1",
    "ella-crow-social-instagram-v1",
    "ella-crow-social-tiktok-v1",
    "ella-crow-social-creative-matches-v1",
    "ella-crow-instruments-v1",
    "ella-crow-roster-migrated-v1"
  ];

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const tableName = config.tableName || "ella_crow_store";
  let client = null;
  let ready = false;
  let pulling = false;
  let pushTimer = null;
  let deferredCloudUpdateTimer = null;
  let deferredUiRefreshTimer = null;
  let lastEditableInteractionAt = 0;
  const deferredCloudUpdateKeys = new Set();
  const deferredUiRefreshCallbacks = [];
  const pendingPushes = new Map();
  const editableSelector = "input, select, textarea, [contenteditable='true']";
  const editableQuietPeriodMs = 30000;

  function activeElementIsEditable() {
    const element = document.activeElement;
    if (!element || element === document.body || element === document.documentElement) return false;
    return Boolean(element.closest(editableSelector));
  }

  function noteEditableInteraction(event) {
    if (!event.target?.closest?.(editableSelector)) return;
    lastEditableInteractionAt = Date.now();
  }

  function millisecondsUntilEditableQuiet() {
    if (activeElementIsEditable()) return editableQuietPeriodMs;
    const elapsed = Date.now() - lastEditableInteractionAt;
    return Math.max(0, editableQuietPeriodMs - elapsed);
  }

  function userIsEditing() {
    return activeElementIsEditable() || millisecondsUntilEditableQuiet() > 0;
  }

  function dispatchCloudDataUpdated(keys) {
    window.dispatchEvent(new CustomEvent("ella-cloud-data-updated", {
      detail: { keys }
    }));
  }

  function flushDeferredCloudDataUpdated() {
    clearTimeout(deferredCloudUpdateTimer);
    deferredCloudUpdateTimer = null;

    if (!deferredCloudUpdateKeys.size) return;

    const quietDelay = millisecondsUntilEditableQuiet();
    if (quietDelay > 0) {
      scheduleDeferredCloudDataUpdated(quietDelay + 120);
      return;
    }

    const keys = [...deferredCloudUpdateKeys];
    deferredCloudUpdateKeys.clear();
    dispatchCloudDataUpdated(keys);
  }

  function scheduleDeferredCloudDataUpdated(delay = 120) {
    clearTimeout(deferredCloudUpdateTimer);
    deferredCloudUpdateTimer = setTimeout(flushDeferredCloudDataUpdated, delay);
  }

  function flushDeferredUiRefreshCallbacks() {
    clearTimeout(deferredUiRefreshTimer);
    deferredUiRefreshTimer = null;

    if (!deferredUiRefreshCallbacks.length) return;

    const quietDelay = millisecondsUntilEditableQuiet();
    if (quietDelay > 0) {
      scheduleDeferredUiRefresh(quietDelay + 120);
      return;
    }

    const callbacks = deferredUiRefreshCallbacks.splice(0);
    callbacks.forEach((callback) => callback());
  }

  function scheduleDeferredUiRefresh(delay = 120) {
    clearTimeout(deferredUiRefreshTimer);
    deferredUiRefreshTimer = setTimeout(flushDeferredUiRefreshCallbacks, delay);
  }

  function deferUiRefresh(callback) {
    if (typeof callback !== "function") return;
    if (!userIsEditing()) {
      callback();
      return;
    }
    deferredUiRefreshCallbacks.push(callback);
    scheduleDeferredUiRefresh();
  }

  function showSyncStatus(text, state = "local") {
    let badge = document.querySelector("#cloudSyncStatus");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "cloudSyncStatus";
      badge.className = "sync-status";
      document.body.appendChild(badge);
    }
    badge.textContent = text;
    badge.dataset.state = state;
  }

  function parseStoredValue(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function stringifyCloudValue(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  async function pushKey(key, value) {
    if (!client || !trackedKeys.includes(key)) return;
    const payload = {
      key,
      value: parseStoredValue(value),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from(tableName).upsert(payload, { onConflict: "key" });
    if (error) throw error;
  }

  async function deleteKey(key) {
    if (!client || !trackedKeys.includes(key)) return;
    const { error } = await client.from(tableName).delete().eq("key", key);
    if (error) throw error;
  }

  function queuePush(key, value) {
    if (!ready || pulling || !trackedKeys.includes(key)) return;
    pendingPushes.set(key, value);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPushes, 350);
  }

  function loadSupabaseLibrary() {
    if (window.supabase) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-supabase-client]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.dataset.supabaseClient = "true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function flushPushes() {
    if (!pendingPushes.size) return;
    const entries = [...pendingPushes.entries()];
    pendingPushes.clear();
    try {
      showSyncStatus("Syncing", "syncing");
      await Promise.all(entries.map(([key, value]) => value === null ? deleteKey(key) : pushKey(key, value)));
      showSyncStatus("Cloud synced", "synced");
    } catch (error) {
      console.error("Ella cloud sync failed", error);
      showSyncStatus("Sync paused", "error");
    }
  }

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (this === localStorage) queuePush(key, value);
  };

  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.apply(this, arguments);
    if (this === localStorage) queuePush(key, null);
  };

  function announceCloudDataUpdated(keys) {
    if (!keys.length) return;
    if (userIsEditing()) {
      keys.forEach((key) => deferredCloudUpdateKeys.add(key));
      scheduleDeferredCloudDataUpdated();
      return;
    }
    dispatchCloudDataUpdated(keys);
  }

  async function pullCloudData() {
    if (!client) return;
    pulling = true;
    const changedKeys = [];
    try {
      showSyncStatus("Syncing", "syncing");
      const { data, error } = await client.from(tableName).select("key,value,updated_at").in("key", trackedKeys);
      if (error) throw error;

      const cloudRows = new Map((data || []).map((row) => [row.key, row]));

      trackedKeys.forEach((key) => {
        const localValue = localStorage.getItem(key);
        const cloudRow = cloudRows.get(key);

        if (pendingPushes.has(key)) {
          return;
        }

        if (cloudRow) {
          const cloudValue = stringifyCloudValue(cloudRow.value);
          if (localValue !== cloudValue) {
            originalSetItem.call(localStorage, key, cloudValue);
            changedKeys.push(key);
          }
          return;
        }

        if (localValue !== null) {
          pendingPushes.set(key, localValue);
        }
      });

      ready = true;
      await flushPushes();
      showSyncStatus("Cloud synced", "synced");
      announceCloudDataUpdated(changedKeys);
    } catch (error) {
      console.error("Ella cloud pull failed", error);
      showSyncStatus("Sync paused", "error");
    } finally {
      pulling = false;
      ready = true;
    }
  }

  async function startCloudSync() {
    if (!config.enabled) {
      showSyncStatus("Local only", "local");
      return;
    }

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      showSyncStatus("Cloud not configured", "error");
      return;
    }

    try {
      await loadSupabaseLibrary();
    } catch (error) {
      console.error("Supabase library failed to load", error);
      showSyncStatus("Sync unavailable", "error");
      return;
    }

    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    await pullCloudData();

    window.addEventListener("focus", () => pullCloudData());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pullCloudData();
    });
    ["focusin", "input", "keydown", "pointerdown", "change"].forEach((eventName) => {
      document.addEventListener(eventName, noteEditableInteraction, true);
    });
    document.addEventListener("focusout", () => {
      scheduleDeferredCloudDataUpdated();
      scheduleDeferredUiRefresh();
    });
  }

  window.EllaCloudSync = {
    flush: flushPushes,
    deferUiRefresh,
    isUiBusy: userIsEditing
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCloudSync);
  } else {
    startCloudSync();
  }
})();
