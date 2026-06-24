const sessionStorageKey = "ella-crow-sessions-v1";
const contactStorageKey = "ella-crow-contacts-v1";
const newMusicianValue = "__new_musician__";

let sessions = loadSessions();
let musicians = loadMusicians();
let activeFilter = "all";

const form = document.querySelector("#sessionForm");
const sessionList = document.querySelector("#sessionList");
const emptyState = document.querySelector("#sessionEmptyState");
const clearButton = document.querySelector("#clearSessionButton");
const newSessionButton = document.querySelector("#newSessionButton");
const formTitle = document.querySelector("#sessionFormTitle");
const syncExistingSessionsButton = document.querySelector("#syncExistingSessionsButton");

const fields = {
  id: document.querySelector("#sessionId"),
  type: document.querySelector("#sessionType"),
  title: document.querySelector("#sessionTitle"),
  date: document.querySelector("#sessionDate"),
  time: document.querySelector("#sessionTime"),
  location: document.querySelector("#sessionLocation"),
  status: document.querySelector("#sessionStatus"),
  cost: document.querySelector("#sessionCost"),
  notes: document.querySelector("#sessionNotes")
};

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(sessionStorageKey, JSON.stringify(sessions));
}

async function syncSessionToCalendar(session, openId = "", previousSession = null) {
  if (!window.EllaCalendarSync?.syncSession || !session?.title || !session?.date) return;
  const result = await window.EllaCalendarSync.syncSession(session, previousSession);
  if (!result?.eventId) return;

  const freshSession = sessions.find((item) => item.id === session.id);
  if (!freshSession) return;
  freshSession.googleCalendarEventId = result.eventId;
  freshSession.googleCalendarHtmlLink = result.htmlLink || "";
  freshSession.googleCalendarSyncedAt = result.syncedAt || new Date().toISOString();
  saveSessions();
  if (openId) renderSessions(openId);
  return result;
}

async function syncExistingSessionsToCalendar() {
  if (!window.EllaCalendarSync?.syncSession) return;
  const syncableSessions = sessions.filter((session) => session.title && session.date);
  let syncedCount = 0;
  let failedCount = 0;
  window.EllaCalendarSync.report?.(`Syncing ${syncableSessions.length} sessions`, "syncing");
  for (const session of syncableSessions) {
    const result = await syncSessionToCalendar(session);
    if (result?.eventId) {
      syncedCount += 1;
    } else {
      failedCount += 1;
    }
  }
  if (syncableSessions.length) renderSessions();
  window.EllaCalendarSync.report?.(
    failedCount ? `Google sync: ${syncedCount} synced, ${failedCount} failed` : `Google sync: ${syncedCount} synced`,
    failedCount ? "error" : "synced"
  );
}

function loadContacts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(contactStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContacts(contacts) {
  localStorage.setItem(contactStorageKey, JSON.stringify(contacts));
}

function loadMusicians() {
  return loadContacts()
    .filter((contact) => contact.category === "Musicians")
    .map((contact) => contact.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function addMusicianContact(name) {
  const contacts = loadContacts();
  const exists = contacts.some((contact) =>
    contact.category === "Musicians" &&
    contact.name.toLowerCase() === name.toLowerCase()
  );
  if (!exists) {
    contacts.push({
      id: crypto.randomUUID(),
      category: "Musicians",
      name,
      phone: "",
      email: "",
      instrument: "",
      description: ""
    });
    saveContacts(contacts);
  }
  musicians = loadMusicians();
}

function todayStamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function derivedStatus(session) {
  if (session.manualStatus) return session.status || "booked";
  const date = new Date(`${session.date}T00:00:00`);
  if (date.getTime() < todayStamp()) return "complete";
  return session.status || "booked";
}

function refreshPastStatuses() {
  let changed = false;
  sessions = sessions.map((session) => {
    const status = derivedStatus(session);
    if (status !== session.status) changed = true;
    return { ...session, status };
  });
  if (changed) saveSessions();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

function displayValue(value, fallback = "Not added yet") {
  const clean = String(value ?? "").trim();
  return clean ? escapeHtml(clean) : fallback;
}

function statusLabel(status) {
  if (status === "pending") return "TBC";
  return status;
}

function normalizePeople(session) {
  if (Array.isArray(session.musicians)) {
    return session.musicians.map((person) =>
      typeof person === "string"
        ? { name: person, status: "confirmed" }
        : { name: person.name || "", status: person.status === "pending" ? "pending" : "confirmed" }
    );
  }
  return String(session.people || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, status: "confirmed" }));
}

function musicianOptions(selectedName = "") {
  return `
    <option value="">Choose musician</option>
    ${musicians.map((name) => `<option value="${escapeHtml(name)}"${selectedName === name ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}
    <option value="${newMusicianValue}">Add new musician</option>
  `;
}

function renderMusicianRows(sessionId, people) {
  const rows = people.length ? people : [{ name: "", status: "pending" }];
  return rows.map((person, index) => `
    <div class="player-row">
      <label>
        <span>Musician</span>
        <select class="session-musician-field" data-id="${sessionId}" data-index="${index}" data-field="name">
          ${musicianOptions(person.name)}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select class="session-musician-field" data-id="${sessionId}" data-index="${index}" data-field="status">
          <option value="confirmed"${person.status === "confirmed" ? " selected" : ""}>Confirmed</option>
          <option value="pending"${person.status === "pending" ? " selected" : ""}>Pending</option>
        </select>
      </label>
      <button class="small-button player-remove" data-action="remove-musician" data-id="${sessionId}" data-index="${index}" type="button">Remove</button>
    </div>
  `).join("");
}

function renderSummary() {
  document.querySelector("#upcomingSessionCount").textContent = sessions.filter((item) => item.status === "booked").length;
  document.querySelector("#pendingSessionCount").textContent = sessions.filter((item) => item.status === "pending").length;
  document.querySelector("#rehearsalCount").textContent = sessions.filter((item) => item.type === "Rehearsal").length;
  document.querySelector("#recordingCount").textContent = sessions.filter((item) => item.type === "Recording").length;
  document.querySelector("#meetingCount").textContent = sessions.filter((item) => item.type === "Meeting").length;
}

function renderSessions(openId = "") {
  refreshPastStatuses();
  renderSummary();
  const visible = sessions
    .filter((session) => activeFilter === "all" || session.type === activeFilter || session.status === activeFilter)
    .sort((a, b) => new Date(`${a.date}T${a.time || "00:00"}`) - new Date(`${b.date}T${b.time || "00:00"}`));

  emptyState.classList.toggle("visible", visible.length === 0);
  sessionList.innerHTML = visible.map((session) => renderSession(session, openId)).join("");
}

function renderSession(session, openId = "") {
  const date = new Date(`${session.date}T00:00:00`);
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  const open = session.id === openId ? " open" : "";
  const people = normalizePeople(session);
  const peopleText = people.length ? people.map((person) => person.name).join(", ") : "No musicians added";
  const pendingMusicians = people.filter((person) => person.name && person.status === "pending").length;

  return `
    <details class="gig-card ${session.status}"${open}>
      <summary>
        <div class="date-box"><strong>${day}</strong><span>${month}</span></div>
        <div class="gig-title">
          <h3>${escapeHtml(session.title)}</h3>
          <p>${escapeHtml(session.type)} · ${displayValue(session.location)} · ${formatDate(session.date)}${session.time ? ` · ${escapeHtml(session.time)}` : ""}</p>
        </div>
        <div class="summary-pills">
          <span class="status-pill ${session.status}">${statusLabel(session.status)}</span>
          ${pendingMusicians ? `<span class="pending-player-pill">${pendingMusicians} pending</span>` : ""}
        </div>
      </summary>
      <div class="gig-details" data-id="${session.id}">
        <label class="detail-field">
          <span>Type</span>
          <select class="session-field" data-field="type">
            <option value="Rehearsal"${session.type === "Rehearsal" ? " selected" : ""}>Rehearsal</option>
            <option value="Recording"${session.type === "Recording" ? " selected" : ""}>Recording</option>
            <option value="Meeting"${session.type === "Meeting" ? " selected" : ""}>Meeting</option>
          </select>
        </label>
        <label class="detail-field">
          <span>Status</span>
          <select class="session-field" data-field="status">
            <option value="booked"${session.status === "booked" ? " selected" : ""}>Booked</option>
            <option value="pending"${session.status === "pending" ? " selected" : ""}>TBC</option>
            <option value="complete"${session.status === "complete" ? " selected" : ""}>Complete</option>
          </select>
        </label>
        <label class="detail-field full">
          <span>Title</span>
          <input class="session-field" data-field="title" value="${escapeHtml(session.title)}">
        </label>
        <label class="detail-field">
          <span>Date</span>
          <input class="session-field" data-field="date" type="date" value="${escapeHtml(session.date)}">
        </label>
        <label class="detail-field">
          <span>Time</span>
          <input class="session-field" data-field="time" type="time" value="${escapeHtml(session.time || "")}">
        </label>
        <label class="detail-field full">
          <span>Location / studio</span>
          <input class="session-field" data-field="location" value="${escapeHtml(session.location || "")}">
        </label>
        <label class="detail-field">
          <span>Cost</span>
          <input class="session-field" data-field="cost" type="number" min="0" step="0.01" value="${escapeHtml(session.cost || "")}">
        </label>
        <div class="detail-field full">
          <span>Musicians involved</span>
          <p class="field-note">${escapeHtml(peopleText)}</p>
          <div class="player-editor">
            ${renderMusicianRows(session.id, people)}
          </div>
          <button class="small-button add-player" data-action="add-musician" data-id="${session.id}" type="button">Add musician</button>
        </div>
        <label class="detail-field full">
          <span>Notes</span>
          <textarea class="session-field" data-field="notes" rows="4">${escapeHtml(session.notes || "")}</textarea>
        </label>
        <div class="card-actions">
          <span class="autosave-note">Saves automatically</span>
          <button class="small-button danger" data-action="delete" data-id="${session.id}" type="button">Delete</button>
        </div>
      </div>
    </details>
  `;
}

function readForm() {
  return {
    id: fields.id.value || crypto.randomUUID(),
    type: fields.type.value,
    title: fields.title.value.trim(),
    date: fields.date.value,
    time: fields.time.value,
    location: fields.location.value.trim(),
    status: fields.status.value,
    cost: fields.cost.value,
    musicians: [],
    people: "",
    notes: fields.notes.value.trim(),
    manualStatus: false
  };
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  fields.status.value = "booked";
  fields.type.value = "Rehearsal";
  formTitle.textContent = "Add session";
}

function deleteSession(id) {
  const session = sessions.find((item) => item.id === id);
  if (!session) return;
  if (!window.confirm(`Delete "${session.title}"?`)) return;
  window.EllaCalendarSync?.deleteEvent?.("session", session);
  window.EllaFinanceSync?.removeSource("session", session.id);
  sessions = sessions.filter((item) => item.id !== id);
  saveSessions();
  renderSessions();
}

function saveSessionField(element) {
  const id = element.closest(".gig-details")?.dataset.id;
  const field = element.dataset.field;
  const session = sessions.find((item) => item.id === id);
  if (!session || !field) return;
  const previousSession = { ...session };
  session[field] = element.value;
  if (field === "status") session.manualStatus = true;
  saveSessions();
  window.EllaFinanceSync?.syncSource("session", session);
  renderSessions(id);
  syncSessionToCalendar(session, id, previousSession);
}

function updateSessionMusician(element) {
  const id = element.dataset.id;
  const index = Number(element.dataset.index);
  const field = element.dataset.field || "name";
  const session = sessions.find((item) => item.id === id);
  if (!session || Number.isNaN(index)) return;
  const previousSession = {
    ...session,
    musicians: Array.isArray(session.musicians) ? JSON.parse(JSON.stringify(session.musicians)) : session.musicians
  };
  const people = normalizePeople(session);
  while (people.length <= index) people.push({ name: "", status: "pending" });

  if (field === "name" && element.value === newMusicianValue) {
    const newName = window.prompt("Add a new musician");
    if (!newName || !newName.trim()) {
      renderSessions(id);
      return;
    }
    addMusicianContact(newName.trim());
    people[index].name = newName.trim();
    people[index].status = people[index].status || "pending";
  } else if (field === "name") {
    people[index].name = element.value;
  } else {
    people[index].status = element.value === "pending" ? "pending" : "confirmed";
  }

  session.musicians = people.filter((person) => person.name);
  session.people = "";
  saveSessions();
  renderSessions(id);
  syncSessionToCalendar(session, id, previousSession);
}

function addSessionMusician(id) {
  const session = sessions.find((item) => item.id === id);
  if (!session) return;
  const previousSession = {
    ...session,
    musicians: Array.isArray(session.musicians) ? JSON.parse(JSON.stringify(session.musicians)) : session.musicians
  };
  const people = normalizePeople(session);
  if (!people.length) people.push({ name: "", status: "pending" });
  people.push({ name: "", status: "pending" });
  session.musicians = people;
  session.people = "";
  saveSessions();
  renderSessions(id);
  syncSessionToCalendar(session, id, previousSession);
}

function removeSessionMusician(id, index) {
  const session = sessions.find((item) => item.id === id);
  if (!session) return;
  const previousSession = {
    ...session,
    musicians: Array.isArray(session.musicians) ? JSON.parse(JSON.stringify(session.musicians)) : session.musicians
  };
  const people = normalizePeople(session);
  people.splice(index, 1);
  session.musicians = people;
  session.people = "";
  saveSessions();
  renderSessions(id);
  syncSessionToCalendar(session, id, previousSession);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const session = readForm();
  if (!session.title || !session.date) return;
  sessions.push(session);
  saveSessions();
  window.EllaFinanceSync?.syncSource("session", session);
  renderSessions(session.id);
  syncSessionToCalendar(session, session.id);
  resetForm();
});

clearButton.addEventListener("click", resetForm);
newSessionButton?.addEventListener("click", () => {
  resetForm();
  fields.title.focus();
});
syncExistingSessionsButton?.addEventListener("click", syncExistingSessionsToCalendar);

sessionList.addEventListener("change", (event) => {
  if (event.target.matches(".session-field")) saveSessionField(event.target);
  if (event.target.matches(".session-musician-field")) updateSessionMusician(event.target);
});

sessionList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "delete") deleteSession(button.dataset.id);
  if (button.dataset.action === "add-musician") addSessionMusician(button.dataset.id);
  if (button.dataset.action === "remove-musician") removeSessionMusician(button.dataset.id, Number(button.dataset.index));
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderSessions();
  });
});

renderSessions();
window.addEventListener("load", () => {
  window.setTimeout(syncExistingSessionsToCalendar, 1500);
  window.setTimeout(() => window.EllaFinanceSync?.backfill("session"), 2200);
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  if (!event.detail?.keys?.includes(sessionStorageKey)) return;
  window.setTimeout(() => {
    sessions = loadSessions();
    renderSessions();
    window.EllaFinanceSync?.backfill("session");
  }, 0);
});
