const CALENDAR_ID = "ellacrowmusic@gmail.com";
const TIMEZONE = "Europe/London";
const DEFAULT_DURATION_MINUTES = 60;
const MARKER_LABEL = "Ella dashboard ID";

const EVENT_COLORS = {
  gig: CalendarApp.EventColor.RED,
  rehearsal: CalendarApp.EventColor.GREEN,
  recording: CalendarApp.EventColor.BLUE,
  meeting: CalendarApp.EventColor.MAUVE
};

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
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
