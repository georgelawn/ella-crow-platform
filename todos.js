const gigStorageKey = "ella-crow-gigs-v2";
const sessionStorageKey = "ella-crow-sessions-v1";
const todoStorageKey = "ella-crow-manual-todos-v1";
const todoSnoozeStorageKey = "ella-crow-todo-snoozes-v1";
const autoTodoCompletionStorageKey = "ella-crow-auto-todo-completions-v1";
const financeStorageKey = "ella-crow-finance-v1";
const opportunityStorageKey = "ella-crow-opportunities-v1";

let gigs = loadGigs();
let sessions = loadSessions();
let manualTodos = loadManualTodos();
let todoSnoozes = loadTodoSnoozes();
let autoTodoCompletions = loadAutoTodoCompletions();
let transactions = loadTransactions();
let opportunities = loadOpportunities();
let activeFilter = "open";

const todoForm = document.querySelector("#todoForm");
const todoList = document.querySelector("#todoList");
const emptyState = document.querySelector("#todoEmptyState");
const clearButton = document.querySelector("#clearTodoButton");

function loadGigs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(gigStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGigs() {
  localStorage.setItem(gigStorageKey, JSON.stringify(gigs));
}

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

function loadManualTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(todoStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadTodoSnoozes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(todoSnoozeStorageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function loadAutoTodoCompletions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(autoTodoCompletionStorageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(financeStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadOpportunities() {
  try {
    const parsed = JSON.parse(localStorage.getItem(opportunityStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(financeStorageKey, JSON.stringify(transactions));
}

function saveOpportunities() {
  localStorage.setItem(opportunityStorageKey, JSON.stringify(opportunities));
}

function saveManualTodos() {
  localStorage.setItem(todoStorageKey, JSON.stringify(manualTodos));
}

function saveTodoSnoozes() {
  localStorage.setItem(todoSnoozeStorageKey, JSON.stringify(todoSnoozes));
}

function saveAutoTodoCompletions() {
  localStorage.setItem(autoTodoCompletionStorageKey, JSON.stringify(autoTodoCompletions));
}

function todayStamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function dateStamp(dateString) {
  return new Date(`${dateString}T00:00:00`).getTime();
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function addMonths(dateString, months) {
  const date = new Date(`${dateString}T00:00:00`);
  const targetDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== targetDay) {
    date.setDate(0);
  }
  return localDateString(date);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function derivedStatus(gig) {
  if (gig.manualStatus) return gig.status || "booked";
  if (dateStamp(gig.date) < todayStamp()) return "complete";
  return gig.status || "booked";
}

function derivedSessionStatus(session) {
  if (session.manualStatus) return session.status || "booked";
  if (dateStamp(session.date) < todayStamp()) return "complete";
  return session.status || "booked";
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];
  return players
    .map((player) => {
      if (typeof player === "string") {
        return { name: player, status: "confirmed" };
      }
      return {
        name: player.name || "",
        status: player.status === "pending" ? "pending" : "confirmed"
      };
    })
    .filter((player) => player.name);
}

function normalizeSessionMusicians(session) {
  if (Array.isArray(session.musicians)) {
    return session.musicians
      .map((person) => {
        if (typeof person === "string") {
          return { name: person, status: "confirmed" };
        }
        return {
          name: person.name || "",
          status: person.status === "pending" ? "pending" : "confirmed"
        };
      })
      .filter((person) => person.name);
  }

  return String(session.people || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, status: "confirmed" }));
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
  const date = String(dateString || "").includes("T")
    ? new Date(dateString)
    : new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function isInBreach(todo) {
  return isDueForTelegram(todo);
}

function isDueForTelegram(todo) {
  return !todo.done && dateStamp(todo.dueDate) <= todayStamp();
}

function snoozedUntil(todo) {
  const date = todoSnoozes[todo.id];
  return date && dateStamp(date) >= todayStamp() ? date : "";
}

function isClosedOpportunity(opportunity) {
  return ["won", "lost", "closed", "complete", "completed"].includes(String(opportunity.status || "").toLowerCase());
}

function getAutoTodos() {
  const completionIds = new Set(Object.keys(autoTodoCompletions));

  const gigTodos = gigs.flatMap((gig) => {
    const status = derivedStatus(gig);
    const isUpcoming = dateStamp(gig.date) >= todayStamp();
    const prsTodo = status === "complete" && !gig.prsSetlistLogged
      ? [{
          id: `gig-prs-setlist:${gig.id}`,
          type: "auto-gig-prs-setlist",
          category: "Gigs",
          title: `Log setlist with PRS: ${gig.title}`,
          dueDate: gig.date,
          done: false,
          gigId: gig.id,
          meta: `${gig.venue || "Venue not added"} · gig on ${formatDate(gig.date)}`
        }]
      : [];

    if (!isUpcoming || !["booked", "pending"].includes(status)) return prsTodo;

    const pendingGigTodo = status === "pending"
      ? [{
          id: `gig-confirm:${gig.id}`,
          type: "auto-gig-confirm",
          category: "Gigs",
          title: `Confirm gig: ${gig.title}`,
          dueDate: addMonths(gig.date, -1),
          done: false,
          gigId: gig.id,
          meta: `${gig.venue || "Venue TBC"} · gig on ${formatDate(gig.date)}`
        }]
      : [];

    const pendingPlayerTodos = normalizePlayers(gig.players)
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.status === "pending")
      .map(({ player, index }) => ({
        id: `gig-player:${gig.id}:${index}:${player.name}`,
        type: "auto-gig-player",
        category: "Gigs",
        title: `Confirm ${player.name} for ${gig.title}`,
        dueDate: addDays(gig.date, -14),
        done: false,
        gigId: gig.id,
        playerIndex: index,
        playerName: player.name,
        meta: `${gig.venue || "Venue TBC"} · gig on ${formatDate(gig.date)}`
      }));

    return [...pendingGigTodo, ...pendingPlayerTodos, ...prsTodo];
  });

  const sessionTodos = sessions.flatMap((session) => {
    const status = derivedSessionStatus(session);
    const isUpcoming = dateStamp(session.date) >= todayStamp();
    if (!isUpcoming || !["booked", "pending"].includes(status)) return [];

    return normalizeSessionMusicians(session)
      .map((musician, index) => ({ musician, index }))
      .filter(({ musician }) => musician.status === "pending")
      .map(({ musician, index }) => ({
        id: `session-musician:${session.id}:${index}:${musician.name}`,
        type: "auto-session-musician",
        category: "Sessions",
        title: `Confirm ${musician.name} for ${session.title}`,
        dueDate: addDays(session.date, -14),
        done: false,
        sessionId: session.id,
        musicianIndex: index,
        musicianName: musician.name,
        meta: `${session.location || "Location TBC"} · ${session.type || "Session"} on ${formatDate(session.date)}`
      }));
  });

  const financeTodos = transactions
    .filter((transaction) => transaction.type === "revenue" && transaction.invoiceStatus === "pending")
    .map((transaction) => ({
      id: `finance-invoice:${transaction.id}`,
      type: "auto-finance-invoice",
      category: "Finance",
      title: `Invoice pending: ${transaction.category || transaction.description || "Revenue"}`,
      dueDate: transaction.invoiceDueDate || transaction.date,
      done: false,
      transactionId: transaction.id,
      meta: `${Number(transaction.amount || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" })} · recorded ${formatDate(transaction.date)}`
    }));

  const opportunityTodos = opportunities
    .filter((opportunity) => !isClosedOpportunity(opportunity) && opportunity.followUpDate && !opportunity.followUpDone)
    .map((opportunity) => ({
      id: `opportunity-follow-up:${opportunity.id}`,
      type: "auto-opportunity-follow-up",
      category: "Opportunities",
      title: `Follow up: ${opportunity.title || "Opportunity"}`,
      dueDate: opportunity.followUpDate,
      done: false,
      opportunityId: opportunity.id,
      meta: `${opportunity.contact || "No contact added"}${opportunity.source ? ` · ${opportunity.source}` : ""}`
    }));

  const openTodos = [...gigTodos, ...sessionTodos, ...financeTodos, ...opportunityTodos];
  const openIds = new Set(openTodos.map((todo) => todo.id));
  const completedTodos = Object.values(autoTodoCompletions)
    .filter((todo) => todo && todo.id && !openIds.has(todo.id))
    .map((todo) => ({
      ...todo,
      done: true,
      completedAt: todo.completedAt || ""
    }));

  return [
    ...openTodos.filter((todo) => !completionIds.has(todo.id)),
    ...completedTodos
  ];
}

function allTodos() {
  return [...getAutoTodos(), ...manualTodos].map((todo) => ({
    ...todo,
    snoozedUntil: snoozedUntil(todo)
  }));
}

function filteredTodos() {
  return allTodos().filter((todo) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "done") return todo.done;
    if (activeFilter === "breach") return isInBreach(todo);
    return !todo.done;
  });
}

function renderSummary() {
  const todos = allTodos();
  document.querySelector("#openCount").textContent = todos.filter((todo) => !todo.done).length;
  document.querySelector("#breachCount").textContent = todos.filter(isInBreach).length;
  document.querySelector("#autoCount").textContent = todos.filter((todo) => todo.type !== "manual").length;
  document.querySelector("#doneCount").textContent = todos.filter((todo) => todo.done).length;
}

function renderTodos() {
  renderSummary();
  const todos = filteredTodos().sort((a, b) => dateStamp(a.dueDate) - dateStamp(b.dueDate));
  emptyState.classList.toggle("visible", todos.length === 0);
  const categories = ["Gigs", "Sessions", "Finance", "Opportunities"];
  todoList.innerHTML = categories.map((category) => {
    const categoryTodos = todos.filter((todo) => todo.category === category);
    if (!categoryTodos.length) return "";
    return `
      <section class="todo-category">
        <div class="contact-section-heading">
          <h3>${category}</h3>
          <span>${categoryTodos.length}</span>
        </div>
        <div class="todo-list">${categoryTodos.map(renderTodo).join("")}</div>
      </section>
    `;
  }).join("");
}

function reloadTodosFromStorage() {
  gigs = loadGigs();
  sessions = loadSessions();
  transactions = loadTransactions();
  opportunities = loadOpportunities();
  manualTodos = loadManualTodos();
  todoSnoozes = loadTodoSnoozes();
  autoTodoCompletions = loadAutoTodoCompletions();
  renderTodos();
}

function renderTodo(todo) {
  const breachClass = isInBreach(todo) ? " breach" : "";
  const doneClass = todo.done ? " done" : "";
  const sourceLabel = todo.type === "manual" ? "Manual" : `Auto from ${todo.category.toLowerCase()}`;
  const disableCompletedAuto = todo.done && todo.type !== "manual";
  const activeSnooze = todo.snoozedUntil;
  const snoozeBadge = activeSnooze ? `<span>Telegram snoozed until ${formatDate(activeSnooze)}</span>` : "";
  const snoozeButton = isDueForTelegram(todo)
    ? activeSnooze
      ? `<button class="small-button" data-action="clear-snooze" data-id="${escapeHtml(todo.id)}" type="button">Clear snooze</button>`
      : `<button class="small-button" data-action="snooze" data-id="${escapeHtml(todo.id)}" type="button">Snooze Telegram</button>`
    : "";

  return `
    <article class="todo-card${breachClass}${doneClass}">
      <div class="todo-check">
        <input type="checkbox" data-action="toggle" data-id="${escapeHtml(todo.id)}" aria-label="Complete ${escapeHtml(todo.title)}" ${todo.done ? "checked" : ""} ${disableCompletedAuto ? "disabled" : ""}>
        <span>${escapeHtml(todo.title)}</span>
      </div>
      <div class="todo-meta">
        <span>${escapeHtml(todo.category)}</span>
        <span>${sourceLabel}</span>
        <span class="due-badge">Due ${formatDate(todo.dueDate)}</span>
        ${snoozeBadge}
      </div>
      ${todo.meta ? `<p>${escapeHtml(todo.meta)}</p>` : ""}
      ${todo.notes ? `<p>${escapeHtml(todo.notes)}</p>` : ""}
      ${snoozeButton ? `<div class="todo-actions">${snoozeButton}</div>` : ""}
      ${todo.type === "manual" ? `<button class="small-button danger todo-delete" data-action="delete" data-id="${escapeHtml(todo.id)}" type="button">Delete</button>` : ""}
    </article>
  `;
}

function snoozeTodo(id) {
  const days = Number(window.prompt("Snooze this task from Telegram for how many days?", "1"));
  if (!Number.isFinite(days) || days < 1) return;
  todoSnoozes[id] = addDays(localDateString(new Date()), Math.floor(days));
  saveTodoSnoozes();
  renderTodos();
}

function clearTodoSnooze(id) {
  delete todoSnoozes[id];
  saveTodoSnoozes();
  renderTodos();
}

function toggleAutoTodo(todo) {
  autoTodoCompletions[todo.id] = {
    ...todo,
    done: true,
    completedAt: new Date().toISOString()
  };
  saveAutoTodoCompletions();

  if (todo.type === "auto-opportunity-follow-up") {
    const opportunity = opportunities.find((item) => item.id === todo.opportunityId);
    if (!opportunity) return;
    opportunity.followUpDone = true;
    saveOpportunities();
    return;
  }

  if (todo.type === "auto-finance-invoice") {
    const transaction = transactions.find((item) => item.id === todo.transactionId);
    if (!transaction) return;
    transaction.invoiceStatus = "received";
    saveTransactions();
    return;
  }

  if (todo.type === "auto-session-musician") {
    const session = sessions.find((item) => item.id === todo.sessionId);
    if (!session) return;
    const musicians = normalizeSessionMusicians(session);
    const musician = musicians.find((item) => item.name === todo.musicianName);
    if (!musician) return;

    musician.status = "confirmed";
    session.musicians = musicians;
    session.people = "";
    saveSessions();
    return;
  }

  const gig = gigs.find((item) => item.id === todo.gigId);
  if (!gig) return;

  if (todo.type === "auto-gig-confirm") {
    gig.status = "booked";
    gig.manualStatus = true;
    saveGigs();
    return;
  }

  if (todo.type === "auto-gig-prs-setlist") {
    gig.prsSetlistLogged = true;
    gig.prsSetlistLoggedAt = new Date().toISOString();
    saveGigs();
    return;
  }

  const players = normalizePlayers(gig.players);
  const player = players.find((item) => item.name === todo.playerName);
  if (!player) return;

  player.status = "confirmed";
  gig.players = players;
  saveGigs();
}

function toggleManualTodo(id, checked) {
  const todo = manualTodos.find((item) => item.id === id);
  if (!todo) return;
  todo.done = checked;
  saveManualTodos();
}

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = document.querySelector("#todoTitle").value.trim();
  const dueDate = document.querySelector("#todoDueDate").value;
  const notes = document.querySelector("#todoNotes").value.trim();
  if (!title || !dueDate) return;

  manualTodos.push({
    id: crypto.randomUUID(),
    type: "manual",
    category: document.querySelector("#category").value,
    title,
    dueDate,
    notes,
    done: false
  });

  saveManualTodos();
  todoForm.reset();
  renderTodos();
});

clearButton.addEventListener("click", () => todoForm.reset());

todoList.addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[data-action="toggle"]');
  if (!checkbox) return;

  const todo = allTodos().find((item) => item.id === checkbox.dataset.id);
  if (!todo) return;

  if (todo.type !== "manual") {
    toggleAutoTodo(todo);
  } else {
    toggleManualTodo(todo.id, checkbox.checked);
  }

  reloadTodosFromStorage();
});

todoList.addEventListener("click", (event) => {
  const snoozeButton = event.target.closest('button[data-action="snooze"]');
  if (snoozeButton) {
    snoozeTodo(snoozeButton.dataset.id);
    return;
  }

  const clearSnoozeButton = event.target.closest('button[data-action="clear-snooze"]');
  if (clearSnoozeButton) {
    clearTodoSnooze(clearSnoozeButton.dataset.id);
    return;
  }

  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;

  manualTodos = manualTodos.filter((todo) => todo.id !== button.dataset.id);
  saveManualTodos();
  renderTodos();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderTodos();
  });
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  const todoKeys = [gigStorageKey, sessionStorageKey, todoStorageKey, todoSnoozeStorageKey, autoTodoCompletionStorageKey, financeStorageKey, opportunityStorageKey];
  if (keys.some((key) => todoKeys.includes(key))) reloadTodosFromStorage();
});

renderTodos();
