const storageKey = "ella-crow-gigs-v2";
const rosterKey = "ella-crow-roster-v1";
const contactStorageKey = "ella-crow-contacts-v1";
const rosterMigrationKey = "ella-crow-roster-migrated-v1";
const defaultRoster = ["George", "Vincent", "Amelia", "Alex", "Simon"];
const newPlayerValue = "__new_player__";

let gigs = loadGigs();
let roster = loadRoster();
let activeFilter = "all";

const form = document.querySelector("#gigForm");
const list = document.querySelector("#gigList");
const emptyState = document.querySelector("#emptyState");
const formTitle = document.querySelector("#formTitle");
const resetButton = document.querySelector("#resetButton");
const newGigButton = document.querySelector("#newGigButton");
const exportButton = document.querySelector("#exportButton");
const syncExistingGigsButton = document.querySelector("#syncExistingGigsButton");

const fields = {
  id: document.querySelector("#gigId"),
  title: document.querySelector("#title"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  venue: document.querySelector("#venue"),
  location: document.querySelector("#location"),
  status: document.querySelector("#status"),
  tickets: document.querySelector("#tickets"),
  cost: document.querySelector("#cost"),
  contact: document.querySelector("#contact"),
  notes: document.querySelector("#notes")
};

function loadGigs() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGigs() {
  localStorage.setItem(storageKey, JSON.stringify(gigs));
}

async function syncGigToCalendar(gig, openId = "", previousGig = null) {
  if (!window.EllaCalendarSync?.syncGig || !gig?.title || !gig?.date) return;
  const result = await window.EllaCalendarSync.syncGig(gig, previousGig);
  if (!result?.eventId) return;

  const freshGig = gigs.find((item) => item.id === gig.id);
  if (!freshGig) return;
  freshGig.googleCalendarEventId = result.eventId;
  freshGig.googleCalendarHtmlLink = result.htmlLink || "";
  freshGig.googleCalendarSyncedAt = result.syncedAt || new Date().toISOString();
  saveGigs();
  if (openId) renderGigs(openId);
  return result;
}

async function syncExistingGigsToCalendar() {
  if (!window.EllaCalendarSync?.syncGig) return;
  const syncableGigs = gigs.filter((gig) => gig.title && gig.date);
  let syncedCount = 0;
  let failedCount = 0;
  window.EllaCalendarSync.report?.(`Syncing ${syncableGigs.length} gigs`, "syncing");
  for (const gig of syncableGigs) {
    const result = await syncGigToCalendar(gig);
    if (result?.eventId) {
      syncedCount += 1;
    } else {
      failedCount += 1;
    }
  }
  if (syncableGigs.length) renderGigs();
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

function loadRoster() {
  migrateRosterToContacts();
  const musicianContacts = loadContacts()
    .filter((contact) => contact.category === "Musicians")
    .map((contact) => contact.name)
    .filter(Boolean);

  return uniqueNames(musicianContacts);
}

function loadLegacyRoster() {
  const stored = localStorage.getItem(rosterKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateRosterToContacts() {
  if (localStorage.getItem(rosterMigrationKey)) return;
  const contacts = loadContacts();
  const names = uniqueNames([...defaultRoster, ...loadLegacyRoster()]);
  let changed = false;

  names.forEach((name) => {
    if (!findMusicianContact(contacts, name)) {
      contacts.push(createMusicianContact(name));
      changed = true;
    }
  });

  if (changed) saveContacts(contacts);
  localStorage.setItem(rosterMigrationKey, "true");
}

function uniqueNames(names) {
  return names
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .filter((name, index, array) => array.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index)
    .sort((a, b) => a.localeCompare(b));
}

function findMusicianContact(contacts, name) {
  return contacts.find((contact) =>
    contact.category === "Musicians" &&
    contact.name.toLowerCase() === name.toLowerCase()
  );
}

function createMusicianContact(name) {
  return {
    id: crypto.randomUUID(),
    category: "Musicians",
    name,
    phone: "",
    email: "",
    instrument: "",
    description: ""
  };
}

function addMusicianContact(name) {
  const contacts = loadContacts();
  if (!findMusicianContact(contacts, name)) {
    contacts.push(createMusicianContact(name));
    saveContacts(contacts);
  }
  roster = loadRoster();
}

function todayStamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function derivedStatus(gig) {
  if (gig.manualStatus) return gig.status || "booked";

  const date = new Date(`${gig.date}T00:00:00`);
  if (date.getTime() < todayStamp()) return "complete";
  return gig.status || "booked";
}

function normaliseGig(gig) {
  return {
    ...gig,
    status: derivedStatus(gig)
  };
}

function refreshPastStatuses() {
  let changed = false;
  gigs = gigs.map((gig) => {
    const status = derivedStatus(gig);
    if (status !== gig.status) changed = true;
    return { ...gig, status };
  });
  if (changed) saveGigs();
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
    long: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date)
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value, fallback = "Not added yet") {
  const clean = String(value ?? "").trim();
  return clean ? escapeHtml(clean) : fallback;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function gigMonthKey(gig) {
  const date = new Date(`${gig.date}T00:00:00`);
  return monthKey(date);
}

function ticketTotalForMonth(targetDate) {
  const targetKey = monthKey(targetDate);
  return gigs
    .filter((gig) => gigMonthKey(gig) === targetKey)
    .reduce((sum, gig) => sum + Number(gig.tickets || 0), 0);
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => {
    if (typeof player === "string") {
      return { name: player, status: "confirmed" };
    }
    return {
      name: player.name || "",
      status: player.status === "pending" ? "pending" : "confirmed"
    };
  });
}

function savedPlayers(players) {
  return normalizePlayers(players).filter((player) => player.name);
}

function statusLabel(status) {
  if (status === "pending") return "TBC";
  return status;
}

function renderSummary() {
  const normalizedGigs = gigs.map(normaliseGig);
  const upcoming = normalizedGigs.filter((gig) => gig.status === "booked").length;
  const pending = normalizedGigs.filter((gig) => gig.status === "pending").length;
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  document.querySelector("#upcomingCount").textContent = upcoming;
  document.querySelector("#pendingCount").textContent = pending;
  document.querySelector("#currentMonthTickets").textContent = ticketTotalForMonth(now);
  document.querySelector("#lastMonthTickets").textContent = ticketTotalForMonth(lastMonth);
}

function renderGigs(openGigId = "") {
  refreshPastStatuses();
  renderSummary();

  const visibleGigs = gigs
    .map(normaliseGig)
    .filter((gig) => activeFilter === "all" || gig.status === activeFilter)
    .sort((a, b) => new Date(`${a.date}T${a.time || "00:00"}`) - new Date(`${b.date}T${b.time || "00:00"}`));

  emptyState.classList.toggle("visible", visibleGigs.length === 0);
  list.innerHTML = visibleGigs.map((gig) => renderGigCard(gig, openGigId)).join("");
}

function renderGigCard(gig, openGigId = "") {
  const date = formatDate(gig.date);
  const openAttribute = gig.id === openGigId ? " open" : "";
  const players = normalizePlayers(gig.players);
  const pendingPlayers = players.filter((player) => player.name && player.status === "pending").length;

  return `
    <details class="gig-card ${gig.status}"${openAttribute}>
      <summary>
        <div class="date-box">
          <strong>${date.day}</strong>
          <span>${date.month}</span>
        </div>
        <div class="gig-title">
          <h3>${escapeHtml(gig.title)}</h3>
          <p>${displayValue(gig.venue)}${gig.location ? `, ${escapeHtml(gig.location)}` : ""} · ${date.long}${gig.time ? ` · ${escapeHtml(gig.time)}` : ""}</p>
        </div>
        <div class="summary-pills">
          <span class="status-pill ${gig.status}">${statusLabel(gig.status)}</span>
          ${pendingPlayers ? `<span class="pending-player-pill">${pendingPlayers} pending</span>` : ""}
        </div>
      </summary>
      <div class="gig-details" data-id="${gig.id}">
        <label class="detail-field full">
          <span>Show name</span>
          <input class="inline-field" data-field="title" value="${escapeHtml(gig.title)}">
        </label>
        <label class="detail-field">
          <span>Date</span>
          <input class="inline-field" data-field="date" type="date" value="${escapeHtml(gig.date)}">
        </label>
        <label class="detail-field">
          <span>Time</span>
          <input class="inline-field" data-field="time" type="time" value="${escapeHtml(gig.time || "")}">
        </label>
        <label class="detail-field">
          <span>Venue</span>
          <input class="inline-field" data-field="venue" value="${escapeHtml(gig.venue || "")}">
        </label>
        <label class="detail-field">
          <span>Location</span>
          <input class="inline-field" data-field="location" value="${escapeHtml(gig.location || "")}">
        </label>
        <label class="detail-field">
          <span>Status</span>
          <select class="inline-field" data-field="status">
            <option value="booked"${gig.status === "booked" ? " selected" : ""}>Booked</option>
            <option value="pending"${gig.status === "pending" ? " selected" : ""}>TBC</option>
            <option value="complete"${gig.status === "complete" ? " selected" : ""}>Complete</option>
          </select>
          ${gig.manualStatus ? '<small class="field-note">Manual status</small>' : ""}
        </label>
        <label class="detail-field">
          <span>Ticket sales</span>
          <input class="inline-field" data-field="tickets" type="number" min="0" step="1" value="${escapeHtml(gig.tickets || "")}">
        </label>
        <label class="detail-field">
          <span>Gig cost</span>
          <input class="inline-field" data-field="cost" type="number" min="0" step="0.01" value="${escapeHtml(gig.cost || "")}">
        </label>
        <label class="detail-field full">
          <span>Contact / promoter</span>
          <input class="inline-field" data-field="contact" value="${escapeHtml(gig.contact || "")}">
        </label>
        <div class="detail-field full">
          <span>People playing</span>
          <div class="player-editor">
            ${renderPlayerRows(gig.id, players)}
          </div>
          <button class="small-button add-player" data-action="add-player" data-id="${gig.id}" type="button">Add another player</button>
        </div>
        <label class="detail-field full">
          <span>Notes</span>
          <textarea class="inline-field" data-field="notes" rows="4">${escapeHtml(gig.notes || "")}</textarea>
        </label>
        <div class="card-actions">
          <span class="autosave-note">Saves automatically</span>
          <button class="small-button danger" data-action="delete" data-id="${gig.id}" type="button">Delete</button>
        </div>
      </div>
    </details>
  `;
}

function renderPlayerRows(gigId, players) {
  const rows = players.length ? players : [{ name: "", status: "pending" }];
  return rows.map((player, index) => `
    <div class="player-row">
      <label>
        <span>Name</span>
        <select class="player-field" data-id="${gigId}" data-player-index="${index}" data-player-field="name">
          <option value="">Choose player</option>
          ${roster.map((name) => `<option value="${escapeHtml(name)}"${player.name === name ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}
          <option value="${newPlayerValue}">Add a new player</option>
        </select>
      </label>
      <label>
        <span>Status</span>
        <select class="player-field" data-id="${gigId}" data-player-index="${index}" data-player-field="status">
          <option value="confirmed"${player.status === "confirmed" ? " selected" : ""}>Confirmed</option>
          <option value="pending"${player.status === "pending" ? " selected" : ""}>Pending</option>
        </select>
      </label>
      <button class="small-button player-remove" data-action="remove-player" data-id="${gigId}" data-player-index="${index}" type="button">Remove</button>
    </div>
  `).join("");
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  fields.status.value = "booked";
  formTitle.textContent = "Add a gig";
}

function readForm() {
  return {
    id: fields.id.value || crypto.randomUUID(),
    title: fields.title.value.trim(),
    date: fields.date.value,
    time: fields.time.value,
    venue: fields.venue.value.trim(),
    location: fields.location.value.trim(),
    status: fields.status.value,
    tickets: fields.tickets.value,
    cost: fields.cost.value,
    players: [],
    contact: fields.contact.value.trim(),
    notes: fields.notes.value.trim(),
    manualStatus: false
  };
}

function deleteGig(id) {
  const gig = gigs.find((item) => item.id === id);
  if (!gig) return;
  const confirmed = window.confirm(`Delete "${gig.title}"?`);
  if (!confirmed) return;

  window.EllaCalendarSync?.deleteEvent?.("gig", gig);
  window.EllaFinanceSync?.removeSource("gig", gig.id);
  gigs = gigs.filter((item) => item.id !== id);
  saveGigs();
  renderGigs();
  resetForm();
}

function saveInlineField(element) {
  const details = element.closest(".gig-details");
  const id = details?.dataset.id;
  const field = element.dataset.field;
  const gig = gigs.find((item) => item.id === id);
  if (!gig || !field) return;
  const previousGig = { ...gig };

  gig[field] = element.value;
  if (field === "status") {
    gig.manualStatus = true;
  }
  saveGigs();
  window.EllaFinanceSync?.syncSource("gig", gig);
  renderGigs(id);
  syncGigToCalendar(gig, id, previousGig);
}

function updatePlayerField(element) {
  const id = element.dataset.id;
  const index = Number(element.dataset.playerIndex);
  const field = element.dataset.playerField;
  const gig = gigs.find((item) => item.id === id);
  if (!gig || Number.isNaN(index) || !field) return;
  const previousGig = { ...gig, players: Array.isArray(gig.players) ? JSON.parse(JSON.stringify(gig.players)) : gig.players };

  const players = normalizePlayers(gig.players);
  while (players.length <= index) {
    players.push({ name: "", status: "pending" });
  }

  if (field === "name" && element.value === newPlayerValue) {
    const newName = window.prompt("Add a new player to the roster");
    if (!newName || !newName.trim()) {
      renderGigs(id);
      return;
    }
    const cleanName = newName.trim();
    addMusicianContact(cleanName);
    players[index].name = cleanName;
  } else {
    players[index][field] = element.value;
  }

  gig.players = savedPlayers(players);
  saveGigs();
  renderGigs(id);
  syncGigToCalendar(gig, id, previousGig);
}

function addPlayer(id) {
  const gig = gigs.find((item) => item.id === id);
  if (!gig) return;
  const previousGig = { ...gig, players: Array.isArray(gig.players) ? JSON.parse(JSON.stringify(gig.players)) : gig.players };
  const players = normalizePlayers(gig.players);
  players.push({ name: "", status: "pending" });
  gig.players = players;
  saveGigs();
  renderGigs(id);
  syncGigToCalendar(gig, id, previousGig);
}

function removePlayer(id, index) {
  const gig = gigs.find((item) => item.id === id);
  if (!gig) return;
  const previousGig = { ...gig, players: Array.isArray(gig.players) ? JSON.parse(JSON.stringify(gig.players)) : gig.players };
  const players = normalizePlayers(gig.players);
  players.splice(index, 1);
  gig.players = players;
  saveGigs();
  renderGigs(id);
  syncGigToCalendar(gig, id, previousGig);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(gigs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ella-crow-gigs.json";
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const gig = readForm();
  const existingIndex = gigs.findIndex((item) => item.id === gig.id);
  let savedGig = gig;
  let previousGig = null;

  if (existingIndex >= 0) {
    previousGig = { ...gigs[existingIndex] };
    savedGig = {
      ...gigs[existingIndex],
      ...gig
    };
    gigs[existingIndex] = savedGig;
  } else {
    gigs.push(savedGig);
  }

  saveGigs();
  window.EllaFinanceSync?.syncSource("gig", savedGig);
  renderGigs();
  syncGigToCalendar(savedGig, "", previousGig);
  resetForm();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  if (button.dataset.action === "delete") deleteGig(id);
  if (button.dataset.action === "add-player") addPlayer(id);
  if (button.dataset.action === "remove-player") removePlayer(id, Number(button.dataset.playerIndex));
});

list.addEventListener("change", (event) => {
  if (event.target.matches(".inline-field")) saveInlineField(event.target);
  if (event.target.matches(".player-field")) updatePlayerField(event.target);
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderGigs();
  });
});

resetButton.addEventListener("click", resetForm);
newGigButton?.addEventListener("click", () => {
  resetForm();
  fields.title.focus();
});
exportButton?.addEventListener("click", downloadJson);
syncExistingGigsButton?.addEventListener("click", syncExistingGigsToCalendar);

renderGigs();
window.addEventListener("load", () => {
  window.setTimeout(syncExistingGigsToCalendar, 1500);
  window.setTimeout(() => window.EllaFinanceSync?.backfill("gig"), 2200);
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  if (!event.detail?.keys?.includes(storageKey)) return;
  window.setTimeout(() => {
    gigs = loadGigs();
    renderGigs();
    window.EllaFinanceSync?.backfill("gig");
  }, 0);
});
