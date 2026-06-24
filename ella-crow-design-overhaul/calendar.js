const gigStorageKey = "ella-crow-gigs-v2";
const sessionStorageKey = "ella-crow-sessions-v1";

let currentMonth = new Date();
currentMonth.setDate(1);
let selectedDate = localDateString(new Date());

const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const selectedTitle = document.querySelector("#selectedDateTitle");
const selectedEvents = document.querySelector("#selectedDateEvents");

function readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function allEvents() {
  const gigs = readList(gigStorageKey).map((gig) => ({
    type: "Gig",
    title: gig.title,
    date: gig.date,
    time: gig.time,
    status: gig.status,
    location: [gig.venue, gig.location].filter(Boolean).join(", ")
  }));
  const sessions = readList(sessionStorageKey).map((session) => ({
    type: session.type || "Session",
    title: session.title,
    date: session.date,
    time: session.time,
    status: session.status,
    location: session.location
  }));
  return [...gigs, ...sessions].filter((event) => event.date);
}

function eventsForDate(dateString) {
  return allEvents()
    .filter((event) => event.date === dateString)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

function renderCalendar() {
  calendarTitle.textContent = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(currentMonth);

  const firstDay = new Date(currentMonth);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateString = localDateString(date);
    const events = eventsForDate(dateString);
    const otherMonth = date.getMonth() !== currentMonth.getMonth();
    const active = dateString === selectedDate;
    cells.push(`
      <button class="calendar-day${otherMonth ? " muted" : ""}${events.length ? " has-events" : ""}${active ? " selected" : ""}" data-date="${dateString}" type="button">
        <span>${date.getDate()}</span>
        ${events.slice(0, 3).map((event) => `<small>${escapeHtml(event.type)}</small>`).join("")}
      </button>
    `);
  }
  calendarGrid.innerHTML = cells.join("");
  renderSelectedDate();
}

function renderSelectedDate() {
  selectedTitle.textContent = formatDate(selectedDate);
  const events = eventsForDate(selectedDate);
  selectedEvents.innerHTML = events.length
    ? events.map((event) => `
      <article class="calendar-event">
        <strong>${escapeHtml(event.type)}: ${escapeHtml(event.title)}</strong>
        <span>${event.time ? `${escapeHtml(event.time)} · ` : ""}${escapeHtml(event.location || "Location TBC")}</span>
        <em>${escapeHtml(event.status || "booked")}</em>
      </article>
    `).join("")
    : '<p class="section-empty">Nothing scheduled on this date.</p>';
}

document.querySelector("#prevMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

calendarGrid.addEventListener("click", (event) => {
  const day = event.target.closest(".calendar-day");
  if (!day) return;
  selectedDate = day.dataset.date;
  renderCalendar();
});

renderCalendar();
