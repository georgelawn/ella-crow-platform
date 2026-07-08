const financeStorageKey = "ella-crow-finance-v1";
const financeCloseStorageKey = "ella-crow-finance-closes-v1";
const gigStorageKey = "ella-crow-gigs-v2";
const sessionStorageKey = "ella-crow-sessions-v1";
const tradingAllowance = 12570;
const streamDefinitions = {
  gigs: { label: "Gigs", mark: "G", description: "Shows, rehearsals, travel and live fees" },
  merch: { label: "Merch", mark: "M", description: "Stock, production and merchandise sales" },
  streaming: { label: "Streaming", mark: "S", description: "Royalties, distribution and digital income" }
};
const moneySourceDefinitions = {
  monzo: "Monzo",
  george: "George",
  ella: "Ella"
};
const otherCategoryValue = "__other__";
const financeCategories = [
  "Gig fee",
  "Rehearsal space",
  "Recording / studio",
  "Travel",
  "Food",
  "Equipment",
  "Merch",
  "Bank Fees",
  "Streaming royalties",
  "Distribution / release costs",
  "Marketing",
  "Musician / crew"
];
const legacyCategoryMap = {
  "blue posts": "Gig fee",
  "gig cost": "Musician / crew",
  "gig payment": "Gig fee",
  "the finsbury": "Gig fee",
  theatreship: "Gig fee",
  "pirate - the waiting room": "Rehearsal space",
  "rehearsal - pirate": "Rehearsal space",
  "rehearsal cost": "Rehearsal space",
  "rehersal - pirate": "Rehearsal space",
  "recording at rak": "Recording / studio",
  "recording cost": "Recording / studio",
  "session cost": "Musician / crew",
  transport: "Travel",
  travel: "Travel",
  "food @ gig": "Food",
  "food for band": "Food",
  equipment: "Equipment",
  merch: "Merch",
  "merch stock": "Merch",
  fees: "Bank Fees"
};

let transactions = loadTransactions();
let monthlyCloses = loadMonthlyCloses();
let editingTransactionId = "";
let activeStream = "all";
let activeCategory = "";
let ledgerPeriod = currentMonthKey();
let ledgerStreamFilter = "all";
let activeCloseMonth = offsetMonthKey(-1);

const form = document.querySelector("#financeForm");
const streamOverviewBar = document.querySelector("#streamOverviewBar");
const streamGrid = document.querySelector("#profitStreams");
const streamInspector = document.querySelector("#streamInspector");
const monthlyClosePanel = document.querySelector("#monthlyClosePanel");
const taxYearPanel = document.querySelector("#taxYearPanel");
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
  paidFrom: document.querySelector("#transactionPaidFrom"),
  category: document.querySelector("#transactionCategory"),
  categoryOther: document.querySelector("#transactionCategoryOther"),
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
    return parsed.map(normalizeTransaction);
  } catch {
    return [];
  }
}

function normalizeTransaction(item) {
  const type = item.type === "expense" ? "expense" : "revenue";
  const paidFrom = type === "revenue"
    ? "monzo"
    : (moneySourceDefinitions[item.paidFrom] ? item.paidFrom : "monzo");
  return {
    ...item,
    type,
    stream: inferStream(item),
    paidFrom,
    category: normalizeFinanceCategory(item.category),
    taxIncluded: item.taxIncluded === false ? false : true
  };
}

function loadMonthlyCloses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(financeCloseStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(financeStorageKey, JSON.stringify(transactions));
}

function saveMonthlyCloses() {
  localStorage.setItem(financeCloseStorageKey, JSON.stringify(monthlyCloses));
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

function normalizeFinanceCategory(value) {
  const category = String(value || "").trim();
  if (!category) return "";
  const existing = financeCategories.find((item) => item.toLowerCase() === category.toLowerCase());
  if (existing) return existing;
  return legacyCategoryMap[category.toLowerCase()] || category;
}

function categorySelectValue(value) {
  const category = normalizeFinanceCategory(value);
  return financeCategories.includes(category) ? category : otherCategoryValue;
}

function customCategoryValue(value) {
  const category = normalizeFinanceCategory(value);
  return financeCategories.includes(category) ? "" : category;
}

function categoryOptions(selected) {
  const selectValue = categorySelectValue(selected);
  return [
    ...financeCategories.map((category) => `<option value="${escapeHtml(category)}"${selectValue === category ? " selected" : ""}>${escapeHtml(category)}</option>`),
    `<option value="${otherCategoryValue}"${selectValue === otherCategoryValue ? " selected" : ""}>Other</option>`
  ].join("");
}

function selectedCategoryValue(select, otherInput = null) {
  if (select.value === otherCategoryValue) return normalizeFinanceCategory(otherInput?.value || "");
  return normalizeFinanceCategory(select.value);
}

function syncCategoryOtherField(select, otherInput = null) {
  if (!select || !otherInput) return;
  const showOther = select.value === otherCategoryValue;
  otherInput.hidden = !showOther;
  otherInput.required = showOther;
  if (showOther) otherInput.focus();
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

function previousMonthKey(key) {
  const date = validDate(`${key}-01`);
  if (!date) return "";
  date.setMonth(date.getMonth() - 1);
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

function numericAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function totalsFor(items) {
  const revenue = items
    .filter((item) => item.type === "revenue" && item.invoiceStatus !== "pending")
    .reduce((sum, item) => sum + numericAmount(item.amount), 0);
  const expenses = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + numericAmount(item.amount), 0);
  return { revenue, expenses, net: revenue - expenses };
}

function monzoMovementFor(items) {
  const revenue = items
    .filter((item) => item.type === "revenue" && item.invoiceStatus !== "pending")
    .reduce((sum, item) => sum + numericAmount(item.amount), 0);
  const expenses = items
    .filter((item) => item.type === "expense" && (item.paidFrom || "monzo") === "monzo")
    .reduce((sum, item) => sum + numericAmount(item.amount), 0);
  return { revenue, expenses, net: revenue - expenses };
}

function personalSpendFor(items, person) {
  return items
    .filter((item) => item.type === "expense" && item.paidFrom === person)
    .reduce((sum, item) => sum + numericAmount(item.amount), 0);
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

function closeId(key) {
  return `finance-close:${key}`;
}

function monthEndDate(key) {
  const date = validDate(`${key}-01`);
  if (!date) return "";
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return localDateKey(date);
}

function closeForMonth(key) {
  return monthlyCloses.find((close) => close.monthKey === key);
}

function monthIsLocked(key) {
  return closeForMonth(key)?.status === "closed";
}

function transactionIsLocked(item) {
  const key = monthKey(item.date);
  return Boolean(key && monthIsLocked(key));
}

function previousCloseForMonth(key) {
  const previousKey = previousMonthKey(key);
  return previousKey ? closeForMonth(previousKey) : null;
}

function openingBalanceForMonth(key) {
  const close = closeForMonth(key);
  if (close && close.openingBalance !== "" && close.openingBalance !== undefined) return numericAmount(close.openingBalance);
  const previousClose = previousCloseForMonth(key);
  if (previousClose && previousClose.actualBalance !== "" && previousClose.actualBalance !== undefined) return numericAmount(previousClose.actualBalance);
  return 0;
}

function itemsForTaxYear(yearStart) {
  const start = `${yearStart}-04-06`;
  const end = `${yearStart + 1}-04-05`;
  return ledgerTransactions().filter((item) => item.taxIncluded !== false && item.date >= start && item.date <= end);
}

function currentTaxYearStart() {
  const today = new Date();
  const boundary = new Date(`${today.getFullYear()}-04-06T00:00:00`);
  return today >= boundary ? today.getFullYear() : today.getFullYear() - 1;
}

function ensureMonthlyClose(key = offsetMonthKey(-1)) {
  if (!key || closeForMonth(key)) return;
  monthlyCloses.push({
    id: closeId(key),
    monthKey: key,
    status: "open",
    openingBalance: "",
    actualBalance: "",
    payoutMode: "ask",
    customSettlement: "",
    agreementNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: "",
    reopenedAt: ""
  });
  saveMonthlyCloses();
}

function ensureMonthlyCloseWorkflow() {
  const day = new Date().getDate();
  if (day < 1) return;
  const key = offsetMonthKey(-1);
  ensureMonthlyClose(key);
  if (!activeCloseMonth) activeCloseMonth = key;
}

function marginFor(totals) {
  if (!totals.revenue) return null;
  return (totals.net / totals.revenue) * 100;
}

function projectionForMonth(key) {
  const items = itemsForMonth(key, ledgerTransactions());
  const totals = totalsFor(items);
  const monzo = monzoMovementFor(items);
  const georgePaid = personalSpendFor(items, "george");
  const ellaPaid = personalSpendFor(items, "ella");
  const openingBalance = openingBalanceForMonth(key);
  const expectedClosing = openingBalance + monzo.net;
  return { items, totals, monzo, georgePaid, ellaPaid, openingBalance, expectedClosing };
}

function settlementForMonth(key, payoutMode = "ask") {
  const projection = projectionForMonth(key);
  const { totals, georgePaid, ellaPaid } = projection;
  const personDifference = Math.abs(georgePaid - ellaPaid) / 2;
  const higherPayer = georgePaid > ellaPaid ? "George" : ellaPaid > georgePaid ? "Ella" : "";
  const lowerPayer = georgePaid > ellaPaid ? "Ella" : ellaPaid > georgePaid ? "George" : "";

  if (totals.net < 0) {
    return {
      label: personDifference ? `${lowerPayer} owes ${higherPayer} ${money(personDifference)}` : "No settlement",
      detail: personDifference
        ? `${higherPayer} personally covered more of a loss-making month.`
        : "Personal spending is already balanced.",
      georgePayout: 0,
      ellaPayout: 0,
      personToPerson: personDifference
    };
  }

  const georgeReimbursement = georgePaid;
  const ellaReimbursement = ellaPaid;
  const profitShare = payoutMode === "payout" ? totals.net / 2 : 0;
  const georgePayout = georgeReimbursement + profitShare;
  const ellaPayout = ellaReimbursement + profitShare;

  if (payoutMode === "retain") {
    return {
      label: georgePayout || ellaPayout ? `${money(georgePayout + ellaPayout)} reimbursements` : "Retain in Monzo",
      detail: "Profit retained; only personal costs are suggested for reimbursement.",
      georgePayout,
      ellaPayout,
      personToPerson: 0
    };
  }

  if (payoutMode === "payout") {
    return {
      label: `${money(georgePayout)} George / ${money(ellaPayout)} Ella`,
      detail: "Profit split 50/50 after personal cost reimbursement.",
      georgePayout,
      ellaPayout,
      personToPerson: 0
    };
  }

  return {
    label: "Decision needed",
    detail: "Choose whether to retain profit, pay out 50/50, or record a custom settlement.",
    georgePayout,
    ellaPayout,
    personToPerson: 0
  };
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
  const currentProjection = projectionForMonth(currentMonthKey());
  const currentSettlement = settlementForMonth(activeCloseMonth, closeForMonth(activeCloseMonth)?.payoutMode || "ask");
  const pendingTotal = pendingInvoices().reduce((sum, item) => sum + numericAmount(item.amount), 0);
  const change = monthTotals.net - lastMonthTotals.net;

  document.querySelector("#expectedBalance").textContent = money(currentProjection.expectedClosing);
  document.querySelector("#balanceNote").textContent = `${money(currentProjection.monzo.revenue)} received, ${money(currentProjection.monzo.expenses)} paid from Monzo this month.`;
  document.querySelector("#monthNet").textContent = money(monthTotals.net);
  document.querySelector("#monthNet").className = monthTotals.net < 0 ? "negative" : "positive";
  document.querySelector("#monthChange").textContent = `${change >= 0 ? "+" : ""}${money(change)}`;
  document.querySelector("#monthChange").className = change < 0 ? "negative" : "positive";
  document.querySelector("#pendingIncomeTotal").textContent = money(pendingTotal);
  document.querySelector("#settlementDue").textContent = currentSettlement.label;
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

function renderStreamOverviewBar() {
  const items = transactions;
  const totals = totalsFor(items);
  const currentTotals = totalsFor(itemsForMonth(currentMonthKey(), items));
  const pendingTotal = pendingInvoices().reduce((sum, item) => sum + numericAmount(item.amount), 0);
  const streamCount = Object.keys(streamDefinitions).filter((stream) => items.some((item) => item.stream === stream)).length;
  const margin = marginFor(totals);

  streamOverviewBar.innerHTML = `
    <button class="stream-overview-button${activeStream === "all" ? " active" : ""}" data-stream="all" type="button">
      <span class="stream-mark">A</span>
      <span class="stream-card-copy">
        <strong>All streams</strong>
        <small>Gigs, merch and streaming together</small>
      </span>
      <span class="stream-profit">
        <small>This month profit</small>
        <strong class="${currentTotals.net < 0 ? "negative" : "positive"}">${money(currentTotals.net, true)}</strong>
      </span>
      <span class="stream-card-foot">
        <span class="trend-pill">${streamCount || Object.keys(streamDefinitions).length} streams</span>
        <span>${money(totals.net)} lifetime${pendingTotal ? ` · ${money(pendingTotal)} pending` : ""}${margin === null ? "" : ` · ${Math.round(margin)}% margin`}</span>
      </span>
    </button>
  `;
}

function closeMonthOptions() {
  const keys = [...new Set([
    offsetMonthKey(-1),
    currentMonthKey(),
    ...monthlyCloses.map((close) => close.monthKey),
    ...ledgerTransactions().map((item) => monthKey(item.date)).filter(Boolean)
  ])].sort().reverse();
  return keys.map((key) => `<option value="${key}"${activeCloseMonth === key ? " selected" : ""}>${monthLabel(key)}</option>`).join("");
}

function renderMonthlyClose() {
  ensureMonthlyClose(activeCloseMonth);
  const close = closeForMonth(activeCloseMonth);
  const projection = projectionForMonth(activeCloseMonth);
  const settlement = settlementForMonth(activeCloseMonth, close.payoutMode);
  const discrepancy = close.actualBalance === "" || close.actualBalance === undefined
    ? null
    : numericAmount(close.actualBalance) - projection.expectedClosing;
  const isClosed = close.status === "closed";

  monthlyClosePanel.innerHTML = `
    <div class="finance-section-heading">
      <div>
        <p class="eyebrow">Monthly close</p>
        <h2>Monzo sanity check</h2>
      </div>
      <span>${isClosed ? "Locked" : "Open review"}</span>
    </div>
    <div class="close-command-row">
      <label>
        Close month
        <select class="close-field" data-field="activeCloseMonth">${closeMonthOptions()}</select>
      </label>
      <button class="ghost-button" data-action="${isClosed ? "reopen-close" : "close-month"}" type="button">${isClosed ? "Reopen month" : "Lock month"}</button>
    </div>
    <div class="close-summary-grid">
      <article><span>${money(projection.openingBalance)}</span><p>Expected opening</p></article>
      <article><span>${money(projection.monzo.revenue)}</span><p>Received into Monzo</p></article>
      <article><span>${money(projection.monzo.expenses)}</span><p>Paid from Monzo</p></article>
      <article><span>${money(projection.expectedClosing)}</span><p>Expected closing</p></article>
      <article><span>${money(projection.totals.net)}</span><p>Business profit/loss</p></article>
      <article><span>${money(projection.georgePaid)}</span><p>George paid personally</p></article>
      <article><span>${money(projection.ellaPaid)}</span><p>Ella paid personally</p></article>
      <article><span>${discrepancy === null ? "Needed" : money(discrepancy)}</span><p>Monzo discrepancy</p></article>
    </div>
    <div class="close-review-grid">
      <label>
        Actual Monzo balance
        <input class="close-field" data-field="actualBalance" type="number" min="0" step="0.01" value="${escapeHtml(close.actualBalance || "")}" ${isClosed ? "disabled" : ""}>
      </label>
      <label>
        Opening balance override
        <input class="close-field" data-field="openingBalance" type="number" min="0" step="0.01" value="${escapeHtml(close.openingBalance || "")}" ${isClosed ? "disabled" : ""}>
      </label>
      <label>
        Month decision
        <select class="close-field" data-field="payoutMode" ${isClosed ? "disabled" : ""}>
          <option value="ask"${close.payoutMode === "ask" ? " selected" : ""}>Decide this month</option>
          <option value="retain"${close.payoutMode === "retain" ? " selected" : ""}>Keep profit in Monzo</option>
          <option value="payout"${close.payoutMode === "payout" ? " selected" : ""}>Pay out 50/50</option>
          <option value="custom"${close.payoutMode === "custom" ? " selected" : ""}>Custom settlement</option>
        </select>
      </label>
      <label>
        Custom settlement
        <input class="close-field" data-field="customSettlement" value="${escapeHtml(close.customSettlement || "")}" placeholder="Optional" ${isClosed ? "disabled" : ""}>
      </label>
      <label class="close-note-field">
        Agreement note
        <textarea class="close-field" data-field="agreementNote" rows="3" placeholder="Why did you retain, pay out, or adjust this month?" ${isClosed ? "disabled" : ""}>${escapeHtml(close.agreementNote || "")}</textarea>
      </label>
    </div>
    <div class="settlement-strip">
      <div>
        <p class="eyebrow">Suggested settlement</p>
        <strong>${close.payoutMode === "custom" && close.customSettlement ? escapeHtml(close.customSettlement) : escapeHtml(settlement.label)}</strong>
        <span>${escapeHtml(settlement.detail)}</span>
      </div>
      <div>
        <span>George</span>
        <strong>${money(settlement.georgePayout)}</strong>
      </div>
      <div>
        <span>Ella</span>
        <strong>${money(settlement.ellaPayout)}</strong>
      </div>
    </div>
  `;
}

function renderTaxYearPanel() {
  const yearStart = currentTaxYearStart();
  const items = itemsForTaxYear(yearStart);
  const totals = totalsFor(items);
  const taxableAboveAllowance = Math.max(0, totals.net - tradingAllowance);
  const remainingAllowance = Math.max(0, tradingAllowance - totals.net);
  const expenseItems = items.filter((item) => item.type === "expense");
  const revenueItems = items.filter((item) => item.type === "revenue");

  taxYearPanel.innerHTML = `
    <details>
      <summary class="tax-summary-row">
        <span>
          <small>Tax-Year Profit</small>
          <strong>${money(totals.net)}</strong>
        </span>
        <span>${yearStart}/${String(yearStart + 1).slice(2)}</span>
        <span>${remainingAllowance ? `${money(remainingAllowance)} before allowance marker` : `${money(taxableAboveAllowance)} above allowance marker`}</span>
      </summary>
      <div class="tax-detail-grid">
        <article><span>${money(totals.revenue)}</span><p>Included revenue</p></article>
        <article><span>${money(totals.expenses)}</span><p>Allowable costs tracked</p></article>
        <article><span>${revenueItems.length}</span><p>Revenue entries</p></article>
        <article><span>${expenseItems.length}</span><p>Expense entries</p></article>
      </div>
      <p class="tax-note">This tracks Ella Crow trading profit only. It does not treat George's informal 50/50 payout as tax-deductible and does not include Ella's other income.</p>
      <div class="tax-audit-list">
        ${items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((item) => `
          <div class="tax-audit-row">
            <span>${shortDate(item.date)}</span>
            <strong>${escapeHtml(categoryName(item))}</strong>
            <span>${item.type === "revenue" ? "Revenue" : "Cost"}</span>
            <span>${escapeHtml(moneySourceDefinitions[item.paidFrom] || "Monzo")}</span>
            <strong class="${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "-" : "+"}${money(item.amount)}</strong>
          </div>
        `).join("") || `<p class="archive-empty">No tax-year entries yet.</p>`}
      </div>
    </details>
  `;
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
  ledgerStreamFilter = stream === "all" ? "all" : (stream || "all");
  ledgerPeriod = "all";
  editingTransactionId = "";
  renderFinance();
  document.querySelector(".current-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectStream(stream) {
  activeStream = streamDefinitions[stream] ? stream : "all";
  ledgerStreamFilter = activeStream === "all" ? "all" : activeStream;
  activeCategory = "";
  editingTransactionId = "";
  renderFinance();
}

function streamMonthKeys(items) {
  const keys = [...new Set(items.map((item) => monthKey(item.date)).filter(Boolean))].sort().reverse();
  if (!keys.includes(currentMonthKey())) keys.unshift(currentMonthKey());
  return keys.slice(0, 6);
}

function renderStreamInspector() {
  const viewingAllStreams = activeStream === "all";
  const definition = viewingAllStreams
    ? { label: "All streams", description: "Gigs, merch and streaming together" }
    : streamDefinitions[activeStream];
  const streamItems = viewingAllStreams
    ? transactions
    : transactions.filter((item) => item.stream === activeStream);
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
  const paidFrom = moneySourceDefinitions[item.paidFrom] || "Monzo";
  const locked = transactionIsLocked(item);
  return `
    <article class="ledger-row ${item.type}" data-id="${escapeHtml(item.id)}">
      <span class="ledger-date">${shortDate(item.date)}</span>
      <span class="ledger-stream">${stream.label}</span>
      <span class="ledger-description">
        <strong>${escapeHtml(item.category || (item.type === "revenue" ? "Revenue" : "Cost"))}</strong>
        <small>${escapeHtml(item.description || "No note")} · ${item.type === "revenue" ? "Received into" : "Paid from"} ${escapeHtml(paidFrom)}</small>
      </span>
      <span class="ledger-type">${item.type === "revenue" ? "Money in" : "Cost"}</span>
      <strong class="ledger-amount ${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "−" : "+"}${money(item.amount)}</strong>
      <button class="ledger-edit" data-action="edit" type="button" ${locked ? "disabled" : ""}>${locked ? "Locked" : "Edit"}</button>
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

function moneySourceOptions(selected, type = "expense") {
  return Object.entries(moneySourceDefinitions)
    .filter(([key]) => type === "expense" || key === "monzo")
    .map(([key, label]) => `<option value="${key}"${selected === key ? " selected" : ""}>${label}</option>`)
    .join("");
}

function renderEditableLedgerRow(item) {
  const locked = transactionIsLocked(item);
  return `
    <article class="ledger-row ledger-editing" data-id="${escapeHtml(item.id)}">
      <label><span>Date</span><input class="finance-field" data-field="date" type="date" value="${escapeHtml(item.date)}" ${locked ? "disabled" : ""}></label>
      <label><span>Stream</span><select class="finance-field" data-field="stream" ${locked ? "disabled" : ""}>${streamOptions(item.stream)}</select></label>
      <label class="finance-category-field"><span>Category</span><span class="category-select-group"><select class="finance-field category-select" data-field="category" ${locked ? "disabled" : ""}>${categoryOptions(item.category)}</select><input class="finance-field category-other-field" data-field="category" value="${escapeHtml(customCategoryValue(item.category))}" placeholder="Custom category" ${categorySelectValue(item.category) === otherCategoryValue ? "required" : "hidden"} ${locked ? "disabled" : ""}></span></label>
      <label><span>Type</span><select class="finance-field" data-field="type" ${locked ? "disabled" : ""}>
        <option value="revenue"${item.type === "revenue" ? " selected" : ""}>Revenue</option>
        <option value="expense"${item.type === "expense" ? " selected" : ""}>Expense</option>
      </select></label>
      <label><span>Amount</span><input class="finance-field" data-field="amount" type="number" min="0" step="0.01" value="${escapeHtml(item.amount)}" ${locked ? "disabled" : ""}></label>
      <label><span>Paid from</span><select class="finance-field" data-field="paidFrom"${item.type === "revenue" || locked ? " disabled" : ""}>${moneySourceOptions(item.paidFrom, item.type)}</select></label>
      <label><span>Invoice</span><select class="finance-field" data-field="invoiceStatus"${item.type === "expense" || locked ? " disabled" : ""}>
        <option value="received"${item.invoiceStatus !== "pending" ? " selected" : ""}>Received</option>
        <option value="pending"${item.invoiceStatus === "pending" ? " selected" : ""}>Pending</option>
      </select></label>
      <label><span>Due date</span><input class="finance-field" data-field="invoiceDueDate" type="date" value="${escapeHtml(item.invoiceDueDate || "")}"${item.type === "expense" || locked ? " disabled" : ""}></label>
      <label class="ledger-edit-note"><span>Description</span><input class="finance-field" data-field="description" value="${escapeHtml(item.description || "")}" ${locked ? "disabled" : ""}></label>
      <div class="ledger-edit-actions">
        <button class="small-button" data-action="done" type="button">Done</button>
        <button class="small-button danger" data-action="delete" type="button" ${locked ? "disabled" : ""}>Delete</button>
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
      const paidFrom = moneySourceDefinitions[item.paidFrom] || "Monzo";
      const locked = transactionIsLocked(item);
      return `
        <div class="archive-transaction" data-id="${escapeHtml(item.id)}">
          <span>${shortDate(item.date)}</span>
          <strong>${stream.label}</strong>
          <span>${escapeHtml(item.category || (item.type === "revenue" ? "Revenue" : "Cost"))}</span>
          <span>${item.type === "revenue" ? "Monzo" : escapeHtml(paidFrom)}</span>
          <strong class="${item.type === "expense" ? "negative" : "positive"}">${item.type === "expense" ? "−" : "+"}${money(item.amount)}</strong>
          <button class="ledger-edit" data-action="edit" type="button" ${locked ? "disabled" : ""}>${locked ? "Locked" : "Edit"}</button>
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
  renderMonthlyClose();
  renderTaxYearPanel();
  renderStreamOverviewBar();
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
  fields.paidFrom.disabled = showInvoice;
  if (!showInvoice) {
    fields.invoiceStatus.value = "received";
    fields.invoiceDueDate.value = "";
  } else {
    fields.paidFrom.value = "monzo";
  }
}

function saveFinanceField(element) {
  const row = element.closest(".ledger-row, .archive-transaction");
  const item = transactions.find((transaction) => transaction.id === row?.dataset.id);
  const field = element.dataset.field;
  if (!item || !field) return;
  if (transactionIsLocked(item)) return;
  let value = element.value;
  if (field === "category") {
    if (element.matches("select") && element.value === otherCategoryValue) {
      syncCategoryOtherField(element, row.querySelector(".category-other-field"));
      return;
    }
    value = normalizeFinanceCategory(value);
  }
  if (item[field] === value) return;
  item[field] = value;
  if (field === "type" && item.type === "expense") {
    item.invoiceStatus = "";
    item.invoiceDueDate = "";
    if (!moneySourceDefinitions[item.paidFrom]) item.paidFrom = "monzo";
  }
  if (field === "type" && item.type === "revenue") {
    if (!item.invoiceStatus) item.invoiceStatus = "pending";
    item.paidFrom = "monzo";
  }
  saveTransactions();
  editingTransactionId = item.id;
}

function finishFinanceDateEdit(element) {
  if (element.matches('.finance-field[type="date"]')) saveFinanceField(element);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const category = selectedCategoryValue(fields.category, fields.categoryOther);
  if (!fields.date.value || !fields.amount.value || !fields.stream.value || !category) return;
  transactions.push({
    id: crypto.randomUUID(),
    stream: fields.stream.value,
    type: fields.type.value,
    date: fields.date.value,
    amount: fields.amount.value,
    paidFrom: fields.type.value === "revenue" ? "monzo" : fields.paidFrom.value,
    category,
    invoiceStatus: fields.type.value === "revenue" ? fields.invoiceStatus.value : "",
    invoiceDueDate: fields.type.value === "revenue" ? (fields.invoiceDueDate.value || fields.date.value) : "",
    description: fields.description.value.trim()
  });
  saveTransactions();
  const selectedStream = fields.stream.value;
  form.reset();
  fields.stream.value = selectedStream;
  fields.category.value = financeCategories[0];
  syncCategoryOtherField(fields.category, fields.categoryOther);
  syncInvoiceFields();
  activeStream = selectedStream;
  renderFinance();
});

clearButton.addEventListener("click", () => {
  form.reset();
  fields.category.value = financeCategories[0];
  syncCategoryOtherField(fields.category, fields.categoryOther);
  syncInvoiceFields();
});

fields.type.addEventListener("change", syncInvoiceFields);
fields.category.addEventListener("change", () => syncCategoryOtherField(fields.category, fields.categoryOther));

streamOverviewBar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-stream='all']");
  if (!button) return;
  selectStream("all");
});

streamGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-stream]");
  if (!card) return;
  selectStream(card.dataset.stream);
});

streamInspector.addEventListener("click", (event) => {
  const card = event.target.closest(".category-stat-card");
  if (!card) return;
  selectCategory(card.dataset.category || "", card.dataset.stream || activeStream);
});

document.querySelector(".finance-stat-stack").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-panel-target]");
  if (!tile) return;
  document.querySelector(`#${tile.dataset.panelTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function saveCloseField(element) {
  if (element.dataset.field === "activeCloseMonth") {
    activeCloseMonth = element.value;
    renderFinance();
    return;
  }
  const close = closeForMonth(activeCloseMonth);
  if (!close || close.status === "closed") return;
  close[element.dataset.field] = element.value;
  saveMonthlyCloses();
}

monthlyClosePanel.addEventListener("change", (event) => {
  const field = event.target.closest(".close-field");
  if (!field) return;
  saveCloseField(field);
  renderFinance();
});

monthlyClosePanel.addEventListener("focusout", (event) => {
  const field = event.target.closest(".close-field");
  if (!field || field.tagName === "SELECT") return;
  saveCloseField(field);
  renderSummary();
});

monthlyClosePanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const close = closeForMonth(activeCloseMonth);
  if (!close) return;
  if (button.dataset.action === "close-month") {
    close.status = "closed";
    close.reviewedAt = new Date().toISOString();
    saveMonthlyCloses();
    renderFinance();
  }
  if (button.dataset.action === "reopen-close") {
    close.status = "open";
    close.reopenedAt = new Date().toISOString();
    saveMonthlyCloses();
    renderFinance();
  }
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
  const item = transactions.find((transaction) => transaction.id === row.dataset.id);
  if (button.dataset.action === "edit") {
    if (!item || transactionIsLocked(item)) return;
    editingTransactionId = row.dataset.id;
    renderFinance();
  }
  if (button.dataset.action === "done") {
    editingTransactionId = "";
    renderFinance();
  }
  if (button.dataset.action === "delete") {
    if (!item || transactionIsLocked(item)) return;
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
  if (keys.includes(financeCloseStorageKey)) {
    renderFinanceWhenUiIdle(() => {
      monthlyCloses = loadMonthlyCloses();
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
fields.category.innerHTML = categoryOptions(financeCategories[0]);
fields.category.value = financeCategories[0];
syncCategoryOtherField(fields.category, fields.categoryOther);
syncInvoiceFields();
ensureMonthlyCloseWorkflow();
renderFinance();
window.addEventListener("load", () => window.setTimeout(backfillSourceExpenses, 2200));
