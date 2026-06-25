(function () {
  const config = window.ELLA_CLOUD_CONFIG || {};
  const endpoint = config.googleCalendarSyncUrl || "";

  function statusText(status) {
    if (status === "pending") return "TBC";
    return status || "Booked";
  }

  function report(message, state = "idle", detail = "") {
    const status = document.querySelector("#calendarSyncStatus");
    if (status) {
      status.textContent = message;
      status.dataset.state = state;
      status.title = detail || message;
    }
    window.dispatchEvent(new CustomEvent("ella-calendar-sync-status", {
      detail: { message, state, detail }
    }));
  }

  function syntheticEventId(itemType, item) {
    return `apps-script:${itemType}:${item.id}`;
  }

  function progressMessage(action, label) {
    if (action === "delete") return `Deleting ${label} from Google`;
    if (action === "recreate") return `Re-pushing ${label} to Google`;
    return `Syncing ${label}`;
  }

  function sentMessage(action, label) {
    if (action === "delete") return `Google delete sent: ${label}`;
    if (action === "recreate") return `Google re-push sent: ${label}`;
    return `Google sync sent: ${label}`;
  }

  function syncedMessage(action, label) {
    if (action === "delete") return `Google deleted: ${label}`;
    if (action === "recreate") return `Google re-pushed: ${label}`;
    return `Google synced: ${label}`;
  }

  function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `ellaCalendarSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const separator = url.includes("?") ? "&" : "?";
      const script = document.createElement("script");
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Google Calendar sync response could not be loaded."));
      };
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
      document.head.appendChild(script);
    });
  }

  async function requestReadableAppsScriptSync(payload) {
    const url = `${endpoint}?action=calendar-sync&payload=${encodeURIComponent(JSON.stringify(payload))}`;
    return jsonpRequest(url);
  }

  async function requestSync(action, itemType, item, previousItem = null) {
    if (!item?.id) return null;
    const label = item.title || item.name || "event";

    if (!endpoint) {
      report("Google Calendar sync not configured", "idle");
      return null;
    }

    report(progressMessage(action, label), "syncing");
    const payload = { action, itemType, item, previousItem };

    try {
      if (endpoint.includes("script.google.com")) {
        if (action === "recreate" || action === "delete") {
          const data = await requestReadableAppsScriptSync(payload);
          if (!data?.ok) {
            const error = data?.error || "Unknown Google Calendar sync error";
            console.warn("Google Calendar sync failed", error);
            report(`Google sync failed: ${label}`, "error", error);
            return { error };
          }
          report(syncedMessage(action, label), "synced");
          return data;
        }

        await fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(payload)
        });
        report(sentMessage(action, label), "synced", "Sent to Google Apps Script. Calendar changes may take a moment to appear.");
        return {
          eventId: item.googleCalendarEventId || syntheticEventId(itemType, item),
          htmlLink: item.googleCalendarHtmlLink || "",
          syncedAt: new Date().toISOString()
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn("Google Calendar sync skipped", text);
        report(`Google sync failed: ${label}`, "error", text);
        return { error: text };
      }

      const data = await response.json();
      report(syncedMessage(action, label), "synced");
      return data;
    } catch (error) {
      console.warn("Google Calendar sync unavailable", error);
      report(`Google sync unavailable: ${label}`, "error", String(error));
      return null;
    }
  }

  async function syncGig(gig, previousGig = null) {
    if (!gig?.title || !gig?.date) return null;
    return requestSync("upsert", "gig", {
      ...gig,
      statusLabel: statusText(gig.status)
    }, previousGig);
  }

  async function syncSession(session, previousSession = null) {
    if (!session?.title || !session?.date) return null;
    return requestSync("upsert", "session", {
      ...session,
      statusLabel: statusText(session.status)
    }, previousSession);
  }

  async function repushGig(gig) {
    if (!gig?.title || !gig?.date) return null;
    return requestSync("recreate", "gig", {
      ...gig,
      googleCalendarEventId: "",
      googleCalendarHtmlLink: "",
      statusLabel: statusText(gig.status)
    });
  }

  async function repushSession(session) {
    if (!session?.title || !session?.date) return null;
    return requestSync("recreate", "session", {
      ...session,
      googleCalendarEventId: "",
      googleCalendarHtmlLink: "",
      statusLabel: statusText(session.status)
    });
  }

  async function deleteEvent(itemType, item) {
    return requestSync("delete", itemType, item);
  }

  window.EllaCalendarSync = {
    deleteEvent,
    report,
    repushGig,
    repushSession,
    syncGig,
    syncSession
  };
})();
