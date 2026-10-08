const campaignStorageKey = "ella-crow-december-show-v1";
const campaignTodoStorageKey = "ella-crow-manual-todos-v1";

const defaultCampaign = {
  title: "4 December headline show",
  campaignStartDate: "2026-10-08",
  showDate: "2026-12-04",
  singleDate: "2026-11-06",
  capacity: 200,
  ticketsSold: 0,
  ticketUrl: "",
  targets: [
    { date: "2026-10-18", tickets: 35, label: "Core audience activated" },
    { date: "2026-11-06", tickets: 85, label: "Single release" },
    { date: "2026-11-20", tickets: 135, label: "Two weeks out" },
    { date: "2026-11-30", tickets: 175, label: "Final-week runway" },
    { date: "2026-12-04", tickets: 200, label: "Sold-out room" }
  ],
  actions: [
    { id: "ticket-foundation", stream: "tickets", title: "Lock ticket page, price, artwork and one-line reason to attend", dueDate: "2026-10-10", note: "Every link and post needs one destination and one clear promise.", done: false, todoId: "" },
    { id: "warm-audience-list", stream: "tickets", title: "Build the first 100-person warm audience list", dueDate: "2026-10-11", note: "Past buyers, friends, collaborators, local fans and everyone who has already shown intent.", done: false, todoId: "" },
    { id: "announce-show", stream: "content", title: "Launch the show with hero live clip and ticket link", dueDate: "2026-10-12", note: "Ella speaks directly: why this night matters and what people will hear first.", done: false, todoId: "" },
    { id: "personal-wave-one", stream: "tickets", title: "Send first 40 personal ticket messages", dueDate: "2026-10-14", note: "Personal voice notes and messages will outperform passive posting early.", done: false, todoId: "" },
    { id: "single-lock", stream: "release", title: "Choose the pre-gig single and lock master, artwork and distribution", dueDate: "2026-10-14", note: "Choose the best audience-converter, not simply the team favourite.", done: false, todoId: "" },
    { id: "industry-longlist", stream: "industry", title: "Build a 15-person high-fit industry longlist", dueDate: "2026-10-15", note: "Add the reason each person should care and the warmest route to them.", done: false, todoId: "" },
    { id: "support-partners", stream: "tickets", title: "Confirm support act and partner ticket commitments", dueDate: "2026-10-16", note: "Agree a real audience contribution, shared assets and posting dates.", done: false, todoId: "" },
    { id: "single-assets", stream: "release", title: "Finish single cover, canvas, pitch copy and pre-save page", dueDate: "2026-10-23", note: "Package once so the campaign can spend its energy on repetition.", done: false, todoId: "" },
    { id: "industry-proof-pack", stream: "industry", title: "Prepare the 90-second industry proof pack", dueDate: "2026-10-23", note: "Best live clip, private music, short story, audience data, show invitation and direct contact.", done: false, todoId: "" },
    { id: "single-content-bank", stream: "content", title: "Bank 12 short-form single and live-show assets", dueDate: "2026-10-28", note: "Hooks, rehearsal, story, lyric, crowd memory, direct invitation and collaborator angles.", done: false, todoId: "" },
    { id: "industry-intros", stream: "industry", title: "Secure warm introductions for the top 8 industry guests", dueDate: "2026-10-30", note: "The inviter should explain why seeing Ella live now is worth their evening.", done: false, todoId: "" },
    { id: "release-single", stream: "release", title: "Release the single and make every asset sell the show", dueDate: "2026-11-06", note: "Release-day success is measured in new intent and tickets as well as streams.", done: false, todoId: "" },
    { id: "industry-invite", stream: "industry", title: "Send tailored invitations to the top 8", dueDate: "2026-11-09", note: "Include the precise set time, a held guest spot and one compelling proof point.", done: false, todoId: "" },
    { id: "live-arc", stream: "show", title: "Lock the set and three-song proof arc", dueDate: "2026-11-13", note: "Design the set for fans first, while giving industry an unmistakable future story.", done: false, todoId: "" },
    { id: "conversion-week", stream: "tickets", title: "Run fan referral and personal follow-up week", dueDate: "2026-11-20", note: "Ask every buyer to bring one person; follow up with warm non-buyers individually.", done: false, todoId: "" },
    { id: "capture-brief", stream: "content", title: "Book photo/video team and issue the proof capture brief", dueDate: "2026-11-20", note: "Full room, crowd response, strongest song, backstage story and five fan reactions.", done: false, todoId: "" },
    { id: "production-lock", stream: "show", title: "Lock production, musicians, rehearsals, merch and guest-list owner", dueDate: "2026-11-23", note: "No important show-day responsibility should still live in somebody's head.", done: false, todoId: "" },
    { id: "industry-confirm", stream: "industry", title: "Personally reconfirm every industry guest", dueDate: "2026-11-30", note: "Send set time, travel detail, contact number and a human reminder of why the night matters.", done: false, todoId: "" },
    { id: "show-run", stream: "show", title: "Final rehearsal, run sheet and contingency check", dueDate: "2026-12-02", note: "Doors-to-curfew timing, gear, content capture, guest welcome and post-show introductions.", done: false, todoId: "" },
    { id: "follow-up", stream: "industry", title: "Send tailored follow-ups and best live proof within 48 hours", dueDate: "2026-12-06", note: "Turn the room into specific next meetings while the feeling is still fresh.", done: false, todoId: "" }
  ],
  industry: [],
  audience: []
};

const streamMeta = {
  tickets: { label: "Tickets", mark: "T" },
  release: { label: "Release", mark: "R" },
  industry: { label: "Industry", mark: "I" },
  show: { label: "Show", mark: "S" },
  content: { label: "Content", mark: "C" }
};

let campaign = loadCampaign();
let actionFilter = "open";
let audienceFilter = "action";
let audienceSearchTerm = "";

function cloneDefaultCampaign() { return JSON.parse(JSON.stringify(defaultCampaign)); }

function loadCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem(campaignStorageKey) || "null");
    if (!saved) return cloneDefaultCampaign();
    const defaults = cloneDefaultCampaign();
    return {
      ...defaults,
      ...saved,
      targets: Array.isArray(saved.targets) ? saved.targets : defaults.targets,
      actions: Array.isArray(saved.actions) ? saved.actions : defaults.actions,
      industry: Array.isArray(saved.industry) ? saved.industry : [],
      audience: Array.isArray(saved.audience) ? saved.audience : []
    };
  } catch { return cloneDefaultCampaign(); }
}

function saveCampaign() { localStorage.setItem(campaignStorageKey, JSON.stringify(campaign)); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function dateStamp(value) { return new Date(`${value}T00:00:00`).getTime(); }
function todayStamp() { const date = new Date(); date.setHours(0, 0, 0, 0); return date.getTime(); }
function dayDifference(from, to) { return Math.ceil((dateStamp(to) - dateStamp(from)) / 86400000); }
function formatDate(value, long = false) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" }).format(date);
}
function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function loadTodos() {
  try { const value = JSON.parse(localStorage.getItem(campaignTodoStorageKey) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

function addOrUpdateTodo(action) {
  const todos = loadTodos();
  let todo = action.todoId ? todos.find((item) => item.id === action.todoId) : null;
  if (!todo) {
    todo = { id: makeId("todo"), title: action.title, category: "Gigs", dueDate: action.dueDate, notes: `4 December campaign · ${streamMeta[action.stream]?.label || "Campaign"}${action.note ? ` · ${action.note}` : ""}`, done: Boolean(action.done), createdAt: new Date().toISOString(), campaignActionId: action.id };
    todos.push(todo);
    action.todoId = todo.id;
  } else {
    Object.assign(todo, { title: action.title, dueDate: action.dueDate, done: Boolean(action.done), notes: `4 December campaign · ${streamMeta[action.stream]?.label || "Campaign"}${action.note ? ` · ${action.note}` : ""}` });
  }
  localStorage.setItem(campaignTodoStorageKey, JSON.stringify(todos));
}

function syncActionCompletion(action) {
  if (!action.todoId) return;
  const todos = loadTodos();
  const todo = todos.find((item) => item.id === action.todoId);
  if (!todo) { action.todoId = ""; return; }
  todo.done = Boolean(action.done);
  localStorage.setItem(campaignTodoStorageKey, JSON.stringify(todos));
}

function reconcileTodos() {
  const todos = new Map(loadTodos().map((todo) => [todo.id, todo]));
  let changed = false;
  campaign.actions.forEach((action) => {
    if (!action.todoId) return;
    const todo = todos.get(action.todoId);
    if (!todo) { action.todoId = ""; changed = true; return; }
    if (action.done !== Boolean(todo.done)) { action.done = Boolean(todo.done); changed = true; }
  });
  if (changed) saveCampaign();
}

function targetForToday() {
  const targets = [...campaign.targets].sort((a, b) => dateStamp(a.date) - dateStamp(b.date));
  const start = { date: campaign.campaignStartDate, tickets: 0 };
  if (todayStamp() <= dateStamp(start.date)) return 0;
  let previous = start;
  for (const target of targets) {
    if (todayStamp() <= dateStamp(target.date)) {
      const span = Math.max(1, dateStamp(target.date) - dateStamp(previous.date));
      const progress = Math.max(0, Math.min(1, (todayStamp() - dateStamp(previous.date)) / span));
      return Math.round(previous.tickets + ((target.tickets - previous.tickets) * progress));
    }
    previous = target;
  }
  return Number(campaign.capacity || 200);
}

function ticketForecast() {
  const elapsed = Math.max(0, dayDifference(campaign.campaignStartDate, new Date().toISOString().slice(0, 10)));
  const totalDays = Math.max(1, dayDifference(campaign.campaignStartDate, campaign.showDate));
  if (elapsed < 3 || Number(campaign.ticketsSold) < 1) return null;
  return Math.round((Number(campaign.ticketsSold) / elapsed) * totalDays);
}

function renderScoreboard() {
  const sold = Math.max(0, Number(campaign.ticketsSold) || 0);
  const capacity = Math.max(1, Number(campaign.capacity) || 200);
  const percent = Math.min(100, Math.round((sold / capacity) * 100));
  const days = dayDifference(new Date().toISOString().slice(0, 10), campaign.showDate);
  const target = targetForToday();
  const delta = sold - target;
  const confirmed = campaign.industry.filter((person) => person.status === "confirmed").length;
  const activeIndustry = campaign.industry.filter((person) => ["warm", "invited", "confirmed"].includes(person.status)).length;
  const complete = campaign.actions.filter((action) => action.done).length;
  const completion = campaign.actions.length ? Math.round((complete / campaign.actions.length) * 100) : 0;
  const overdue = campaign.actions.filter((action) => !action.done && dateStamp(action.dueDate) < todayStamp()).length;
  const forecast = ticketForecast();
  const needed = Math.max(0, capacity - sold);
  const daily = days > 0 ? (needed / days).toFixed(1) : needed;

  document.querySelector("#daysToShow").textContent = days >= 0 ? days : "0";
  document.querySelector("#showDateLabel").textContent = formatDate(campaign.showDate, true);
  document.querySelector("#ticketsSoldValue").textContent = sold;
  document.querySelector("#capacityValue").textContent = capacity;
  document.querySelector("#sellThroughValue").textContent = `${percent}%`;
  document.querySelector("#ticketPaceLabel").textContent = delta >= 0 ? `${delta} ticket${delta === 1 ? "" : "s"} ahead of today's plan` : `${Math.abs(delta)} behind today's plan`;
  document.querySelector("#forecastLabel").textContent = forecast === null ? "Forecast appears after 3 campaign days" : `Current pace forecasts ${forecast} sold`;
  document.querySelector("#industryConfirmedValue").textContent = confirmed;
  document.querySelector("#industryPipelineLabel").textContent = `${activeIndustry} active conversation${activeIndustry === 1 ? "" : "s"}`;
  document.querySelector("#campaignCompletionValue").textContent = `${completion}%`;
  document.querySelector("#campaignHealthLabel").textContent = overdue ? `${overdue} overdue action${overdue === 1 ? "" : "s"} need attention` : "No overdue campaign actions";
  document.querySelector("#campaignHealthCard").dataset.state = overdue ? "attention" : "track";
  document.querySelector("#ticketProgressFill").style.width = `${percent}%`;
  document.querySelector("#ticketProgressMarker").style.left = `${percent}%`;
  document.querySelector("#ticketNextMove").textContent = needed ? `${needed} paid tickets left to sell` : "The room is sold out";
  document.querySelector("#ticketMath").textContent = needed ? `From today, the campaign needs ${daily} ticket${daily === "1.0" ? "" : "s"} per day. Concentrate sales into personal outreach, partner pushes and moments—not endless generic posts.` : "Protect the room: manage returns, guest list and the arrival experience.";
  document.querySelector("#singleDateLabel").textContent = formatDate(campaign.singleDate, true);
  const link = document.querySelector("#ticketLink");
  link.hidden = !campaign.ticketUrl;
  link.href = campaign.ticketUrl || "#";
}

function renderTargets() {
  const sold = Number(campaign.ticketsSold) || 0;
  document.querySelector("#ticketTargetList").innerHTML = campaign.targets.map((target) => {
    const reached = sold >= target.tickets;
    const past = dateStamp(target.date) < todayStamp();
    return `<div class="campaign-target ${reached ? "reached" : past ? "missed" : ""}"><span>${reached ? "✓" : target.tickets}</span><div><strong>${target.tickets} sold</strong><small>${escapeHtml(target.label)} · ${formatDate(target.date)}</small></div></div>`;
  }).join("");
}

function actionStatus(action) {
  if (action.done) return "done";
  if (dateStamp(action.dueDate) < todayStamp()) return "overdue";
  if (dayDifference(new Date().toISOString().slice(0, 10), action.dueDate) <= 7) return "soon";
  return "later";
}

function renderActions() {
  const visible = campaign.actions.filter((action) => actionFilter === "all" || (actionFilter === "done" ? action.done : !action.done));
  const grouped = Object.keys(streamMeta).map((stream) => ({ stream, actions: visible.filter((action) => action.stream === stream).sort((a, b) => dateStamp(a.dueDate) - dateStamp(b.dueDate)) })).filter((group) => group.actions.length);
  document.querySelector("#campaignActionBoard").innerHTML = grouped.length ? grouped.map((group) => `
    <section class="campaign-action-lane" data-stream="${group.stream}">
      <div class="campaign-lane-head"><span>${streamMeta[group.stream].mark}</span><h4>${streamMeta[group.stream].label}</h4><b>${group.actions.length}</b></div>
      <div>${group.actions.map((action) => `<article class="campaign-action ${actionStatus(action)}" data-id="${escapeHtml(action.id)}"><label><input type="checkbox" data-action="toggle" ${action.done ? "checked" : ""}><span><strong>${escapeHtml(action.title)}</strong><small>${formatDate(action.dueDate)}${action.todoId ? " · On To Do" : ""}</small></span></label><button data-action="edit" type="button" aria-label="Edit action">•••</button>${action.note ? `<p>${escapeHtml(action.note)}</p>` : ""}</article>`).join("")}</div>
    </section>`).join("") : '<p class="campaign-empty visible">No actions in this view.</p>';
}

function renderIndustry() {
  const statuses = [
    ["target", "Targets"], ["warm", "Warm"], ["invited", "Invited"], ["confirmed", "Confirmed"]
  ];
  document.querySelector("#industryFunnel").innerHTML = statuses.map(([key, label]) => `<div><strong>${campaign.industry.filter((person) => person.status === key).length}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#industryList").innerHTML = campaign.industry.map((person) => `<button class="industry-person" data-id="${escapeHtml(person.id)}" type="button"><span class="industry-status ${escapeHtml(person.status)}">${escapeHtml(person.status)}</span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml([person.role, person.company].filter(Boolean).join(" · ") || "Details not added")}</small><p>${escapeHtml(person.nextMove || "Add a next move")}</p></button>`).join("");
  document.querySelector("#industryEmpty").classList.toggle("visible", campaign.industry.length === 0);
}

const audienceStatusMeta = {
  "to-invite": { label: "To invite", rank: 1 },
  "follow-up": { label: "Follow up", rank: 0 },
  invited: { label: "Invited", rank: 2 },
  bought: { label: "Bought", rank: 4 },
  comp: { label: "Guest list", rank: 5 },
  declined: { label: "Declined", rank: 6 }
};

const audienceGroupLabels = {
  friend: "Friend",
  family: "Family",
  fan: "Fan",
  collaborator: "Collaborator",
  partner: "Partner / guest list",
  other: "Other"
};

function audienceNeedsAction(person) {
  return ["to-invite", "invited", "follow-up"].includes(person.status);
}

function audienceFollowUpState(person) {
  if (!person.followUpDate || !audienceNeedsAction(person)) return "";
  if (dateStamp(person.followUpDate) < todayStamp()) return "overdue";
  if (dateStamp(person.followUpDate) === todayStamp()) return "today";
  return "scheduled";
}

function renderAudience() {
  const audience = campaign.audience || [];
  const toInvite = audience.filter((person) => person.status === "to-invite").length;
  const followUp = audience.filter((person) => audienceFollowUpState(person) === "overdue" || audienceFollowUpState(person) === "today").length;
  const buyers = audience.filter((person) => person.status === "bought").length;
  const attributedTickets = audience.reduce((sum, person) => sum + (person.status === "bought" ? Math.max(0, Number(person.tickets) || 0) : 0), 0);
  document.querySelector("#audienceCrmStats").innerHTML = `
    <article><strong>${toInvite}</strong><span>Still to invite</span></article>
    <article class="${followUp ? "attention" : ""}"><strong>${followUp}</strong><span>Follow-ups due</span></article>
    <article><strong>${buyers}</strong><span>People bought</span></article>
    <article><strong>${attributedTickets}</strong><span>CRM tickets</span></article>`;

  const term = audienceSearchTerm.trim().toLowerCase();
  const visible = audience
    .filter((person) => audienceFilter === "all" || (audienceFilter === "bought" ? person.status === "bought" : audienceNeedsAction(person)))
    .filter((person) => !term || [person.name, person.group, person.contact, person.owner, person.nextMove].some((value) => String(value || "").toLowerCase().includes(term)))
    .sort((a, b) => {
      const aFollow = a.followUpDate ? dateStamp(a.followUpDate) : Number.MAX_SAFE_INTEGER;
      const bFollow = b.followUpDate ? dateStamp(b.followUpDate) : Number.MAX_SAFE_INTEGER;
      return (audienceStatusMeta[a.status]?.rank || 9) - (audienceStatusMeta[b.status]?.rank || 9) || aFollow - bFollow || String(a.name).localeCompare(String(b.name));
    });

  document.querySelector("#audienceList").innerHTML = visible.map((person) => {
    const followState = audienceFollowUpState(person);
    const ticketCopy = person.status === "bought" ? `${Number(person.tickets) || 0} ticket${Number(person.tickets) === 1 ? "" : "s"}` : "";
    const followCopy = person.followUpDate && audienceNeedsAction(person) ? `Follow up ${formatDate(person.followUpDate)}` : "";
    return `<button class="audience-person ${followState}" data-id="${escapeHtml(person.id)}" type="button">
      <span class="audience-person-status ${escapeHtml(person.status)}">${escapeHtml(audienceStatusMeta[person.status]?.label || person.status)}</span>
      <span class="audience-person-main"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(audienceGroupLabels[person.group] || "Other")}${person.contact ? ` · ${escapeHtml(person.contact)}` : ""}</small></span>
      <span class="audience-person-action"><strong>${escapeHtml(ticketCopy || person.nextMove || "Add next move")}</strong><small>${escapeHtml(followCopy || (person.owner ? `Owner: ${person.owner}` : "No follow-up set"))}</small></span>
      <span class="audience-person-edit">Edit</span>
    </button>`;
  }).join("");

  const empty = document.querySelector("#audienceEmpty");
  empty.textContent = audience.length ? "No people match this view." : "No audience contacts yet. Add friends, family, fans, collaborators or partner guests—one at a time or as a batch.";
  empty.classList.toggle("visible", visible.length === 0);
}

function renderPhase() {
  const today = todayStamp();
  const phases = [
    { start: "2026-10-08", end: "2026-10-18", name: "Foundation + first buyers", aim: "Make the offer clear, activate the warmest 100 people and reach 35 sold.", moves: ["Personal messages before broad reach", "Lock single and campaign assets", "Build industry longlist with warm routes"] },
    { start: "2026-10-19", end: "2026-11-06", name: "Single runway", aim: "Turn the new song into anticipation and reach 85 sold by release day.", moves: ["Tell the story repeatedly from new angles", "Bank content instead of creating daily", "Secure introductions before invitations"] },
    { start: "2026-11-07", end: "2026-11-20", name: "Proof + conversion", aim: "Use release response, rehearsal and referrals to reach 135 sold.", moves: ["Retarget engaged non-buyers", "Ask buyers to bring one person", "Send tailored industry invitations"] },
    { start: "2026-11-21", end: "2026-11-30", name: "Full-room pressure", aim: "Create visible momentum, close warm buyers and reach 175 sold.", moves: ["Publish social proof and scarcity", "Run collaborator and support pushes", "Personally confirm industry guests"] },
    { start: "2026-12-01", end: "2026-12-04", name: "Show week", aim: "Sell the final tickets and deliver a career-grade room.", moves: ["Daily direct conversion, no vague posting", "Protect Ella's energy and voice", "Brief welcome and capture teams"] },
    { start: "2026-12-05", end: "2026-12-18", name: "Turn proof into progress", aim: "Convert the night into meetings, content and a sharper next chapter.", moves: ["Industry follow-up inside 48 hours", "Release best proof while it feels current", "Review sales sources and fan capture"] }
  ];
  const current = phases.find((phase) => today >= dateStamp(phase.start) && today <= dateStamp(phase.end)) || (today < dateStamp(phases[0].start) ? phases[0] : phases.at(-1));
  document.querySelector("#campaignPhase").innerHTML = `<div class="campaign-current-phase"><span>Now · ${formatDate(current.start)}–${formatDate(current.end)}</span><strong>${escapeHtml(current.name)}</strong><p>${escapeHtml(current.aim)}</p></div>`;
  document.querySelector("#campaignWeekList").innerHTML = current.moves.map((move, index) => `<div><span>0${index + 1}</span><p>${escapeHtml(move)}</p></div>`).join("");
}

function renderAll() { renderScoreboard(); renderTargets(); renderActions(); renderAudience(); renderIndustry(); renderPhase(); }

function openSettings() {
  document.querySelector("#campaignShowDate").value = campaign.showDate;
  document.querySelector("#campaignSingleDate").value = campaign.singleDate;
  document.querySelector("#campaignCapacity").value = campaign.capacity;
  document.querySelector("#campaignTicketsSold").value = campaign.ticketsSold;
  document.querySelector("#campaignTicketUrl").value = campaign.ticketUrl || "";
  document.querySelector("#campaignSettingsDialog").showModal();
}

function openAction(id = "") {
  const action = campaign.actions.find((item) => item.id === id);
  document.querySelector("#campaignActionDialogTitle").textContent = action ? "Edit action" : "Add action";
  document.querySelector("#campaignActionId").value = action?.id || "";
  document.querySelector("#campaignActionTitle").value = action?.title || "";
  document.querySelector("#campaignActionStream").value = action?.stream || "tickets";
  document.querySelector("#campaignActionDueDate").value = action?.dueDate || campaign.showDate;
  document.querySelector("#campaignActionNote").value = action?.note || "";
  document.querySelector("#campaignActionAddToTodo").checked = Boolean(action?.todoId);
  document.querySelector("#deleteCampaignActionButton").hidden = !action;
  document.querySelector("#campaignActionDialog").showModal();
}

function openGuest(id = "") {
  const person = campaign.industry.find((item) => item.id === id);
  document.querySelector("#industryGuestDialogTitle").textContent = person ? "Edit person" : "Add person";
  document.querySelector("#industryGuestId").value = person?.id || "";
  document.querySelector("#industryGuestName").value = person?.name || "";
  document.querySelector("#industryGuestCompany").value = person?.company || "";
  document.querySelector("#industryGuestRole").value = person?.role || "";
  document.querySelector("#industryGuestStatus").value = person?.status || "target";
  document.querySelector("#industryGuestNextMove").value = person?.nextMove || "";
  document.querySelector("#industryGuestNotes").value = person?.notes || "";
  document.querySelector("#deleteIndustryGuestButton").hidden = !person;
  document.querySelector("#industryGuestDialog").showModal();
}

function openAudienceContact(id = "") {
  const person = campaign.audience.find((item) => item.id === id);
  document.querySelector("#audienceContactDialogTitle").textContent = person ? "Edit person" : "Add people";
  document.querySelector("#audienceContactId").value = person?.id || "";
  document.querySelector("#audienceContactName").value = person?.name || "";
  document.querySelector("#audienceContactName").rows = person ? 1 : 3;
  document.querySelector("#audienceNameHelp").hidden = Boolean(person);
  document.querySelector("#audienceContactGroup").value = person?.group || "friend";
  document.querySelector("#audienceContactStatus").value = person?.status || "to-invite";
  document.querySelector("#audienceContactDetail").value = person?.contact || "";
  document.querySelector("#audienceContactOwner").value = person?.owner || "";
  document.querySelector("#audienceContactFollowUp").value = person?.followUpDate || "";
  document.querySelector("#audienceContactTickets").value = Number(person?.tickets) || 0;
  document.querySelector("#audienceContactNextMove").value = person?.nextMove || "";
  document.querySelector("#audienceContactNotes").value = person?.notes || "";
  document.querySelector("#deleteAudienceContactButton").hidden = !person;
  document.querySelector("#audienceContactDialog").showModal();
}

document.querySelector("#editCampaignButton").addEventListener("click", openSettings);
document.querySelector("#addCampaignActionButton").addEventListener("click", () => openAction());
document.querySelector("#addIndustryGuestButton").addEventListener("click", () => openGuest());
document.querySelector("#addAudienceContactButton").addEventListener("click", () => openAudienceContact());
document.querySelectorAll("[data-close-campaign-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

document.querySelector("#campaignSettingsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  campaign.showDate = document.querySelector("#campaignShowDate").value;
  campaign.singleDate = document.querySelector("#campaignSingleDate").value;
  campaign.capacity = Number(document.querySelector("#campaignCapacity").value) || 200;
  campaign.ticketsSold = Number(document.querySelector("#campaignTicketsSold").value) || 0;
  campaign.ticketUrl = document.querySelector("#campaignTicketUrl").value.trim();
  saveCampaign(); event.currentTarget.closest("dialog").close(); renderAll();
});

document.querySelector("#campaignActionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#campaignActionId").value;
  let action = campaign.actions.find((item) => item.id === id);
  if (!action) { action = { id: makeId("campaign-action"), done: false, todoId: "" }; campaign.actions.push(action); }
  Object.assign(action, { title: document.querySelector("#campaignActionTitle").value.trim(), stream: document.querySelector("#campaignActionStream").value, dueDate: document.querySelector("#campaignActionDueDate").value, note: document.querySelector("#campaignActionNote").value.trim() });
  if (document.querySelector("#campaignActionAddToTodo").checked) addOrUpdateTodo(action);
  saveCampaign(); event.currentTarget.closest("dialog").close(); renderAll();
});

document.querySelector("#deleteCampaignActionButton").addEventListener("click", () => {
  const id = document.querySelector("#campaignActionId").value;
  if (!id || !window.confirm("Delete this campaign action?")) return;
  campaign.actions = campaign.actions.filter((action) => action.id !== id); saveCampaign(); document.querySelector("#campaignActionDialog").close(); renderAll();
});

document.querySelector("#industryGuestForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#industryGuestId").value;
  let person = campaign.industry.find((item) => item.id === id);
  if (!person) { person = { id: makeId("industry") }; campaign.industry.push(person); }
  Object.assign(person, { name: document.querySelector("#industryGuestName").value.trim(), company: document.querySelector("#industryGuestCompany").value.trim(), role: document.querySelector("#industryGuestRole").value.trim(), status: document.querySelector("#industryGuestStatus").value, nextMove: document.querySelector("#industryGuestNextMove").value.trim(), notes: document.querySelector("#industryGuestNotes").value.trim() });
  saveCampaign(); event.currentTarget.closest("dialog").close(); renderAll();
});

document.querySelector("#deleteIndustryGuestButton").addEventListener("click", () => {
  const id = document.querySelector("#industryGuestId").value;
  if (!id || !window.confirm("Remove this person from the industry list?")) return;
  campaign.industry = campaign.industry.filter((person) => person.id !== id); saveCampaign(); document.querySelector("#industryGuestDialog").close(); renderAll();
});

document.querySelector("#audienceContactForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#audienceContactId").value;
  const names = document.querySelector("#audienceContactName").value.split(/\n+/).map((name) => name.trim()).filter(Boolean);
  if (!names.length) return;
  const values = {
    group: document.querySelector("#audienceContactGroup").value,
    status: document.querySelector("#audienceContactStatus").value,
    contact: document.querySelector("#audienceContactDetail").value.trim(),
    owner: document.querySelector("#audienceContactOwner").value.trim(),
    followUpDate: document.querySelector("#audienceContactFollowUp").value,
    tickets: Math.max(0, Number(document.querySelector("#audienceContactTickets").value) || 0),
    nextMove: document.querySelector("#audienceContactNextMove").value.trim(),
    notes: document.querySelector("#audienceContactNotes").value.trim(),
    updatedAt: new Date().toISOString()
  };
  if (id) {
    const person = campaign.audience.find((item) => item.id === id);
    if (person) Object.assign(person, values, { name: names[0] });
  } else {
    names.forEach((name) => campaign.audience.push({ id: makeId("audience"), name, ...values, createdAt: new Date().toISOString() }));
  }
  saveCampaign(); event.currentTarget.closest("dialog").close(); renderAll();
});

document.querySelector("#deleteAudienceContactButton").addEventListener("click", () => {
  const id = document.querySelector("#audienceContactId").value;
  if (!id || !window.confirm("Remove this person from the audience CRM?")) return;
  campaign.audience = campaign.audience.filter((person) => person.id !== id); saveCampaign(); document.querySelector("#audienceContactDialog").close(); renderAll();
});

document.querySelector("#campaignActionBoard").addEventListener("click", (event) => {
  const card = event.target.closest(".campaign-action");
  if (!card) return;
  const action = campaign.actions.find((item) => item.id === card.dataset.id);
  if (!action) return;
  if (event.target.matches('[data-action="toggle"]')) { action.done = event.target.checked; syncActionCompletion(action); saveCampaign(); renderAll(); }
  if (event.target.closest('[data-action="edit"]')) openAction(action.id);
});

document.querySelector("#industryList").addEventListener("click", (event) => { const person = event.target.closest(".industry-person"); if (person) openGuest(person.dataset.id); });
document.querySelector("#audienceList").addEventListener("click", (event) => { const person = event.target.closest(".audience-person"); if (person) openAudienceContact(person.dataset.id); });
document.querySelector("#audienceFilters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]"); if (!button) return;
  audienceFilter = button.dataset.filter; document.querySelectorAll("#audienceFilters button").forEach((item) => item.classList.toggle("active", item === button)); renderAudience();
});
document.querySelector("#audienceSearch").addEventListener("input", (event) => { audienceSearchTerm = event.target.value; renderAudience(); });
document.querySelector("#actionFilters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]"); if (!button) return;
  actionFilter = button.dataset.filter; document.querySelectorAll("#actionFilters button").forEach((item) => item.classList.toggle("active", item === button)); renderActions();
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  if (!keys.includes(campaignStorageKey) && !keys.includes(campaignTodoStorageKey)) return;
  window.EllaCloudSync?.deferUiRefresh?.(() => { campaign = loadCampaign(); reconcileTodos(); renderAll(); });
});

reconcileTodos();
renderAll();
