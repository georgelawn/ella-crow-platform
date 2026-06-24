(function () {
  const keys = {
    gigs: "ella-crow-gigs-v2",
    sessions: "ella-crow-sessions-v1",
    finance: "ella-crow-finance-v1",
    projects: "ella-crow-projects-v1",
    todos: "ella-crow-manual-todos-v1",
    opportunities: "ella-crow-opportunities-v1",
    contacts: "ella-crow-contacts-v1"
  };

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function dateValue(value, endOfDay = false) {
    if (!value) return null;
    const suffix = String(value).includes("T") ? "" : `T${endOfDay ? "23:59:59" : "00:00:00"}`;
    const date = new Date(`${value}${suffix}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function daysUntil(value) {
    const date = dateValue(value);
    if (!date) return null;
    const today = dateValue(localDate());
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function dateLabel(value) {
    const date = dateValue(value);
    if (!date) return "No date";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  }

  function percent(value) {
    return `${Math.round(Number(value || 0))}%`;
  }

  function plural(count, singular, pluralLabel = `${singular}s`) {
    return `${count} ${count === 1 ? singular : pluralLabel}`;
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isPast(value) {
    const date = dateValue(value, true);
    return date ? date.getTime() < Date.now() : false;
  }

  function gigStatus(gig) {
    if (gig.manualStatus) return gig.status || "booked";
    if (isPast(gig.date)) return "complete";
    return gig.status || "booked";
  }

  function sessionStatus(session) {
    if (session.manualStatus) return session.status || "booked";
    if (isPast(session.date)) return "complete";
    return session.status || "booked";
  }

  function isClosedOpportunity(item) {
    return ["won", "lost", "closed", "complete", "completed"].includes(String(item.status || "").toLowerCase());
  }

  function typeLabel(value) {
    return String(value || "Uncategorised")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function projectProgress(project) {
    if (project.status === "complete") return 100;
    if (!Array.isArray(project.steps) || !project.steps.length) return 0;
    return Math.round((project.steps.filter((step) => step.done).length / project.steps.length) * 100);
  }

  function projectAtRisk(project) {
    if (project.status === "complete") return false;
    if (project.status === "blocked") return true;
    return Boolean(project.deadline && isPast(project.deadline));
  }

  function loadData() {
    return {
      gigs: readArray(keys.gigs),
      sessions: readArray(keys.sessions),
      finance: readArray(keys.finance),
      projects: readArray(keys.projects),
      todos: readArray(keys.todos),
      opportunities: readArray(keys.opportunities),
      contacts: readArray(keys.contacts)
    };
  }

  function buildRecords(data) {
    return [
      ...data.gigs.map((item) => ({
        area: "Gigs",
        title: item.title || "Untitled gig",
        detail: [item.venue, item.location, dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "index.html",
        date: item.date,
        weight: gigStatus(item) === "booked" ? 2 : 1
      })),
      ...data.sessions.map((item) => ({
        area: "Sessions",
        title: item.title || "Untitled session",
        detail: [item.type, item.location, dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "sessions.html",
        date: item.date,
        weight: sessionStatus(item) === "booked" ? 2 : 1
      })),
      ...data.projects.map((item) => ({
        area: "Projects",
        title: item.title || "Untitled project",
        detail: `${item.status || "active"} · ${projectProgress(item)}% complete · ${dateLabel(item.deadline)}`,
        href: "projects.html",
        date: item.deadline,
        weight: projectAtRisk(item) ? 3 : 1
      })),
      ...data.todos.map((item) => ({
        area: "To Do",
        title: item.title || "Untitled task",
        detail: [item.priority, item.dueDate ? `Due ${dateLabel(item.dueDate)}` : ""].filter(Boolean).join(" · "),
        href: "todos.html",
        date: item.dueDate,
        weight: item.done ? 0 : 2
      })),
      ...data.opportunities.map((item) => ({
        area: "Opportunities",
        title: item.title || "Untitled opportunity",
        detail: [item.contact, item.status, item.followUpDate ? `Follow up ${dateLabel(item.followUpDate)}` : ""].filter(Boolean).join(" · "),
        href: "opportunities.html",
        date: item.followUpDate,
        weight: isClosedOpportunity(item) ? 0 : 2
      })),
      ...data.contacts.map((item) => ({
        area: "Contacts",
        title: item.name || "Unnamed contact",
        detail: [item.category, item.email, item.phone].filter(Boolean).join(" · "),
        href: "contacts.html",
        date: "",
        weight: 1
      })),
      ...data.finance.map((item) => ({
        area: "Finance",
        title: item.description || item.category || "Finance activity",
        detail: [item.type, money(item.amount), dateLabel(item.date)].filter(Boolean).join(" · "),
        href: "finance.html",
        date: item.invoiceDueDate || item.date,
        weight: item.type === "revenue" && item.invoiceStatus === "pending" ? 3 : 1
      }))
    ].sort((a, b) => b.weight - a.weight || (dateValue(a.date)?.getTime() || Infinity) - (dateValue(b.date)?.getTime() || Infinity));
  }

  function buildBriefing(data) {
    const pendingInvoices = data.finance.filter((item) => item.type === "revenue" && item.invoiceStatus === "pending");
    const invoiceTotal = pendingInvoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      invoiceTotal
    };
  }

  function topBucket(items, pick) {
    const counts = items.reduce((map, item) => {
      const key = pick(item);
      if (!key) return map;
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
  }

  function nextRecord(items, dateField, filter = () => true) {
    return items
      .filter((item) => item[dateField] && filter(item))
      .sort((a, b) => dateValue(a[dateField]) - dateValue(b[dateField]))[0] || null;
  }

  function dueSoon(items, dateField, filter = () => true, windowDays = 7) {
    return items
      .filter((item) => item[dateField] && filter(item))
      .filter((item) => {
        const days = daysUntil(item[dateField]);
        return days !== null && days <= windowDays;
      })
      .sort((a, b) => dateValue(a[dateField]) - dateValue(b[dateField]));
  }

  function contactCompleteness(contact) {
    return ["phone", "email", "description"].filter((field) => String(contact[field] || "").trim()).length;
  }

  function card(kicker, value, note, href = "") {
    return { kicker, value, note, href };
  }

  function pageIntelligence(page, data, briefing) {
    const openTodos = data.todos.filter((item) => !item.done);
    const upcomingGigs = data.gigs.filter((gig) => gigStatus(gig) === "booked" && gig.date);
    const upcomingSessions = data.sessions.filter((session) => sessionStatus(session) === "booked" && session.date);

    const builders = {
      "index.html": () => {
        const nextGig = nextRecord(data.gigs, "date", (gig) => gigStatus(gig) === "booked");
        const pending = data.gigs.filter((gig) => gigStatus(gig) === "pending");
        const withCosts = data.gigs.filter((gig) => Number(gig.cost || 0) > 0);
        const averageCost = withCosts.length
          ? withCosts.reduce((sum, gig) => sum + Number(gig.cost || 0), 0) / withCosts.length
          : 0;
        const bestTickets = data.gigs
          .filter((gig) => Number(gig.tickets || 0) > 0)
          .sort((a, b) => Number(b.tickets || 0) - Number(a.tickets || 0))[0];
        return {
          eyebrow: "Gig intelligence",
          title: "Shows needing action",
          description: "Looks at the gig book only: confirmed dates, TBC shows, ticket movement and cost exposure.",
          cards: [
            card("Next confirmed", nextGig ? dateLabel(nextGig.date) : "No booked date", nextGig ? nextGig.title || "Untitled gig" : "Add or confirm the next show"),
            card("TBC pressure", String(pending.length), pending[0] ? `${pending[0].title || "Untitled gig"} needs confirming` : "No pending gig dates"),
            card("Ticket signal", bestTickets ? `${bestTickets.tickets} sold` : "No sales logged", bestTickets ? bestTickets.title || "Top selling gig" : "Add ticket counts to see demand"),
            card("Average show cost", averageCost ? money(averageCost) : "No costs", withCosts.length ? `Based on ${plural(withCosts.length, "costed show")}` : "Track costs to see gig profitability")
          ]
        };
      },
      "sessions.html": () => {
        const nextSession = nextRecord(data.sessions, "date", (session) => sessionStatus(session) === "booked");
        const pending = data.sessions.filter((session) => sessionStatus(session) === "pending");
        const topType = topBucket(data.sessions, (session) => session.type);
        const sessionSpend = data.sessions.reduce((sum, session) => sum + Number(session.cost || 0), 0);
        return {
          eyebrow: "Session intelligence",
          title: "Rehearsal and studio picture",
          description: "Surfaces the next room booking, unresolved TBCs, session mix and recorded spend.",
          cards: [
            card("Next session", nextSession ? dateLabel(nextSession.date) : "Nothing booked", nextSession ? nextSession.title || "Untitled session" : "Schedule the next rehearsal or meeting"),
            card("TBC sessions", String(pending.length), pending[0] ? `${pending[0].title || "Untitled session"} needs locking` : "No sessions waiting on confirmation"),
            card("Main session type", topType ? typeLabel(topType[0]) : "No pattern yet", topType ? `${plural(topType[1], "entry")} logged` : "Add sessions to see the balance"),
            card("Recorded spend", money(sessionSpend), sessionSpend ? "Total rehearsal, studio and meeting costs" : "No session costs entered")
          ]
        };
      },
      "finance.html": () => {
        const pendingInvoices = data.finance.filter((item) => item.type === "revenue" && item.invoiceStatus === "pending");
        const overdueInvoices = pendingInvoices.filter((item) => item.invoiceDueDate && daysUntil(item.invoiceDueDate) <= 0);
        const currentMonth = localDate().slice(0, 7);
        const monthItems = data.finance.filter((item) => String(item.date || "").slice(0, 7) === currentMonth);
        const revenue = monthItems.filter((item) => item.type === "revenue").reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const expenses = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const largestCost = data.finance
          .filter((item) => item.type === "expense")
          .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
        const margin = revenue ? ((revenue - expenses) / revenue) * 100 : null;
        return {
          eyebrow: "Finance intelligence",
          title: "Cash movement and risk",
          description: "Focuses on money that needs action: unpaid invoices, overdue payments, current-month margin and largest costs.",
          cards: [
            card("Pending invoices", money(briefing.invoiceTotal), pendingInvoices.length ? `${plural(pendingInvoices.length, "invoice")} still unpaid` : "No unpaid revenue logged"),
            card("Overdue payment", overdueInvoices.length ? String(overdueInvoices.length) : "None", overdueInvoices[0] ? `${overdueInvoices[0].description || overdueInvoices[0].category || "Invoice"} was due ${dateLabel(overdueInvoices[0].invoiceDueDate)}` : "No invoice due dates have passed"),
            card("This month margin", margin === null ? "No revenue" : percent(margin), margin === null ? "Add revenue to calculate margin" : `${money(revenue - expenses)} net this month`),
            card("Largest cost", largestCost ? money(largestCost.amount) : "No costs", largestCost ? largestCost.category || largestCost.description || "Expense" : "No expense entries yet")
          ]
        };
      },
      "projects.html": () => {
        const active = data.projects.filter((project) => project.status !== "complete");
        const atRisk = data.projects.filter(projectAtRisk);
        const focus = active
          .slice()
          .sort((a, b) => {
            if (projectAtRisk(a) !== projectAtRisk(b)) return projectAtRisk(a) ? -1 : 1;
            return projectProgress(a) - projectProgress(b);
          })[0];
        const blocked = data.projects.filter((project) => project.status === "blocked");
        const nextDeadline = nextRecord(data.projects, "deadline", (project) => project.status !== "complete");
        return {
          eyebrow: "Project intelligence",
          title: "Portfolio blockers and finish lines",
          description: "Reads the project slate for active work, blocked items, overdue deadlines and nearest finish lines.",
          cards: [
            card("Primary focus", focus ? focus.title || "Untitled project" : "No active project", focus ? `${projectProgress(focus)}% complete` : "Launch a project to create momentum"),
            card("Active projects", String(active.length), active.length ? `${atRisk.length} need attention` : "No active projects"),
            card("Blocked", String(blocked.length), blocked[0] ? blocked[0].title || "Untitled project" : "No blocked projects"),
            card("Nearest finish line", nextDeadline ? dateLabel(nextDeadline.deadline) : "No deadlines", nextDeadline ? nextDeadline.title || "Untitled project" : `${atRisk.length} projects need attention`)
          ]
        };
      },
      "todos.html": () => {
        const overdue = dueSoon(data.todos, "dueDate", (item) => !item.done, 0);
        const week = dueSoon(data.todos, "dueDate", (item) => !item.done, 7);
        const topCategory = topBucket(openTodos, (item) => item.category);
        const undated = openTodos.filter((item) => !item.dueDate);
        const nextTask = nextRecord(data.todos, "dueDate", (item) => !item.done);
        return {
          eyebrow: "Task intelligence",
          title: "What is actually pressing",
          description: "Separates overdue work, this-week pressure, category load and tasks without a clear date.",
          cards: [
            card("Overdue now", String(overdue.length), overdue[0] ? overdue[0].title || "Untitled task" : "Nothing is overdue"),
            card("Due this week", String(week.length), nextTask ? `${nextTask.title || "Untitled task"} is due ${dateLabel(nextTask.dueDate)}` : "No dated open tasks"),
            card("Heaviest category", topCategory ? topCategory[0] : "No load yet", topCategory ? `${plural(topCategory[1], "open task")}` : "No open task categories"),
            card("Needs a date", String(undated.length), undated[0] ? undated[0].title || "Untitled task" : "All open tasks have due dates")
          ]
        };
      },
      "opportunities.html": () => {
        const open = data.opportunities.filter((item) => !isClosedOpportunity(item));
        const due = dueSoon(data.opportunities, "followUpDate", (item) => !isClosedOpportunity(item), 0);
        const week = dueSoon(data.opportunities, "followUpDate", (item) => !isClosedOpportunity(item), 7);
        const topStatus = topBucket(open, (item) => item.status || "open");
        const topSource = topBucket(open, (item) => item.source);
        const nextFollowUp = nextRecord(data.opportunities, "followUpDate", (item) => !isClosedOpportunity(item));
        return {
          eyebrow: "Opportunity intelligence",
          title: "Pipeline follow-up map",
          description: "Shows which leads need chasing, where the pipeline is bunching, and which source is producing open work.",
          cards: [
            card("Due follow-ups", String(due.length), due[0] ? due[0].title || "Untitled opportunity" : "No follow-ups are overdue"),
            card("Next chase", nextFollowUp ? dateLabel(nextFollowUp.followUpDate) : "No date set", nextFollowUp ? nextFollowUp.title || "Untitled opportunity" : "Add follow-up dates to active leads"),
            card("Pipeline stage", topStatus ? typeLabel(topStatus[0]) : "No open leads", topStatus ? `${plural(topStatus[1], "opportunity", "opportunities")} here` : "Nothing active in the pipeline"),
            card("Best source", topSource ? topSource[0] : "Unknown", topSource ? `${plural(topSource[1], "open lead")} from this source` : `${week.length} follow-ups due this week`)
          ]
        };
      },
      "contacts.html": () => {
        const incomplete = data.contacts.filter((contact) => contactCompleteness(contact) < 2);
        const missingEmail = data.contacts.filter((contact) => !String(contact.email || "").trim());
        const missingPhone = data.contacts.filter((contact) => !String(contact.phone || "").trim());
        const topCategory = topBucket(data.contacts, (contact) => contact.category);
        const musiciansMissingInstrument = data.contacts.filter((contact) => contact.category === "Musicians" && !String(contact.instrument || "").trim());
        return {
          eyebrow: "Contact intelligence",
          title: "Database quality check",
          description: "Highlights gaps that make the contact list harder to use: missing email, phone, instruments and sparse relationship notes.",
          cards: [
            card("Needs detail", String(incomplete.length), incomplete[0] ? incomplete[0].name || "Unnamed contact" : "All contacts have usable detail"),
            card("Missing email", String(missingEmail.length), missingEmail[0] ? missingEmail[0].name || "Unnamed contact" : "Every contact has an email"),
            card("Missing phone", String(missingPhone.length), missingPhone[0] ? missingPhone[0].name || "Unnamed contact" : "Every contact has a phone number"),
            card("Largest section", topCategory ? topCategory[0] : "No contacts", topCategory ? `${plural(topCategory[1], "contact")} logged${musiciansMissingInstrument.length ? ` · ${musiciansMissingInstrument.length} musicians need instruments` : ""}` : "Add the first useful contact")
          ]
        };
      }
    };

    return builders[page]?.() || null;
  }

  function currentPage() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function renderCommandCenter(data, briefing) {
    const shell = document.querySelector(".shell");
    if (!shell || document.querySelector(".command-centre")) return;
    const intelligence = pageIntelligence(currentPage(), data, briefing);
    if (!intelligence) return;

    const section = document.createElement("section");
    section.className = "command-centre";
    section.setAttribute("aria-label", intelligence.title);
    section.innerHTML = `
      <div class="command-centre-head">
        <div>
          <p class="eyebrow">${safeText(intelligence.eyebrow)}</p>
          <h2>${safeText(intelligence.title)}</h2>
          <p>${safeText(intelligence.description)}</p>
        </div>
        <div class="command-actions">
          <button class="ghost-button" type="button" data-command-open>Search all</button>
          <button class="ghost-button" type="button" data-command-export>Export backup</button>
        </div>
      </div>
      <div class="command-grid">
        ${intelligence.cards.map((item) => `
          <article>
            <small>${safeText(item.kicker)}</small>
            <span>${safeText(item.value)}</span>
            <p>${safeText(item.note)}</p>
          </article>
        `).join("")}
      </div>
    `;

    const firstGrid = shell.querySelector(".summary-grid");
    if (firstGrid) firstGrid.after(section);
    else shell.insertBefore(section, shell.firstElementChild?.nextSibling || shell.firstChild);
  }

  function createSearchDialog(records) {
    if (document.querySelector(".command-dialog")) return;
    const dialog = document.createElement("div");
    dialog.className = "command-dialog";
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="command-dialog-backdrop" data-command-close></div>
      <section class="command-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="commandDialogTitle">
        <div class="command-search-head">
          <div>
            <p class="eyebrow">Global search</p>
            <h2 id="commandDialogTitle">Find anything</h2>
          </div>
          <button class="small-button" type="button" data-command-close>Close</button>
        </div>
        <input id="commandSearchInput" placeholder="Search gigs, projects, tasks, contacts, finance..." autocomplete="off">
        <div class="command-results" id="commandResults"></div>
      </section>
    `;
    document.body.append(dialog);

    const input = dialog.querySelector("#commandSearchInput");
    const results = dialog.querySelector("#commandResults");

    function render(query = "") {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matches = records
        .filter((record) => {
          if (!terms.length) return record.weight > 1;
          const haystack = `${record.area} ${record.title} ${record.detail}`.toLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 12);
      results.innerHTML = matches.length
        ? matches.map((record) => `
            <a href="${record.href}">
              <small>${safeText(record.area)}</small>
              <strong>${safeText(record.title)}</strong>
              <span>${safeText(record.detail || "Open record")}</span>
            </a>
          `).join("")
        : `<p class="command-empty">No matches yet. Try a venue, contact, project or follow-up.</p>`;
    }

    function open() {
      dialog.hidden = false;
      document.body.classList.add("command-dialog-open");
      render(input.value);
      requestAnimationFrame(() => input.focus());
    }

    function close() {
      dialog.hidden = true;
      document.body.classList.remove("command-dialog-open");
    }

    input.addEventListener("input", () => render(input.value));
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-command-close]")) close();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
      if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
        event.preventDefault();
        open();
      }
      if (event.key === "Escape" && !dialog.hidden) close();
    });
    document.querySelectorAll("[data-command-open]").forEach((button) => button.addEventListener("click", open));
  }

  function exportBackup(data) {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "ella-crow-design-overhaul",
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ella-crow-backup-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function wireExport(data) {
    document.querySelectorAll("[data-command-export]").forEach((button) => {
      button.addEventListener("click", () => exportBackup(data));
    });
  }

  function setup() {
    const data = loadData();
    const records = buildRecords(data);
    const briefing = buildBriefing(data);
    renderCommandCenter(data, briefing);
    createSearchDialog(records);
    wireExport(data);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
