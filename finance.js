const financeStorageKey = "ella-crow-finance-v1";

let transactions = loadTransactions();
let editingTransactionId = "";

const form = document.querySelector("#financeForm");
const revenueList = document.querySelector("#revenueList");
const expenseList = document.querySelector("#expenseList");
const monthlyFinance = document.querySelector("#monthlyFinance");
const emptyState = document.querySelector("#financeEmptyState");
const clearButton = document.querySelector("#clearTransactionButton");

const fields = {
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

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(financeStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(financeStorageKey, JSON.stringify(transactions));
}

function money(value) {
  return Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function monthKey(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  return monthKey(new Date().toISOString().slice(0, 10));
}

function lastMonthKey() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return monthKey(date.toISOString().slice(0, 10));
}

function monthLabel(key) {
  if (!key) return "Date needed";
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00`));
}

function totalsFor(items) {
  const revenue = items.filter((item) => item.type === "revenue").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { revenue, expenses, net: revenue - expenses };
}

function renderSummary() {
  const currentItems = transactions.filter((item) => monthKey(item.date) === currentMonthKey());
  const lastMonthItems = transactions.filter((item) => monthKey(item.date) === lastMonthKey());
  const monthTotals = totalsFor(currentItems);
  const lastMonthTotals = totalsFor(lastMonthItems);
  const allTotals = totalsFor(transactions);
  document.querySelector("#lastMonthNet").textContent = money(lastMonthTotals.net);
  document.querySelector("#monthRevenue").textContent = money(monthTotals.revenue);
  document.querySelector("#monthNet").textContent = money(monthTotals.net);
  document.querySelector("#allTimeNet").textContent = money(allTotals.net);
}

function renderMonthlyTable() {
  const grouped = new Map();
  transactions.forEach((item) => {
    const key = monthKey(item.date);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  });
  const rows = [...grouped.entries()]
    .sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return b.localeCompare(a);
    })
    .map(([key, items]) => {
      const totals = totalsFor(items);
      return `
        <div class="finance-row">
          <strong>${monthLabel(key)}</strong>
          <span>${money(totals.revenue)}</span>
          <span>${money(totals.expenses)}</span>
          <span class="${totals.net < 0 ? "negative" : "positive"}">${money(totals.net)}</span>
        </div>
      `;
    });
  monthlyFinance.innerHTML = rows.length
    ? `<div class="finance-row finance-head"><strong>Month</strong><span>Revenue</span><span>Expenses</span><span>Net</span></div>${rows.join("")}`
    : "";
}

function renderTransactions() {
  renderSummary();
  renderMonthlyTable();
  emptyState.classList.toggle("visible", transactions.length === 0);
  document.querySelector("#revenueCount").textContent = transactions.filter((item) => item.type === "revenue").length;
  document.querySelector("#expenseCount").textContent = transactions.filter((item) => item.type === "expense").length;
  revenueList.innerHTML = renderTransactionColumn("revenue");
  expenseList.innerHTML = renderTransactionColumn("expense");
}

function renderTransactionColumn(type) {
  return transactions
    .filter((item) => item.type === type)
    .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))
    .map(renderTransactionCard)
    .join("");
}

function renderTransactionCard(item) {
  if (editingTransactionId === item.id) return renderEditableTransaction(item);
  const status = item.type === "revenue" ? `<p><strong>Invoice:</strong> ${escapeHtml(item.invoiceStatus || "received")}${item.invoiceDueDate ? ` · due ${escapeHtml(item.invoiceDueDate)}` : ""}</p>` : "";
  return `
      <article class="transaction-card ${item.type}">
        <div>
          <p class="eyebrow">${escapeHtml(item.type)}</p>
          <h4>${money(item.amount)}</h4>
        </div>
        <p>${escapeHtml(item.category || "Uncategorised")} · ${escapeHtml(item.date)}</p>
        ${status}
        <p>${escapeHtml(item.description || "No description")}</p>
        <div class="card-actions">
          <button class="small-button" data-action="edit" data-id="${item.id}" type="button">Edit</button>
          <button class="small-button danger" data-action="delete" data-id="${item.id}" type="button">Delete</button>
        </div>
      </article>
    `;
}

function renderEditableTransaction(item) {
  return `
    <article class="transaction-card ${item.type} editing" data-id="${item.id}">
      <label class="contact-inline">
        <span>Type</span>
        <select class="finance-field" data-field="type">
          <option value="revenue"${item.type === "revenue" ? " selected" : ""}>Revenue</option>
          <option value="expense"${item.type === "expense" ? " selected" : ""}>Expense</option>
        </select>
      </label>
      ${item.type === "revenue" ? `
        <label class="contact-inline">
          <span>Invoice status</span>
          <select class="finance-field" data-field="invoiceStatus">
            <option value="pending"${(item.invoiceStatus || "received") === "pending" ? " selected" : ""}>Pending</option>
            <option value="received"${(item.invoiceStatus || "received") === "received" ? " selected" : ""}>Received</option>
          </select>
        </label>
        <label class="contact-inline">
          <span>Invoice due date</span>
          <input class="finance-field" data-field="invoiceDueDate" type="date" value="${escapeHtml(item.invoiceDueDate || "")}">
        </label>
      ` : ""}
      <label class="contact-inline">
        <span>Date</span>
        <input class="finance-field" data-field="date" type="date" value="${escapeHtml(item.date)}">
      </label>
      <label class="contact-inline">
        <span>Amount</span>
        <input class="finance-field" data-field="amount" type="number" min="0" step="0.01" value="${escapeHtml(item.amount)}">
      </label>
      <label class="contact-inline full">
        <span>Category</span>
        <input class="finance-field" data-field="category" value="${escapeHtml(item.category || "")}">
      </label>
      <label class="contact-inline full">
        <span>Description</span>
        <textarea class="finance-field" data-field="description" rows="3">${escapeHtml(item.description || "")}</textarea>
      </label>
      <div class="card-actions">
        <span class="contact-save-note">Saves automatically</span>
        <button class="small-button" data-action="done" data-id="${item.id}" type="button">Done</button>
        <button class="small-button danger" data-action="delete" data-id="${item.id}" type="button">Delete</button>
      </div>
    </article>
  `;
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
  const card = element.closest(".transaction-card");
  const item = transactions.find((transaction) => transaction.id === card?.dataset.id);
  const field = element.dataset.field;
  if (!item || !field) return;
  item[field] = element.value;
  if (field === "type" && item.type === "expense") {
    item.invoiceStatus = "";
    item.invoiceDueDate = "";
  }
  if (field === "type" && item.type === "revenue" && !item.invoiceStatus) {
    item.invoiceStatus = "pending";
  }
  saveTransactions();
  editingTransactionId = item.id;
  renderTransactions();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!fields.date.value || !fields.amount.value) return;
  transactions.push({
    id: crypto.randomUUID(),
    type: fields.type.value,
    date: fields.date.value,
    amount: fields.amount.value,
    category: fields.category.value.trim(),
    invoiceStatus: fields.type.value === "revenue" ? fields.invoiceStatus.value : "",
    invoiceDueDate: fields.type.value === "revenue" ? (fields.invoiceDueDate.value || fields.date.value) : "",
    description: fields.description.value.trim()
  });
  saveTransactions();
  form.reset();
  syncInvoiceFields();
  renderTransactions();
});

clearButton.addEventListener("click", () => {
  form.reset();
  syncInvoiceFields();
});
fields.type.addEventListener("change", syncInvoiceFields);

document.querySelector(".finance-columns").addEventListener("change", (event) => {
  if (event.target.matches(".finance-field")) saveFinanceField(event.target);
});

document.querySelector(".finance-columns").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") {
    editingTransactionId = button.dataset.id;
    renderTransactions();
  }
  if (button.dataset.action === "done") {
    editingTransactionId = "";
    renderTransactions();
  }
  if (button.dataset.action === "delete") {
    transactions = transactions.filter((item) => item.id !== button.dataset.id);
    saveTransactions();
    renderTransactions();
  }
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  if (!event.detail?.keys?.includes(financeStorageKey)) return;
  transactions = loadTransactions();
  editingTransactionId = "";
  renderTransactions();
});

syncInvoiceFields();
renderTransactions();
