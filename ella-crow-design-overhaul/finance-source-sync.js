(function () {
  const financeStorageKey = "ella-crow-finance-v1";
  const sourceStorageKeys = {
    gig: "ella-crow-gigs-v2",
    session: "ella-crow-sessions-v1"
  };

  function loadArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function sourceAmount(item) {
    const value = Number(item?.cost ?? item?.price ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function expenseId(sourceType, sourceId) {
    return `source-expense:${sourceType}:${sourceId}`;
  }

  function expenseFor(sourceType, item) {
    const isSession = sourceType === "session";
    const title = item.title || (isSession ? "Session" : "Gig");
    const place = isSession ? item.location : item.venue;
    return {
      id: expenseId(sourceType, item.id),
      type: "expense",
      stream: isSession && item.type === "Recording" ? "streaming" : "gigs",
      date: item.date || "",
      amount: String(sourceAmount(item)),
      category: isSession ? `${item.type || "Session"} cost` : "Gig cost",
      invoiceStatus: "",
      invoiceDueDate: "",
      description: `${title}${place ? ` · ${place}` : ""}`,
      sourceType,
      sourceId: item.id,
      sourceLinked: true
    };
  }

  function syncSource(sourceType, item) {
    if (!sourceStorageKeys[sourceType] || !item?.id) return;
    const transactions = loadArray(financeStorageKey);
    const before = JSON.stringify(transactions);
    const id = expenseId(sourceType, item.id);
    const existingIndex = transactions.findIndex((transaction) =>
      transaction.id === id ||
      (transaction.sourceType === sourceType && transaction.sourceId === item.id)
    );
    const amount = sourceAmount(item);

    if (amount <= 0) {
      if (existingIndex < 0) return;
      transactions.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      transactions[existingIndex] = {
        ...transactions[existingIndex],
        ...expenseFor(sourceType, item),
        id: transactions[existingIndex].id || id
      };
    } else {
      transactions.push(expenseFor(sourceType, item));
    }

    const after = JSON.stringify(transactions);
    if (after !== before) localStorage.setItem(financeStorageKey, after);
  }

  function removeSource(sourceType, sourceId) {
    if (!sourceStorageKeys[sourceType] || !sourceId) return;
    const transactions = loadArray(financeStorageKey);
    const filtered = transactions.filter((transaction) =>
      transaction.id !== expenseId(sourceType, sourceId) &&
      !(transaction.sourceType === sourceType && transaction.sourceId === sourceId)
    );
    if (filtered.length !== transactions.length) {
      localStorage.setItem(financeStorageKey, JSON.stringify(filtered));
    }
  }

  function backfill(sourceType) {
    if (!sourceStorageKeys[sourceType]) return;
    loadArray(sourceStorageKeys[sourceType]).forEach((item) => syncSource(sourceType, item));
  }

  window.EllaFinanceSync = {
    backfill,
    removeSource,
    syncSource
  };
})();
