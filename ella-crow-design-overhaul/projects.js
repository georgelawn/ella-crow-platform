const projectStorageKey = "ella-crow-projects-v1";

let projects = loadProjects();
let activeFilter = "active";
let editingProjectId = "";
const openProjectIds = new Set();

const form = document.querySelector("#projectForm");
const list = document.querySelector("#projectList");
const emptyState = document.querySelector("#projectEmptyState");
const clearButton = document.querySelector("#clearProjectButton");

const fields = {
  title: document.querySelector("#projectTitle"),
  category: document.querySelector("#projectCategory"),
  status: document.querySelector("#projectStatus"),
  deadline: document.querySelector("#projectDeadline"),
  revenue: document.querySelector("#projectRevenueInput"),
  owner: document.querySelector("#projectOwner"),
  description: document.querySelector("#projectDescription"),
  steps: document.querySelector("#projectSteps")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(projectStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeProject) : [];
  } catch {
    return [];
  }
}

function normalizeProject(project) {
  return {
    id: project.id || crypto.randomUUID(),
    title: project.title || "Untitled project",
    category: project.category || "other",
    status: project.status || "idea",
    deadline: project.deadline || "",
    revenue: Number(project.revenue || 0),
    owner: project.owner || "",
    description: project.description || "",
    steps: Array.isArray(project.steps)
      ? project.steps.map((step) => typeof step === "string"
        ? { id: crypto.randomUUID(), title: step, done: false }
        : { id: step.id || crypto.randomUUID(), title: step.title || "", done: Boolean(step.done) })
      : [],
    createdAt: project.createdAt || new Date().toISOString()
  };
}

function saveProjects() {
  localStorage.setItem(projectStorageKey, JSON.stringify(projects));
}

function progressFor(project) {
  if (project.status === "complete") return 100;
  if (!project.steps.length) return 0;
  return Math.round((project.steps.filter((step) => step.done).length / project.steps.length) * 100);
}

function isComplete(project) {
  return project.status === "complete";
}

function isAtRisk(project) {
  if (isComplete(project)) return false;
  if (project.status === "blocked") return true;
  if (!project.deadline) return false;
  return new Date(`${project.deadline}T23:59:59`).getTime() < Date.now();
}

function nextStep(project) {
  return project.steps.find((step) => !step.done)?.title || (isComplete(project) ? "Project complete" : "Add the next milestone");
}

function statusLabel(status) {
  return {
    idea: "Idea",
    planning: "Planning",
    "in-progress": "In progress",
    blocked: "Blocked",
    complete: "Complete"
  }[status] || "Idea";
}

function categoryLabel(category) {
  return {
    release: "Release",
    touring: "Touring",
    merchandise: "Merchandise",
    content: "Content",
    partnership: "Partnership",
    other: "Other"
  }[category] || "Other";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(dateString) {
  if (!dateString) return "No finish line";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function renderSummary() {
  const active = projects.filter((project) => !isComplete(project));
  const average = active.length
    ? Math.round(active.reduce((sum, project) => sum + progressFor(project), 0) / active.length)
    : 0;
  const revenue = active.reduce((sum, project) => sum + Number(project.revenue || 0), 0);

  document.querySelector("#activeProjectCount").textContent = active.length;
  document.querySelector("#portfolioProgress").textContent = `${average}%`;
  document.querySelector("#projectRevenue").textContent = formatMoney(revenue);
  document.querySelector("#atRiskProjectCount").textContent = projects.filter(isAtRisk).length;

  const focus = active
    .slice()
    .sort((a, b) => {
      if (isAtRisk(a) !== isAtRisk(b)) return isAtRisk(a) ? -1 : 1;
      return progressFor(b) - progressFor(a);
    })[0];

  document.querySelector("#focusProject").textContent = focus?.title || "Nothing live yet";
  document.querySelector("#focusNextStep").textContent = focus
    ? `Next move: ${nextStep(focus)}`
    : "Launch a project to set the next move.";
  document.querySelector("#focusProgress").textContent = `${focus ? progressFor(focus) : 0}%`;
  document.querySelector("#portfolioPulse").classList.toggle("attention", Boolean(focus && isAtRisk(focus)));
}

function filteredProjects() {
  return projects
    .filter((project) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "complete") return isComplete(project);
      if (activeFilter === "attention") return isAtRisk(project);
      return !isComplete(project);
    })
    .sort((a, b) => {
      if (isAtRisk(a) !== isAtRisk(b)) return isAtRisk(a) ? -1 : 1;
      if (isComplete(a) !== isComplete(b)) return isComplete(a) ? 1 : -1;
      return progressFor(b) - progressFor(a);
    });
}

function renderStep(project, step) {
  return `
    <label class="milestone${step.done ? " done" : ""}">
      <input type="checkbox" data-action="toggle-step" data-project-id="${escapeHtml(project.id)}" data-step-id="${escapeHtml(step.id)}"${step.done ? " checked" : ""}>
      <span>${escapeHtml(step.title)}</span>
      <button class="milestone-delete" data-action="delete-step" data-project-id="${escapeHtml(project.id)}" data-step-id="${escapeHtml(step.id)}" type="button" aria-label="Delete milestone">×</button>
    </label>
  `;
}

function renderProject(project) {
  if (editingProjectId === project.id) return renderEditableProject(project);

  const progress = progressFor(project);
  const completedSteps = project.steps.filter((step) => step.done).length;
  const riskClass = isAtRisk(project) ? " attention" : "";
  const completeClass = isComplete(project) ? " complete" : "";
  const open = openProjectIds.has(project.id) ? " open" : "";

  return `
    <details class="project-card${riskClass}${completeClass}" data-id="${escapeHtml(project.id)}"${open}>
      <summary>
        <div class="progress-orbit" style="--progress: ${progress * 3.6}deg">
          <span>${progress}%</span>
        </div>
        <div class="project-card-title">
          <div class="project-kicker">
            <span>${escapeHtml(categoryLabel(project.category))}</span>
            <span>${escapeHtml(statusLabel(project.status))}</span>
            ${isAtRisk(project) ? "<span>Needs attention</span>" : ""}
          </div>
          <h3>${escapeHtml(project.title)}</h3>
          <p><strong>Next move:</strong> ${escapeHtml(nextStep(project))}</p>
        </div>
        <div class="project-card-score">
          <strong>${completedSteps}/${project.steps.length}</strong>
          <span>Milestones</span>
        </div>
      </summary>

      <div class="project-details">
        <div class="project-story">
          <span>Definition of done</span>
          <p>${escapeHtml(project.description || "No definition of done added yet.")}</p>
        </div>

        <div class="project-stat">
          <span>Finish line</span>
          <strong>${escapeHtml(formatDate(project.deadline))}</strong>
        </div>
        <div class="project-stat">
          <span>Revenue potential</span>
          <strong>${escapeHtml(formatMoney(project.revenue))}</strong>
        </div>
        <div class="project-stat">
          <span>Project lead</span>
          <strong>${escapeHtml(project.owner || "Unassigned")}</strong>
        </div>

        <section class="milestone-section">
          <div class="milestone-heading">
            <div>
              <span>Route to the finish line</span>
              <strong>${progress}% complete</strong>
            </div>
            <div class="project-progress-track"><i style="width: ${progress}%"></i></div>
          </div>
          <div class="milestone-list">
            ${project.steps.length ? project.steps.map((step) => renderStep(project, step)).join("") : "<p class=\"project-no-steps\">No milestones yet. Add the first move below.</p>"}
          </div>
          <div class="add-milestone">
            <input data-role="new-step" placeholder="Add the next milestone">
            <button class="small-button" data-action="add-step" data-project-id="${escapeHtml(project.id)}" type="button">Add step</button>
          </div>
        </section>

        <div class="card-actions">
          <button class="small-button" data-action="edit" data-project-id="${escapeHtml(project.id)}" type="button">Edit project</button>
          <button class="small-button danger" data-action="delete" data-project-id="${escapeHtml(project.id)}" type="button">Delete</button>
        </div>
      </div>
    </details>
  `;
}

function renderEditableProject(project) {
  return `
    <article class="project-card project-editing" data-id="${escapeHtml(project.id)}">
      <div class="project-edit-grid">
        <label class="full">Project / revenue stream
          <input class="project-field" data-field="title" value="${escapeHtml(project.title)}">
        </label>
        <label>Type
          <select class="project-field" data-field="category">
            ${["release", "touring", "merchandise", "content", "partnership", "other"].map((value) => `<option value="${value}"${project.category === value ? " selected" : ""}>${categoryLabel(value)}</option>`).join("")}
          </select>
        </label>
        <label>Stage
          <select class="project-field" data-field="status">
            ${["idea", "planning", "in-progress", "blocked", "complete"].map((value) => `<option value="${value}"${project.status === value ? " selected" : ""}>${statusLabel(value)}</option>`).join("")}
          </select>
        </label>
        <label>Finish line
          <input class="project-field" data-field="deadline" type="date" value="${escapeHtml(project.deadline)}">
        </label>
        <label>Revenue potential
          <input class="project-field" data-field="revenue" type="number" min="0" value="${escapeHtml(project.revenue)}">
        </label>
        <label class="full">Project lead
          <input class="project-field" data-field="owner" value="${escapeHtml(project.owner)}">
        </label>
        <label class="full">Definition of done
          <textarea class="project-field" data-field="description" rows="4">${escapeHtml(project.description)}</textarea>
        </label>
      </div>
      <div class="card-actions">
        <span class="contact-save-note">Saves automatically</span>
        <button class="small-button" data-action="done-editing" data-project-id="${escapeHtml(project.id)}" type="button">Done</button>
        <button class="small-button danger" data-action="delete" data-project-id="${escapeHtml(project.id)}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderProjects() {
  renderSummary();
  const visible = filteredProjects();
  emptyState.classList.toggle("visible", visible.length === 0);
  list.innerHTML = visible.map(renderProject).join("");
}

function updateProjectField(element) {
  const card = element.closest("[data-id]");
  const project = projects.find((item) => item.id === card?.dataset.id);
  if (!project) return;
  project[element.dataset.field] = element.dataset.field === "revenue" ? Number(element.value || 0) : element.value;
  saveProjects();
  editingProjectId = project.id;
  renderProjects();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = fields.title.value.trim();
  if (!title) return;

  projects.push(normalizeProject({
    id: crypto.randomUUID(),
    title,
    category: fields.category.value,
    status: fields.status.value,
    deadline: fields.deadline.value,
    revenue: fields.revenue.value,
    owner: fields.owner.value.trim(),
    description: fields.description.value.trim(),
    steps: fields.steps.value.split("\n").map((step) => step.trim()).filter(Boolean),
    createdAt: new Date().toISOString()
  }));

  saveProjects();
  form.reset();
  renderProjects();
});

clearButton.addEventListener("click", () => form.reset());

list.addEventListener("toggle", (event) => {
  const card = event.target.closest("details.project-card");
  if (!card) return;
  if (card.open) openProjectIds.add(card.dataset.id);
  else openProjectIds.delete(card.dataset.id);
}, true);

list.addEventListener("change", (event) => {
  if (event.target.matches(".project-field")) {
    updateProjectField(event.target);
    return;
  }
  if (event.target.dataset.action !== "toggle-step") return;
  const project = projects.find((item) => item.id === event.target.dataset.projectId);
  const step = project?.steps.find((item) => item.id === event.target.dataset.stepId);
  if (!step) return;
  step.done = event.target.checked;
  openProjectIds.add(project.id);
  saveProjects();
  renderProjects();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const project = projects.find((item) => item.id === button.dataset.projectId);

  if (button.dataset.action === "add-step" && project) {
    const input = button.closest(".add-milestone")?.querySelector("[data-role='new-step']");
    const title = input?.value.trim();
    if (!title) return;
    project.steps.push({ id: crypto.randomUUID(), title, done: false });
    openProjectIds.add(project.id);
    saveProjects();
    renderProjects();
  }

  if (button.dataset.action === "delete-step" && project) {
    project.steps = project.steps.filter((step) => step.id !== button.dataset.stepId);
    openProjectIds.add(project.id);
    saveProjects();
    renderProjects();
  }

  if (button.dataset.action === "edit" && project) {
    editingProjectId = project.id;
    renderProjects();
  }

  if (button.dataset.action === "done-editing") {
    editingProjectId = "";
    renderProjects();
  }

  if (button.dataset.action === "delete" && project) {
    projects = projects.filter((item) => item.id !== project.id);
    editingProjectId = "";
    saveProjects();
    renderProjects();
  }
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderProjects();
  });
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  if (!event.detail?.keys?.includes(projectStorageKey)) return;
  projects = loadProjects();
  renderProjects();
});

renderProjects();
