const opportunityStorageKey = "ella-crow-opportunities-v1";
const legacyOpportunityKeys = [
  "ella-crow-opportunities",
  "ella-crow-email-opportunities-v1"
];

let opportunities = loadOpportunities();
let editingOpportunityId = "";
let activeFilter = "open";

const form = document.querySelector("#opportunityForm");
const list = document.querySelector("#opportunityList");
const emptyState = document.querySelector("#opportunityEmptyState");
const clearButton = document.querySelector("#clearOpportunityButton");

const fields = {
  title: document.querySelector("#opportunityTitle"),
  contact: document.querySelector("#opportunityContact"),
  status: document.querySelector("#opportunityStatus"),
  followUpDate: document.querySelector("#opportunityFollowUp"),
  source: document.querySelector("#opportunitySource"),
  notes: document.querySelector("#opportunityNotes")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayStamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function dateStamp(dateString) {
  return new Date(`${dateString}T00:00:00`).getTime();
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["won", "lost", "closed", "complete", "completed"].includes(value)) {
    return value === "complete" || value === "completed" ? "closed" : value;
  }
  if (["pitched", "waiting"].includes(value)) return value;
  return "open";
}

function normalizeOpportunity(item) {
  const createdAt = item.createdAt || item.created_at || item.date || new Date().toISOString();
  const title = item.title || item.name || item.subject || "Untitled opportunity";
  const contact = item.contact || item.contactName || item.senderName || item.from || item.company || "";
  const followUpDate = item.followUpDate || item.follow_up_date || item.dueDate || item.nextFollowUp || "";

  return {
    id: item.id || crypto.randomUUID(),
    title,
    contact,
    source: item.source || (item.emailId ? "Email" : ""),
    status: normalizeStatus(item.status),
    followUpDate,
    followUpDone: Boolean(item.followUpDone || item.follow_up_done),
    notes: item.notes || item.description || item.snippet || item.body || "",
    createdAt
  };
}

function parseOpportunityArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeOpportunity) : [];
  } catch {
    return [];
  }
}

function loadOpportunities() {
  const current = parseOpportunityArray(localStorage.getItem(opportunityStorageKey));
  if (current.length) return current;

  for (const key of legacyOpportunityKeys) {
    const legacy = parseOpportunityArray(localStorage.getItem(key));
    if (legacy.length) {
      const value = JSON.stringify(legacy);
      localStorage.setItem(opportunityStorageKey, value);
      setTimeout(() => localStorage.setItem(opportunityStorageKey, value), 700);
      return legacy;
    }
  }

  return [];
}

function saveOpportunities() {
  localStorage.setItem(opportunityStorageKey, JSON.stringify(opportunities));
}

function isClosed(item) {
  return ["won", "lost", "closed"].includes(item.status);
}

function needsFollowUp(item) {
  return !isClosed(item) && item.followUpDate && !item.followUpDone;
}

function isDue(item) {
  return needsFollowUp(item) && dateStamp(item.followUpDate) < todayStamp();
}

function filteredOpportunities() {
  return opportunities.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "closed") return isClosed(item);
    if (activeFilter === "follow-up") return needsFollowUp(item);
    return !isClosed(item);
  });
}

function renderSummary() {
  document.querySelector("#openOpportunityCount").textContent = opportunities.filter((item) => !isClosed(item)).length;
  document.querySelector("#followUpCount").textContent = opportunities.filter(needsFollowUp).length;
  document.querySelector("#dueOpportunityCount").textContent = opportunities.filter(isDue).length;
  document.querySelector("#closedOpportunityCount").textContent = opportunities.filter(isClosed).length;
}

function statusLabel(status) {
  const labels = {
    open: "Open",
    pitched: "Pitched",
    waiting: "Waiting",
    won: "Won",
    lost: "Lost",
    closed: "Closed"
  };
  return labels[status] || "Open";
}

function renderOpportunity(item) {
  if (editingOpportunityId === item.id) return renderEditableOpportunity(item);
  const dueClass = isDue(item) ? " breach" : "";
  const followUp = item.followUpDate
    ? `<span class="due-badge">Follow up ${formatDate(item.followUpDate)}</span>`
    : `<span>No follow-up date</span>`;

  return `
    <article class="todo-card opportunity-card${dueClass}">
      <div class="opportunity-card-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.contact || "No contact added")}</p>
        </div>
        <span class="status-badge">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="todo-meta">
        ${followUp}
        <span>${escapeHtml(item.source || "Manual")}</span>
        ${item.followUpDone ? "<span>Follow-up done</span>" : ""}
      </div>
      ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      <div class="card-actions">
        <button class="small-button" data-action="edit" data-id="${escapeHtml(item.id)}" type="button">Edit</button>
        <button class="small-button danger" data-action="delete" data-id="${escapeHtml(item.id)}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderEditableOpportunity(item) {
  return `
    <article class="todo-card opportunity-card editing" data-id="${escapeHtml(item.id)}">
      <label class="contact-inline full">
        <span>Opportunity</span>
        <input class="opportunity-field" data-field="title" value="${escapeHtml(item.title)}">
      </label>
      <label class="contact-inline full">
        <span>Contact / company</span>
        <input class="opportunity-field" data-field="contact" value="${escapeHtml(item.contact || "")}">
      </label>
      <label class="contact-inline">
        <span>Status</span>
        <select class="opportunity-field" data-field="status">
          ${["open", "pitched", "waiting", "won", "lost", "closed"].map((status) => `
            <option value="${status}"${item.status === status ? " selected" : ""}>${statusLabel(status)}</option>
          `).join("")}
        </select>
      </label>
      <label class="contact-inline">
        <span>Follow-up date</span>
        <input class="opportunity-field" data-field="followUpDate" type="date" value="${escapeHtml(item.followUpDate || "")}">
      </label>
      <label class="contact-inline full">
        <span>Source</span>
        <input class="opportunity-field" data-field="source" value="${escapeHtml(item.source || "")}">
      </label>
      <label class="contact-inline full">
        <span>Notes</span>
        <textarea class="opportunity-field" data-field="notes" rows="4">${escapeHtml(item.notes || "")}</textarea>
      </label>
      <div class="card-actions">
        <span class="contact-save-note">Saves automatically</span>
        <button class="small-button" data-action="done" data-id="${escapeHtml(item.id)}" type="button">Done</button>
        <button class="small-button danger" data-action="delete" data-id="${escapeHtml(item.id)}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderOpportunities() {
  renderSummary();
  const items = filteredOpportunities()
    .sort((a, b) => {
      const aDate = a.followUpDate || localDateString(new Date(a.createdAt));
      const bDate = b.followUpDate || localDateString(new Date(b.createdAt));
      return dateStamp(aDate) - dateStamp(bDate);
    });

  emptyState.classList.toggle("visible", items.length === 0);
  list.innerHTML = items.map(renderOpportunity).join("");
}

function saveOpportunityField(element) {
  const card = element.closest(".opportunity-card");
  const item = opportunities.find((opportunity) => opportunity.id === card?.dataset.id);
  const field = element.dataset.field;
  if (!item || !field) return;

  item[field] = field === "status" ? normalizeStatus(element.value) : element.value;
  if (field === "followUpDate") {
    item.followUpDone = false;
  }
  saveOpportunities();
  editingOpportunityId = item.id;
  renderOpportunities();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = fields.title.value.trim();
  if (!title) return;

  opportunities.push({
    id: crypto.randomUUID(),
    title,
    contact: fields.contact.value.trim(),
    status: normalizeStatus(fields.status.value),
    followUpDate: fields.followUpDate.value,
    followUpDone: false,
    source: fields.source.value.trim(),
    notes: fields.notes.value.trim(),
    createdAt: new Date().toISOString()
  });

  saveOpportunities();
  form.reset();
  renderOpportunities();
});

clearButton.addEventListener("click", () => form.reset());

list.addEventListener("change", (event) => {
  if (event.target.matches(".opportunity-field")) saveOpportunityField(event.target);
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "edit") {
    editingOpportunityId = button.dataset.id;
    renderOpportunities();
  }
  if (button.dataset.action === "done") {
    editingOpportunityId = "";
    renderOpportunities();
  }
  if (button.dataset.action === "delete") {
    opportunities = opportunities.filter((item) => item.id !== button.dataset.id);
    saveOpportunities();
    renderOpportunities();
  }
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderOpportunities();
  });
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  if (![opportunityStorageKey, ...legacyOpportunityKeys].some((key) => keys.includes(key))) return;
  opportunities = loadOpportunities();
  renderOpportunities();
});

renderOpportunities();
