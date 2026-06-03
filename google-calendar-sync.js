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

  async function requestSync(action, itemType, item, previousItem = null) {
    if (!item?.id) return null;
    const label = item.title || item.name || "event";

    if (!endpoint) {
      report("Google Calendar sync not configured", "idle");
      return null;
    }

    report(`Syncing ${label}`, "syncing");
    const payload = { action, itemType, item, previousItem };

    try {
      if (endpoint.includes("script.google.com")) {
        await fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(payload)
        });
        report(`Google sync queued: ${label}`, "synced");
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
      report(`Google synced: ${label}`, "synced");
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

  async function deleteEvent(itemType, item) {
    if (!item?.googleCalendarEventId) return null;
    return requestSync("delete", itemType, item);
  }

  window.EllaCalendarSync = {
    deleteEvent,
    report,
    syncGig,
    syncSession
  };
})();
