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
let activeCategory = "";
let ledgerPeriod = currentMonthKey();
let ledgerStreamFilter = "all";

const form = document.querySelector("#financeForm");
const streamGrid = document.querySelector("#profitStreams");
const streamInspector = document.querySelector("#streamInspector");
const currentMonthLedger = document.querySelector("#currentMonthLedger");
const ledgerPeriodFilter = document.querySelector("#ledgerPeriodFilter");
const ledgerStreamFilterField = document.querySelector("#ledgerStreamFilter");
const ledgerCategoryFilter = document.querySelector("#ledgerCategoryFilter");
const ledgerCategoryOptions = document.querySelector("#financeCategoryOptions");
const ledgerClearFilters = document.querySelector("#ledgerClearFilters");
const ledgerTitle = document.querySelector("#ledgerTitle");
const pendingInvoiceList = document.querySelector("#pendingInvoiceList");
const pendingInvoiceEmptyState = document.querySelector("#pendingInvoiceEmptyState");
const archive = document.querySelector("#financeArchive");
const emptyState = document.querySelector("#financeEmptyState");
const clearButton = document.querySelector("#clearTransactionButton");
const financeDashboard = document.querySelector(".finance-dashboard");

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
  const revenue = items
    .filter((item) => item.type === "revenue" && item.invoiceStatus !== "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { revenue, expenses, net: revenue - expenses };
}

function pendingInvoices() {
  return transactions.filter((item) => item.type === "revenue" && item.invoiceStatus === "pending");
}

function ledgerTransactions() {
  return transactions.filter((item) => item.type !== "revenue" || item.invoiceStatus !== "pending");
}

function itemsForMonth(key, items = transactions) {
  return items.filter((item) => monthKey(item.date) === key);
}

function categoryName(item) {
  return (item.category || (item.type === "revenue" ? "Revenue" : "Cost")).trim();
}

function categoryKey(value) {
  return String(value || "").trim().toLowerCase();
}

function categoryMatches(item, value) {
  const filter = categoryKey(value);
  if (!filter) return true;
  return categoryKey(categoryName(item)).includes(filter);
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

function ledgerPeriodOptions() {
  const keys = [...new Set(ledgerTransactions().map((item) => monthKey(item.date)).filter(Boolean))]
    .sort()
    .reverse();
  if (!keys.includes(currentMonthKey())) keys.unshift(currentMonthKey());
  if (!keys.includes(offsetMonthKey(-1))) keys.push(offsetMonthKey(-1));
  const monthOptions = [...new Set(keys)].map((key) => {
    const label = key === currentMonthKey()
      ? "This month"
      : key === offsetMonthKey(-1)
        ? "Last month"
        : monthLabel(key);
    return `<option value="${key}"${ledgerPeriod === key ? " selected" : ""}>${label}</option>`;
  }).join("");
  return `
    <option value="all"${ledgerPeriod === "all" ? " selected" : ""}>All time</option>
    ${monthOptions}
    <option value="undated"${ledgerPeriod === "undated" ? " selected" : ""}>Date needed</option>
  `;
}

function renderLedgerControls() {
  const categoryValues = [...new Set(ledgerTransactions().map(categoryName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  ledgerPeriodFilter.innerHTML = ledgerPeriodOptions();
  ledgerStreamFilterField.value = ledgerStreamFilter;
  ledgerCategoryFilter.value = activeCategory;
  ledgerCategoryOptions.innerHTML = categoryValues
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function applyLedgerFilters(items = ledgerTransactions()) {
  return items.filter((item) => {
    const periodMatch = ledgerPeriod === "all"
      || (ledgerPeriod === "undated" ? !monthKey(item.date) : monthKey(item.date) === ledgerPeriod);
    const streamMatch = ledgerStreamFilter === "all" || item.stream === ledgerStreamFilter;
    return periodMatch && streamMatch && categoryMatches(item, activeCategory);
  });
}

function ledgerPeriodLabel() {
  if (ledgerPeriod === "all") return "All ledger activity";
  if (ledgerPeriod === "undated") return "Date needed";
  if (ledgerPeriod === currentMonthKey()) return "This month";
  if (ledgerPeriod === offsetMonthKey(-1)) return "Last month";
  return monthLabel(ledgerPeriod);
}

function selectCategory(category, stream = activeStream) {
  activeCategory = category || "";
  activeStream = stream;
  ledgerStreamFilter = stream || "all";
  ledgerPeriod = "all";
  editingTransactionId = "";
  renderFinance();
  document.querySelector(".current-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const categoryGroups = new Map();
  streamItems.forEach((item) => {
    const key = categoryName(item);
    categoryGroups.set(key, [...(categoryGroups.get(key) || []), item]);
  });
  const categoryRows = [...categoryGroups.entries()]
    .sort(([, aItems], [, bItems]) => Math.abs(totalsFor(bItems).net) - Math.abs(totalsFor(aItems).net))
    .slice(0, 8)
    .map(([category, categoryItems]) => {
      const categoryTotals = totalsFor(categoryItems);
      const pending = categoryItems
        .filter((item) => item.type === "revenue" && item.invoiceStatus === "pending")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return `
        <button class="category-stat-card${categoryKey(activeCategory) === categoryKey(category) && ledgerStreamFilter === activeStream ? " active" : ""}" data-category="${escapeHtml(category)}" data-stream="${activeStream}" type="button">
          <span>
            <strong>${escapeHtml(category)}</strong>
            <small>${categoryItems.length} ${categoryItems.length === 1 ? "entry" : "entries"}${pending ? ` · ${money(pending)} pending` : ""}</small>
          </span>
          <strong class="${categoryTotals.net < 0 ? "negative" : "positive"}">${money(categoryTotals.net)}</strong>
        </button>
      `;
    }).join("");

  const activeCategoryItems = activeCategory
    ? streamItems.filter((item) => categoryMatches(item, activeCategory))
    : [];
  const activeCategoryTotals = totalsFor(activeCategoryItems);
  const activeCategoryAverage = activeCategoryItems.length
    ? activeCategoryItems.reduce((sum, item) => sum + Number(item.amount || 0), 0) / activeCategoryItems.length
    : 0;
  const activeCategoryPending = activeCategoryItems
    .filter((item) => item.type === "revenue" && item.invoiceStatus === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const categoryDetail = activeCategory && activeCategoryItems.length ? `
    <div class="category-detail-panel">
      <div>
        <p class="eyebrow">Category view</p>
        <h3>${escapeHtml(activeCategory)}</h3>
      </div>
      <div class="category-detail-stats">
        <span><strong>${money(activeCategoryTotals.revenue)}</strong> earned</span>
        <span><strong>${money(activeCategoryTotals.expenses)}</strong> spent</span>
        <span><strong>${money(activeCategoryTotals.net)}</strong> net</span>
        <span><strong>${money(activeCategoryAverage)}</strong> average entry</span>
        <span><strong>${activeCategoryPending ? money(activeCategoryPending) : "None"}</strong> pending</span>
      </div>
    </div>
  ` : "";

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
    <div class="category-insights">
      <div class="finance-section-heading">
        <div>
          <p class="eyebrow">Category totals</p>
          <h3>Click a category to inspect and edit it</h3>
        </div>
        <span>${categoryGroups.size} categories</span>
      </div>
      <div class="category-stat-grid">${categoryRows || `<p class="archive-empty">No category activity for this stream yet.</p>`}</div>
      ${categoryDetail}
    </div>
  `;
}

function renderCurrentLedger() {
  renderLedgerControls();
  const items = applyLedgerFilters()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totals = totalsFor(items);
  ledgerTitle.textContent = ledgerPeriodLabel();
  document.querySelector("#monthActivityCount").textContent = `${items.length} ${items.length === 1 ? "entry" : "entries"}`;
  document.querySelector("#monthActivityCount").title = `${money(totals.revenue)} in, ${money(totals.expenses)} out, ${money(totals.net)} net`;
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

function renderPendingInvoices() {
  const items = pendingInvoices().sort((a, b) => (a.invoiceDueDate || a.date || "").localeCompare(b.invoiceDueDate || b.date || ""));
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.querySelector("#pendingInvoiceCount").textContent = items.length
    ? `${money(total)} waiting`
    : "0 unpaid";
  pendingInvoiceEmptyState.classList.toggle("visible", items.length === 0);
  pendingInvoiceList.innerHTML = items.map(renderPendingInvoiceRow).join("");
}

function renderPendingInvoiceRow(item) {
  const stream = streamDefinitions[item.stream] || streamDefinitions.gigs;
  return `
    <article class="pending-invoice-row" data-id="${escapeHtml(item.id)}">
      <span class="pending-invoice-date">
        <small>Due</small>
        <strong>${shortDate(item.invoiceDueDate || item.date)}</strong>
      </span>
      <span class="pending-invoice-copy">
        <strong>${escapeHtml(item.category || "Invoice")}</strong>
        <small>${escapeHtml(stream.label)}${item.description ? ` · ${escapeHtml(item.description)}` : ""}</small>
      </span>
      <strong class="pending-invoice-amount">${money(item.amount)}</strong>
      <label>
        <span>Paid date</span>
        <input class="pending-paid-date" type="date" value="${escapeHtml(localDateKey())}">
      </label>
      <button class="small-button" data-action="mark-paid" type="button">Paid</button>
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
      <label><span>Invoice</span><select class="finance-field" data-field="invoiceStatus"${item.type === "expense" ? " disabled" : ""}>
        <option value="received"${item.invoiceStatus !== "pending" ? " selected" : ""}>Received</option>
        <option value="pending"${item.invoiceStatus === "pending" ? " selected" : ""}>Pending</option>
      </select></label>
      <label><span>Due date</span><input class="finance-field" data-field="invoiceDueDate" type="date" value="${escapeHtml(item.invoiceDueDate || "")}"${item.type === "expense" ? " disabled" : ""}></label>
      <label class="ledger-edit-note"><span>Description</span><input class="finance-field" data-field="description" value="${escapeHtml(item.description || "")}"></label>
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
      if (editingTransactionId === item.id) return renderEditableLedgerRow(item);
      const stream = streamDefinitions[item.stream] || streamDefinitions.gigs;
      return `
        <div class="archive-transaction" data-id="${escapeHtml(item.id)}">
          <span>${shortDate(item.date)}</span>
          <strong>${stream.label}</strong>
          <span>${escapeHtml(item.category || (item.type === "revenue" ? "Revenue" : "Cost"))}</span>
          <span>${item.type === "revenue" ? "Revenue" : "Cost"}</span>
          <strong class="${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "−" : "+"}${money(item.amount)}</strong>
          <button class="ledger-edit" data-action="edit" type="button">Edit</button>
        </div>
      `;
    })
    .join("");
}

function renderArchive() {
  const archivedTransactions = ledgerTransactions();
  const months = monthlyArchiveRows(archivedTransactions);
  const years = yearlyArchiveRows(archivedTransactions);
  const undated = archivedTransactions.filter((item) => !monthKey(item.date));
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
  renderPendingInvoices();
  renderCurrentLedger();
  renderArchive();
}

function renderFinanceWhenUiIdle(callback = null) {
  const render = () => {
    callback?.();
    renderFinance();
  };
  if (window.EllaCloudSync?.deferUiRefresh) {
    window.EllaCloudSync.deferUiRefresh(render);
    return;
  }
  render();
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
  const row = element.closest(".ledger-row, .archive-transaction");
  const item = transactions.find((transaction) => transaction.id === row?.dataset.id);
  const field = element.dataset.field;
  if (!item || !field) return;
  if (item[field] === element.value) return;
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

function finishFinanceDateEdit(element) {
  if (element.matches('.finance-field[type="date"]')) saveFinanceField(element);
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

streamInspector.addEventListener("click", (event) => {
  const card = event.target.closest(".category-stat-card");
  if (!card) return;
  selectCategory(card.dataset.category || "", card.dataset.stream || activeStream);
});

ledgerPeriodFilter.addEventListener("change", () => {
  ledgerPeriod = ledgerPeriodFilter.value;
  editingTransactionId = "";
  renderFinance();
});

ledgerStreamFilterField.addEventListener("change", () => {
  ledgerStreamFilter = ledgerStreamFilterField.value;
  if (ledgerStreamFilter !== "all") activeStream = ledgerStreamFilter;
  editingTransactionId = "";
  renderFinance();
});

ledgerCategoryFilter.addEventListener("change", () => {
  activeCategory = ledgerCategoryFilter.value.trim();
  editingTransactionId = "";
  renderFinance();
});

ledgerClearFilters.addEventListener("click", () => {
  ledgerPeriod = currentMonthKey();
  ledgerStreamFilter = "all";
  activeCategory = "";
  editingTransactionId = "";
  renderFinance();
});

financeDashboard.addEventListener("change", (event) => {
  if (event.target.matches('.finance-field[type="date"]')) return;
  if (event.target.matches(".finance-field")) saveFinanceField(event.target);
});

financeDashboard.addEventListener("focusout", (event) => {
  finishFinanceDateEdit(event.target);
});

financeDashboard.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!event.target.matches('.finance-field[type="date"]')) return;
  event.preventDefault();
  event.target.blur();
});

financeDashboard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = button?.closest(".ledger-row, .archive-transaction");
  if (!button || !row) return;
  if (button.dataset.action === "edit") {
    editingTransactionId = row.dataset.id;
    renderFinance();
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

pendingInvoiceList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='mark-paid']");
  const row = button?.closest(".pending-invoice-row");
  if (!button || !row) return;
  const item = transactions.find((transaction) => transaction.id === row.dataset.id);
  const paidDate = row.querySelector(".pending-paid-date")?.value;
  if (!item || !validDate(paidDate)) return;
  item.invoiceStatus = "received";
  item.date = paidDate;
  saveTransactions();
  renderFinance();
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  if (keys.includes(financeStorageKey)) {
    renderFinanceWhenUiIdle(() => {
      transactions = loadTransactions();
      editingTransactionId = "";
    });
  }
  if (keys.some((key) => [gigStorageKey, sessionStorageKey].includes(key))) {
    window.setTimeout(backfillSourceExpenses, 0);
  }
});

function backfillSourceExpenses() {
  renderFinanceWhenUiIdle(() => {
    window.EllaFinanceSync?.backfill("gig");
    window.EllaFinanceSync?.backfill("session");
    transactions = loadTransactions();
    editingTransactionId = "";
  });
}

fields.date.value = localDateKey();
syncInvoiceFields();
renderFinance();
window.addEventListener("load", () => window.setTimeout(backfillSourceExpenses, 2200));
