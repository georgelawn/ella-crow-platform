const financeStorageKey = "ella-crow-finance-v1";
const gigStorageKey = "ella-crow-gigs-v2";
const sessionStorageKey = "ella-crow-sessions-v1";
const streamDefinitions = {
  gigs: { label: "Gigs", mark: "G", description: "Shows, rehearsals, travel and live fees" },
  merch: { label: "Merch", mark: "M", description: "Stock, production and merchandise sales" },
  streaming: { label: "Streaming", mark: "S", description: "Royalties, distribution and digital income" }
};

let transactions = loadTransactions();
let editingTransactionId = "";
let activeStream = "gigs";

const form = document.querySelector("#financeForm");
const streamGrid = document.querySelector("#profitStreams");
const streamInspector = document.querySelector("#streamInspector");
const currentMonthLedger = document.querySelector("#currentMonthLedger");
const archive = document.querySelector("#financeArchive");
const emptyState = document.querySelector("#financeEmptyState");
const clearButton = document.querySelector("#clearTransactionButton");

const fields = {
  stream: document.querySelector("#transactionStream"),
  type: document.querySelector("#transactionType"),
  invoiceStatus: document.querySelector("#invoiceStatus"),
  invoiceStatusField: document.querySelector("#invoiceStatusField"),
  invoiceDueDate: document.querySelector("#invoiceDueDate"),
  invoiceDueDateField: document.querySelector("#invoiceDueDateField"),
  date: document.querySelector("#transactionDate"),
  amount: document.querySelector("#transactionAmount"),
  category: document.querySelector("#transactionCategory"),
  description: document.querySelector("#transactionDescription")
};

function inferStream(item) {
  if (streamDefinitions[item.stream]) return item.stream;
  const text = `${item.category || ""} ${item.description || ""}`.toLowerCase();
  if (/(merch|shirt|hoodie|vinyl|cd|stock|print|poster|sticker)/.test(text)) return "merch";
  if (/(stream|spotify|apple music|royalt|distribution|distro|youtube music|digital)/.test(text)) return "streaming";
  return "gigs";
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(financeStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({ ...item, stream: inferStream(item) }));
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(financeStorageKey, JSON.stringify(transactions));
}

function money(value, compact = false) {
  const options = { style: "currency", currency: "GBP" };
  if (compact && Math.abs(Number(value || 0)) >= 1000) {
    options.notation = "compact";
    options.maximumFractionDigits = 1;
  }
  return Number(value || 0).toLocaleString("en-GB", options);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return null;
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(dateString) {
  const date = validDate(dateString);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthKey() {
  return monthKey(localDateKey());
}

function offsetMonthKey(offset) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return monthKey(localDateKey(date));
}

function monthLabel(key, includeYear = true) {
  if (!key) return "Date needed";
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(new Date(`${key}-01T00:00:00`));
}

function shortDate(dateString) {
  const date = validDate(dateString);
  if (!date) return "Date needed";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function totalsFor(items) {
  const revenue = items.filter((item) => item.type === "revenue").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { revenue, expenses, net: revenue - expenses };
}

function itemsForMonth(key, items = transactions) {
  return items.filter((item) => monthKey(item.date) === key);
}

function marginFor(totals) {
  if (!totals.revenue) return null;
  return (totals.net / totals.revenue) * 100;
}

function trendFor(stream) {
  const current = totalsFor(itemsForMonth(currentMonthKey()).filter((item) => item.stream === stream)).net;
  const previous = totalsFor(itemsForMonth(offsetMonthKey(-1)).filter((item) => item.stream === stream)).net;
  if (!previous) return { label: current ? "New activity" : "No movement", direction: current >= 0 ? "up" : "down" };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return {
    label: `${change >= 0 ? "+" : ""}${Math.round(change)}% vs last month`,
    direction: change >= 0 ? "up" : "down"
  };
}

function renderSummary() {
  const monthTotals = totalsFor(itemsForMonth(currentMonthKey()));
  const lastMonthTotals = totalsFor(itemsForMonth(offsetMonthKey(-1)));
  const allTotals = totalsFor(transactions);
  const margin = marginFor(monthTotals);

  document.querySelector("#monthRevenue").textContent = money(monthTotals.revenue);
  document.querySelector("#monthExpenses").textContent = money(monthTotals.expenses);
  document.querySelector("#monthNet").textContent = money(monthTotals.net);
  document.querySelector("#monthNet").className = monthTotals.net < 0 ? "negative" : "positive";
  document.querySelector("#lastMonthNet").textContent = money(lastMonthTotals.net);
  document.querySelector("#allTimeNet").textContent = money(allTotals.net);
  document.querySelector("#monthProfitNote").textContent = margin === null
    ? (monthTotals.expenses ? "Investment is ahead of revenue this month." : "No activity recorded yet.")
    : `${Math.round(margin)}% of revenue is becoming profit.`;
}

function renderProfitStreams() {
  streamGrid.innerHTML = Object.entries(streamDefinitions).map(([key, definition]) => {
    const allItems = transactions.filter((item) => item.stream === key);
    const currentTotals = totalsFor(itemsForMonth(currentMonthKey(), allItems));
    const allTotals = totalsFor(allItems);
    const margin = marginFor(allTotals);
    const trend = trendFor(key);
    return `
      <button class="profit-stream-card${activeStream === key ? " active" : ""}" data-stream="${key}" type="button">
        <span class="stream-mark">${definition.mark}</span>
        <span class="stream-card-copy">
          <strong>${definition.label}</strong>
          <small>${definition.description}</small>
        </span>
        <span class="stream-profit">
          <small>This month profit</small>
          <strong class="${currentTotals.net < 0 ? "negative" : "positive"}">${money(currentTotals.net, true)}</strong>
        </span>
        <span class="stream-card-foot">
          <span class="trend-pill ${trend.direction}">${trend.label}</span>
          <span>${margin === null ? "No margin yet" : `${Math.round(margin)}% lifetime margin`}</span>
        </span>
      </button>
    `;
  }).join("");
}

function streamMonthKeys(items) {
  const keys = [...new Set(items.map((item) => monthKey(item.date)).filter(Boolean))].sort().reverse();
  if (!keys.includes(currentMonthKey())) keys.unshift(currentMonthKey());
  return keys.slice(0, 6);
}

function renderStreamInspector() {
  const definition = streamDefinitions[activeStream];
  const streamItems = transactions.filter((item) => item.stream === activeStream);
  const allTotals = totalsFor(streamItems);
  const margin = marginFor(allTotals);
  const keys = streamMonthKeys(streamItems);
  const maxValue = Math.max(1, ...keys.map((key) => {
    const totals = totalsFor(itemsForMonth(key, streamItems));
    return Math.max(totals.revenue, totals.expenses);
  }));

  const rows = keys.map((key) => {
    const totals = totalsFor(itemsForMonth(key, streamItems));
    return `
      <div class="stream-month-row">
        <strong>${monthLabel(key, false)}</strong>
        <div class="stream-bars" aria-label="${monthLabel(key)} revenue ${money(totals.revenue)}, costs ${money(totals.expenses)}">
          <span class="stream-bar revenue" style="--bar-width:${(totals.revenue / maxValue) * 100}%"></span>
          <span class="stream-bar expense" style="--bar-width:${(totals.expenses / maxValue) * 100}%"></span>
        </div>
        <span>${money(totals.revenue)}</span>
        <span>${money(totals.expenses)}</span>
        <strong class="${totals.net < 0 ? "negative" : "positive"}">${money(totals.net)}</strong>
      </div>
    `;
  }).join("");

  streamInspector.innerHTML = `
    <div class="stream-inspector-heading">
      <div>
        <p class="eyebrow">${definition.label} performance</p>
        <h3>${money(allTotals.net)} lifetime profit</h3>
      </div>
      <div class="stream-inspector-stats">
        <span><strong>${money(allTotals.revenue)}</strong> earned</span>
        <span><strong>${money(allTotals.expenses)}</strong> invested</span>
        <span><strong>${margin === null ? "—" : `${Math.round(margin)}%`}</strong> margin</span>
      </div>
    </div>
    <div class="stream-month-head">
      <span>Month</span><span>Revenue / costs</span><span>In</span><span>Out</span><span>Profit</span>
    </div>
    <div class="stream-months">${rows}</div>
  `;
}

function renderCurrentLedger() {
  const items = transactions
    .filter((item) => monthKey(item.date) === currentMonthKey() || !monthKey(item.date))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  document.querySelector("#monthActivityCount").textContent = `${items.length} ${items.length === 1 ? "entry" : "entries"}`;
  emptyState.classList.toggle("visible", items.length === 0);
  currentMonthLedger.innerHTML = items.map(renderLedgerRow).join("");
}

function renderLedgerRow(item) {
  if (editingTransactionId === item.id) return renderEditableLedgerRow(item);
  const stream = streamDefinitions[item.stream] || streamDefinitions.gigs;
  return `
    <article class="ledger-row ${item.type}" data-id="${escapeHtml(item.id)}">
      <span class="ledger-date">${shortDate(item.date)}</span>
      <span class="ledger-stream">${stream.label}</span>
      <span class="ledger-description">
        <strong>${escapeHtml(item.category || (item.type === "revenue" ? "Revenue" : "Cost"))}</strong>
        <small>${escapeHtml(item.description || "No note")}</small>
      </span>
      <span class="ledger-type">${item.type === "revenue" ? "Money in" : "Cost"}</span>
      <strong class="ledger-amount ${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "−" : "+"}${money(item.amount)}</strong>
      <button class="ledger-edit" data-action="edit" type="button">Edit</button>
    </article>
  `;
}

function streamOptions(selected) {
  return Object.entries(streamDefinitions)
    .map(([key, definition]) => `<option value="${key}"${selected === key ? " selected" : ""}>${definition.label}</option>`)
    .join("");
}

function renderEditableLedgerRow(item) {
  return `
    <article class="ledger-row ledger-editing" data-id="${escapeHtml(item.id)}">
      <label><span>Date</span><input class="finance-field" data-field="date" type="date" value="${escapeHtml(item.date)}"></label>
      <label><span>Stream</span><select class="finance-field" data-field="stream">${streamOptions(item.stream)}</select></label>
      <label><span>Category</span><input class="finance-field" data-field="category" value="${escapeHtml(item.category || "")}"></label>
      <label><span>Type</span><select class="finance-field" data-field="type">
        <option value="revenue"${item.type === "revenue" ? " selected" : ""}>Revenue</option>
        <option value="expense"${item.type === "expense" ? " selected" : ""}>Expense</option>
      </select></label>
      <label><span>Amount</span><input class="finance-field" data-field="amount" type="number" min="0" step="0.01" value="${escapeHtml(item.amount)}"></label>
      <div class="ledger-edit-actions">
        <button class="small-button" data-action="done" type="button">Done</button>
        <button class="small-button danger" data-action="delete" type="button">Delete</button>
      </div>
    </article>
  `;
}

function monthlyArchiveRows(items) {
  const currentYear = new Date().getFullYear();
  const currentKey = currentMonthKey();
  const keys = [...new Set(items.map((item) => monthKey(item.date)).filter((key) =>
    key &&
    key < currentKey &&
    Number(key.slice(0, 4)) === currentYear
  ))]
    .sort()
    .reverse();
  return keys.map((key, index) => {
    const monthItems = itemsForMonth(key, items);
    const totals = totalsFor(monthItems);
    const label = index === 0 && key === offsetMonthKey(-1) ? "Last month" : monthLabel(key, false);
    return `
      <details class="archive-period">
        <summary class="archive-row">
          <strong>${label}</strong>
          <span>${money(totals.revenue)} in</span>
          <span>${money(totals.expenses)} out</span>
          <strong class="${totals.net < 0 ? "negative" : "positive"}">${money(totals.net)}</strong>
        </summary>
        <div class="archive-transactions">${renderArchiveTransactions(monthItems)}</div>
      </details>
    `;
  }).join("");
}

function yearlyArchiveRows(items) {
  const currentYear = new Date().getFullYear();
  const grouped = new Map();
  items.forEach((item) => {
    const key = monthKey(item.date);
    const year = key ? Number(key.slice(0, 4)) : null;
    if (!year || year >= currentYear) return;
    grouped.set(year, [...(grouped.get(year) || []), item]);
  });
  return [...grouped.entries()].sort(([a], [b]) => b - a).map(([year, yearItems]) => {
    const totals = totalsFor(yearItems);
    return `
      <details class="archive-year">
        <summary>
          <strong>${year}</strong>
          <span>${money(totals.revenue)} in</span>
          <span>${money(totals.expenses)} out</span>
          <strong class="${totals.net < 0 ? "negative" : "positive"}">${money(totals.net)}</strong>
        </summary>
        <div class="archive-year-months">${monthlyRowsForYear(year, yearItems)}</div>
      </details>
    `;
  }).join("");
}

function monthlyRowsForYear(year, items) {
  const keys = [...new Set(items.map((item) => monthKey(item.date)).filter(Boolean))].sort().reverse();
  return keys.map((key) => {
    const monthItems = itemsForMonth(key, items);
    const totals = totalsFor(monthItems);
    return `
      <details class="archive-period archive-period-nested">
        <summary class="archive-subrow">
          <strong>${monthLabel(key, false)}</strong>
          <span>${money(totals.revenue)}</span>
          <span>${money(totals.expenses)}</span>
          <strong class="${totals.net < 0 ? "negative" : "positive"}">${money(totals.net)}</strong>
        </summary>
        <div class="archive-transactions">${renderArchiveTransactions(monthItems)}</div>
      </details>
    `;
  }).join("");
}

function renderArchiveTransactions(items) {
  return [...items]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((item) => {
      const stream = streamDefinitions[item.stream] || streamDefinitions.gigs;
      return `
        <div class="archive-transaction">
          <span>${shortDate(item.date)}</span>
          <strong>${stream.label}</strong>
          <span>${escapeHtml(item.category || (item.type === "revenue" ? "Revenue" : "Cost"))}</span>
          <span>${item.type === "revenue" ? "Revenue" : "Cost"}</span>
          <strong class="${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "−" : "+"}${money(item.amount)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderArchive() {
  const months = monthlyArchiveRows(transactions);
  const years = yearlyArchiveRows(transactions);
  const undated = transactions.filter((item) => !monthKey(item.date));
  const undatedTotals = totalsFor(undated);
  const undatedRow = undated.length ? `
    <div class="archive-row warning">
      <strong>Date needed</strong>
      <span>${undated.length} ${undated.length === 1 ? "entry" : "entries"}</span>
      <span>Fix in ledger</span>
      <strong class="${undatedTotals.net < 0 ? "negative" : "positive"}">${money(undatedTotals.net)}</strong>
    </div>
  ` : "";

  archive.innerHTML = months || years || undatedRow
    ? `<div class="archive-months">${months}${undatedRow}</div>${years ? `<div class="archive-years">${years}</div>` : ""}`
    : `<p class="archive-empty">Past months will collect here automatically.</p>`;
}

function renderFinance() {
  renderSummary();
  renderProfitStreams();
  renderStreamInspector();
  renderCurrentLedger();
  renderArchive();
}

function syncInvoiceFields() {
  const showInvoice = fields.type.value === "revenue";
  fields.invoiceStatusField.hidden = !showInvoice;
  fields.invoiceDueDateField.hidden = !showInvoice;
  if (!showInvoice) {
    fields.invoiceStatus.value = "received";
    fields.invoiceDueDate.value = "";
  }
}

function saveFinanceField(element) {
  const row = element.closest(".ledger-row");
  const item = transactions.find((transaction) => transaction.id === row?.dataset.id);
  const field = element.dataset.field;
  if (!item || !field) return;
  item[field] = element.value;
  if (field === "type" && item.type === "expense") {
    item.invoiceStatus = "";
    item.invoiceDueDate = "";
  }
  if (field === "type" && item.type === "revenue" && !item.invoiceStatus) item.invoiceStatus = "pending";
  saveTransactions();
  editingTransactionId = item.id;
  renderFinance();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!fields.date.value || !fields.amount.value || !fields.stream.value) return;
  transactions.push({
    id: crypto.randomUUID(),
    stream: fields.stream.value,
    type: fields.type.value,
    date: fields.date.value,
    amount: fields.amount.value,
    category: fields.category.value.trim(),
    invoiceStatus: fields.type.value === "revenue" ? fields.invoiceStatus.value : "",
    invoiceDueDate: fields.type.value === "revenue" ? (fields.invoiceDueDate.value || fields.date.value) : "",
    description: fields.description.value.trim()
  });
  saveTransactions();
  const selectedStream = fields.stream.value;
  form.reset();
  fields.stream.value = selectedStream;
  syncInvoiceFields();
  activeStream = selectedStream;
  renderFinance();
});

clearButton.addEventListener("click", () => {
  form.reset();
  syncInvoiceFields();
});

fields.type.addEventListener("change", syncInvoiceFields);

streamGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-stream]");
  if (!card) return;
  activeStream = card.dataset.stream;
  renderProfitStreams();
  renderStreamInspector();
});

currentMonthLedger.addEventListener("change", (event) => {
  if (event.target.matches(".finance-field")) saveFinanceField(event.target);
});

currentMonthLedger.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = button?.closest(".ledger-row");
  if (!button || !row) return;
  if (button.dataset.action === "edit") {
    editingTransactionId = row.dataset.id;
    renderCurrentLedger();
  }
  if (button.dataset.action === "done") {
    editingTransactionId = "";
    renderFinance();
  }
  if (button.dataset.action === "delete") {
    transactions = transactions.filter((item) => item.id !== row.dataset.id);
    saveTransactions();
    editingTransactionId = "";
    renderFinance();
  }
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  if (keys.includes(financeStorageKey)) {
    transactions = loadTransactions();
    editingTransactionId = "";
    renderFinance();
  }
  if (keys.some((key) => [gigStorageKey, sessionStorageKey].includes(key))) {
    window.setTimeout(backfillSourceExpenses, 0);
  }
});

function backfillSourceExpenses() {
  window.EllaFinanceSync?.backfill("gig");
  window.EllaFinanceSync?.backfill("session");
  transactions = loadTransactions();
  editingTransactionId = "";
  renderFinance();
}

fields.date.value = localDateKey();
syncInvoiceFields();
renderFinance();
window.addEventListener("load", () => window.setTimeout(backfillSourceExpenses, 2200));
