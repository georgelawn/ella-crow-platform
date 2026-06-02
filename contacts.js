const contactStorageKey = "ella-crow-contacts-v1";
const rosterKey = "ella-crow-roster-v1";
const rosterMigrationKey = "ella-crow-roster-migrated-v1";
const instrumentStorageKey = "ella-crow-instruments-v1";
const defaultRoster = ["George", "Vincent", "Amelia", "Alex", "Simon"];
const defaultInstruments = ["Drums", "Keys", "Lead Guitar", "Bass", "BVs"];
const addInstrumentValue = "__add_instrument__";
const categories = ["Musicians", "Promoters", "Venues", "Other Artists", "Misc"];

let contacts = loadContacts();
let instruments = loadInstruments();
let activeFilter = "all";
let musicianInstrumentFilter = "all";
let editingContactId = "";
let expandedContactId = "";

const form = document.querySelector("#contactForm");
const clearButton = document.querySelector("#clearContactButton");
const sections = document.querySelector("#contactSections");
const emptyState = document.querySelector("#contactEmptyState");
const formTitle = document.querySelector("#contactFormTitle");

const fields = {
  id: document.querySelector("#contactId"),
  category: document.querySelector("#contactCategory"),
  instrument: document.querySelector("#contactInstrument"),
  instrumentField: document.querySelector("#instrumentField"),
  genre: document.querySelector("#contactGenre"),
  genreField: document.querySelector("#genreField"),
  promoterContact: document.querySelector("#promoterContactName"),
  promoterContactField: document.querySelector("#promoterContactField"),
  name: document.querySelector("#contactName"),
  nameLabel: document.querySelector("#contactNameLabel"),
  phone: document.querySelector("#contactPhone"),
  email: document.querySelector("#contactEmail"),
  description: document.querySelector("#contactDescription")
};

function loadContacts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(contactStorageKey) || "[]");
    const savedContacts = normalizeContactCategories(Array.isArray(parsed) ? parsed : []);
    return migrateRosterToContacts(savedContacts);
  } catch {
    return migrateRosterToContacts([]);
  }
}

function saveContacts() {
  localStorage.setItem(contactStorageKey, JSON.stringify(contacts));
}

function normalizeContactCategories(savedContacts) {
  let changed = false;
  const normalized = savedContacts.map((contact) => {
    if (contact.category !== "Venue Owners") return contact;
    changed = true;
    return {
      ...contact,
      category: "Venues",
      name: contact.venueName || contact.name,
      promoterContact: contact.promoterContact || (contact.venueName ? contact.name : ""),
      venueName: ""
    };
  });

  if (changed) {
    localStorage.setItem(contactStorageKey, JSON.stringify(normalized));
  }
  return normalized;
}

function loadInstruments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(instrumentStorageKey) || "[]");
    return Array.isArray(parsed) && parsed.length ? uniqueNames(parsed) : defaultInstruments;
  } catch {
    return defaultInstruments;
  }
}

function saveInstruments() {
  localStorage.setItem(instrumentStorageKey, JSON.stringify(instruments));
}

function loadLegacyRoster() {
  try {
    const parsed = JSON.parse(localStorage.getItem(rosterKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateRosterToContacts(savedContacts) {
  if (localStorage.getItem(rosterMigrationKey)) return savedContacts;

  const contactsToSave = [...savedContacts];
  const names = uniqueNames([...defaultRoster, ...loadLegacyRoster()]);
  let changed = false;

  names.forEach((name) => {
    if (!findMusicianContact(contactsToSave, name)) {
      contactsToSave.push(createMusicianContact(name));
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem(contactStorageKey, JSON.stringify(contactsToSave));
  }
  localStorage.setItem(rosterMigrationKey, "true");
  return contactsToSave;
}

function uniqueNames(names) {
  return names
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .filter((name, index, array) => array.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index)
    .sort((a, b) => a.localeCompare(b));
}

function findMusicianContact(contactList, name) {
  return contactList.find((contact) =>
    contact.category === "Musicians" &&
    contact.name.toLowerCase() === name.toLowerCase()
  );
}

function createMusicianContact(name) {
  return {
    id: crypto.randomUUID(),
    category: "Musicians",
    name,
    phone: "",
    email: "",
    instrument: "",
    description: ""
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value, fallback = "Not added yet") {
  const clean = String(value ?? "").trim();
  return clean ? escapeHtml(clean) : fallback;
}

function visibleCategories() {
  return activeFilter === "all" ? categories : categories.filter((category) => category === activeFilter);
}

function renderSummary() {
  document.querySelector("#totalContacts").textContent = contacts.length;
  document.querySelector("#musicianContacts").textContent = contacts.filter((contact) => contact.category === "Musicians").length;
  document.querySelector("#promoterContacts").textContent = contacts.filter((contact) => contact.category === "Promoters").length;
  document.querySelector("#venueOwnerContacts").textContent = contacts.filter((contact) => contact.category === "Venues").length;
}

function renderContacts() {
  renderSummary();
  const selectedCategories = visibleCategories();
  const visibleContacts = contacts.filter((contact) => selectedCategories.includes(contact.category));

  emptyState.classList.toggle("visible", visibleContacts.length === 0);
  sections.innerHTML = selectedCategories.map(renderSection).join("");
}

function renderSection(category) {
  const sectionContacts = contacts
    .filter((contact) => contact.category === category)
    .filter((contact) => {
      if (category !== "Musicians" || musicianInstrumentFilter === "all") return true;
      return (contact.instrument || "") === musicianInstrumentFilter;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
    <section class="contact-section">
      <div class="contact-section-heading">
        <h3>${escapeHtml(category)}</h3>
        <span>${sectionContacts.length}</span>
      </div>
      ${category === "Musicians" ? `
        <label class="musician-search">
          <span>Filter by instrument</span>
          <select id="musicianInstrumentFilter">
            <option value="all"${musicianInstrumentFilter === "all" ? " selected" : ""}>All instruments</option>
            <option value=""${musicianInstrumentFilter === "" ? " selected" : ""}>No instrument</option>
            ${instruments.map((instrument) => `<option value="${escapeHtml(instrument)}"${musicianInstrumentFilter === instrument ? " selected" : ""}>${escapeHtml(instrument)}</option>`).join("")}
          </select>
        </label>
      ` : ""}
      <div class="contact-list">
        ${sectionContacts.length ? sectionContacts.map(renderContactCard).join("") : '<p class="section-empty">No contacts in this section yet.</p>'}
      </div>
    </section>
  `;
}

function renderContactCard(contact) {
  if (editingContactId === contact.id) {
    return renderEditableContactCard(contact);
  }

  return `
    <article class="contact-card${expandedContactId === contact.id ? " expanded" : ""}" data-id="${contact.id}" data-category="${escapeHtml(contact.category)}" role="button" tabindex="0" aria-expanded="${expandedContactId === contact.id ? "true" : "false"}">
      <div class="contact-card-head">
        <p class="eyebrow">${escapeHtml(contact.category)}</p>
        <h4>${escapeHtml(contact.name)}</h4>
      </div>
      <dl class="contact-display">
        ${contact.category === "Promoters" ? `
          <div>
            <dt>Company name</dt>
            <dd>${displayValue(contact.name)}</dd>
          </div>
        ` : ""}
        ${contact.category === "Musicians" ? `
          <div>
            <dt>Instrument</dt>
            <dd>${displayValue(contact.instrument)}</dd>
          </div>
        ` : ""}
        ${contact.category === "Other Artists" ? `
          <div>
            <dt>Genre</dt>
            <dd>${displayValue(contact.genre)}</dd>
          </div>
        ` : ""}
        ${["Promoters", "Venues"].includes(contact.category) ? `
          <div>
            <dt>Contact name</dt>
            <dd>${displayValue(contact.promoterContact)}</dd>
          </div>
        ` : ""}
        <div>
          <dt>Phone</dt>
          <dd>${displayValue(contact.phone)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : "Not added yet"}</dd>
        </div>
        <div class="contact-description-field">
          <dt>Description</dt>
          <dd>${displayValue(contact.description)}</dd>
        </div>
      </dl>
      <div class="card-actions">
        <button class="small-button" data-action="edit" data-id="${contact.id}" type="button">Edit</button>
        <button class="small-button danger" data-action="delete" data-id="${contact.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderEditableContactCard(contact) {
  return `
    <article class="contact-card editing" data-id="${contact.id}" data-category="${escapeHtml(contact.category)}">
      <label class="contact-inline full">
        <span>Section</span>
        <select class="contact-field" data-field="category">
          ${categories.map((category) => `<option value="${escapeHtml(category)}"${contact.category === category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}
        </select>
      </label>
      <label class="contact-inline full">
        <span>${nameLabelForCategory(contact.category)}</span>
        <input class="contact-field contact-name-field" data-field="name" value="${escapeHtml(contact.name)}">
      </label>
      ${contact.category === "Musicians" ? `
        <label class="contact-inline full">
          <span>Instrument</span>
          <select class="contact-field instrument-select" data-field="instrument">
            ${instrumentOptions(contact.instrument || "")}
          </select>
        </label>
      ` : ""}
      ${contact.category === "Other Artists" ? `
        <label class="contact-inline full">
          <span>Genre</span>
          <input class="contact-field" data-field="genre" value="${escapeHtml(contact.genre || "")}">
        </label>
      ` : ""}
      ${["Promoters", "Venues"].includes(contact.category) ? `
        <label class="contact-inline full">
          <span>Contact name</span>
          <input class="contact-field" data-field="promoterContact" value="${escapeHtml(contact.promoterContact || "")}">
        </label>
      ` : ""}
      <label class="contact-inline">
        <span>Phone</span>
        <input class="contact-field" data-field="phone" value="${escapeHtml(contact.phone || "")}">
      </label>
      <label class="contact-inline">
        <span>Email</span>
        <input class="contact-field" data-field="email" type="email" value="${escapeHtml(contact.email || "")}">
      </label>
      <label class="contact-inline full">
        <span>Description</span>
        <textarea class="contact-field" data-field="description" rows="4">${escapeHtml(contact.description || "")}</textarea>
      </label>
      <div class="card-actions">
        <span class="contact-save-note">Saves automatically</span>
        <button class="small-button" data-action="done-editing" data-id="${contact.id}" type="button">Done</button>
        <button class="small-button danger" data-action="delete" data-id="${contact.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function readForm() {
  return {
    id: fields.id.value || crypto.randomUUID(),
    category: fields.category.value,
    name: fields.name.value.trim(),
    phone: fields.phone.value.trim(),
    email: fields.email.value.trim(),
    instrument: fields.category.value === "Musicians" ? fields.instrument.value : "",
    genre: fields.category.value === "Other Artists" ? fields.genre.value.trim() : "",
    promoterContact: ["Promoters", "Venues"].includes(fields.category.value) ? fields.promoterContact.value.trim() : "",
    venueName: "",
    description: fields.description.value.trim()
  };
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  formTitle.textContent = "Add contact";
  syncConditionalFields();
}

function deleteContact(id) {
  const contact = contacts.find((item) => item.id === id);
  if (!contact) return;
  const confirmed = window.confirm(`Delete "${contact.name}"?`);
  if (!confirmed) return;

  contacts = contacts.filter((item) => item.id !== id);
  saveContacts();
  editingContactId = "";
  renderContacts();
  resetForm();
}

function saveContactField(element) {
  const card = element.closest(".contact-card");
  const id = card?.dataset.id;
  const field = element.dataset.field;
  const contact = contacts.find((item) => item.id === id);
  if (!contact || !field) return;

  if (field === "instrument" && element.value === addInstrumentValue) {
    const newInstrument = window.prompt("Add a new instrument");
    if (!newInstrument || !newInstrument.trim()) {
      renderContacts();
      return;
    }
    addInstrument(newInstrument.trim());
    contact.instrument = newInstrument.trim();
  } else {
    contact[field] = element.value.trim();
  }

  if (field === "category" && contact.category !== "Musicians") {
    contact.instrument = "";
  }
  if (field === "category" && contact.category !== "Other Artists") {
    contact.genre = "";
  }
  if (field === "category" && !["Promoters", "Venues"].includes(contact.category)) {
    contact.promoterContact = "";
  }
  contact.venueName = "";

  if (!contact.name) return;

  const duplicateMusician = contacts.find((item) =>
    item.id !== contact.id &&
    contact.category === "Musicians" &&
    item.category === "Musicians" &&
    item.name.toLowerCase() === contact.name.toLowerCase()
  );

  if (duplicateMusician) {
    contact.name = `${contact.name} copy`;
  }

  saveContacts();
  editingContactId = contact.id;
  renderContacts();
}

function instrumentOptions(selectedInstrument = "") {
  return `
    <option value="">Choose instrument</option>
    ${instruments.map((instrument) => `<option value="${escapeHtml(instrument)}"${selectedInstrument === instrument ? " selected" : ""}>${escapeHtml(instrument)}</option>`).join("")}
    <option value="${addInstrumentValue}">Add Instrument</option>
  `;
}

function addInstrument(instrument) {
  if (!instruments.some((item) => item.toLowerCase() === instrument.toLowerCase())) {
    instruments.push(instrument);
    instruments = uniqueNames(instruments);
    saveInstruments();
  }
}

function syncInstrumentSelect(select, selectedInstrument = "") {
  select.innerHTML = instrumentOptions(selectedInstrument);
}

function syncInstrumentField() {
  const showInstrument = fields.category.value === "Musicians";
  fields.instrumentField.hidden = !showInstrument;
  syncInstrumentSelect(fields.instrument, fields.instrument.value);
  if (!showInstrument) {
    fields.instrument.value = "";
  }
}

function syncPromoterField() {
  const showPromoterContact = ["Promoters", "Venues"].includes(fields.category.value);
  fields.promoterContactField.hidden = !showPromoterContact;
  if (!showPromoterContact) {
    fields.promoterContact.value = "";
  }
}

function syncGenreField() {
  const showGenre = fields.category.value === "Other Artists";
  fields.genreField.hidden = !showGenre;
  if (!showGenre) {
    fields.genre.value = "";
  }
}

function syncConditionalFields() {
  fields.nameLabel.textContent = nameLabelForCategory(fields.category.value);
  fields.name.placeholder = namePlaceholderForCategory(fields.category.value);
  syncInstrumentField();
  syncGenreField();
  syncPromoterField();
}

function nameLabelForCategory(category) {
  if (category === "Promoters") return "Company name";
  if (category === "Venues") return "Venue name";
  return "Name";
}

function namePlaceholderForCategory(category) {
  if (category === "Promoters") return "Promoter company name";
  if (category === "Venues") return "Venue name";
  return "Contact name";
}

function handleNewContactInstrument() {
  if (fields.instrument.value !== addInstrumentValue) return;
  const newInstrument = window.prompt("Add a new instrument");
  if (!newInstrument || !newInstrument.trim()) {
    syncInstrumentSelect(fields.instrument);
    return;
  }
  addInstrument(newInstrument.trim());
  syncInstrumentSelect(fields.instrument, newInstrument.trim());
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const contact = readForm();
  if (!contact.name) return;

  const index = contacts.findIndex((item) => item.id === contact.id);
  const existingMusicianIndex = contacts.findIndex((item) =>
    item.id !== contact.id &&
    contact.category === "Musicians" &&
    item.category === "Musicians" &&
    item.name.toLowerCase() === contact.name.toLowerCase()
  );

  if (index >= 0) {
    contacts[index] = contact;
  } else if (existingMusicianIndex >= 0) {
    contacts[existingMusicianIndex] = {
      ...contacts[existingMusicianIndex],
      ...contact,
      id: contacts[existingMusicianIndex].id
    };
  } else {
    contacts.push(contact);
  }

  saveContacts();
  editingContactId = "";
  renderContacts();
  resetForm();
});

clearButton.addEventListener("click", resetForm);

sections.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) {
    event.stopPropagation();

    if (button.dataset.action === "edit") {
      editingContactId = button.dataset.id;
      expandedContactId = "";
      renderContacts();
    }
    if (button.dataset.action === "done-editing") {
      editingContactId = "";
      renderContacts();
    }
    if (button.dataset.action === "delete") deleteContact(button.dataset.id);
    return;
  }

  if (event.target.closest("a, input, select, textarea, label")) return;
  const card = event.target.closest(".contact-card:not(.editing)");
  if (!card) return;
  expandedContactId = expandedContactId === card.dataset.id ? "" : card.dataset.id;
  renderContacts();
});

sections.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".contact-card:not(.editing)");
  if (!card || event.target !== card) return;
  event.preventDefault();
  expandedContactId = expandedContactId === card.dataset.id ? "" : card.dataset.id;
  renderContacts();
});

sections.addEventListener("change", (event) => {
  if (event.target.matches("#musicianInstrumentFilter")) {
    musicianInstrumentFilter = event.target.value;
    renderContacts();
    return;
  }
  if (event.target.matches(".contact-field")) saveContactField(event.target);
});

fields.category.addEventListener("change", syncConditionalFields);
fields.instrument.addEventListener("change", handleNewContactInstrument);

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderContacts();
  });
});

syncInstrumentSelect(fields.instrument);
syncConditionalFields();
renderContacts();
