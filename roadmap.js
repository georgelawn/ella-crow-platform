const roadmapStorageKey = "ella-crow-roadmap-v1";
const roadmapTodoStorageKey = "ella-crow-manual-todos-v1";

const defaultRoadmap = {
  title: "The next chapter",
  description: "Build momentum, open the right doors and arrive at 4 December with the story moving.",
  startDate: "2026-07-28",
  targetDate: "2026-12-04",
  checkpoints: [
    {
      id: "masters-ready",
      title: "Masters in hand",
      date: "2026-07-28",
      status: "complete",
      goal: "Six high-quality mastered recordings ready to build the next campaign around.",
      notes: "Five Nashville masters plus You Can't Have It.",
      tasks: []
    },
    {
      id: "campaign-architecture",
      title: "Set the campaign architecture",
      date: "2026-08-07",
      status: "active",
      goal: "Agree the story, assets, release roles and exactly what a label should add.",
      notes: "Keep every checkpoint editable as the strategy develops.",
      tasks: [
        {
          id: "rank-nashville-songs",
          title: "Rank the Nashville songs by campaign role",
          dueDate: "2026-08-05",
          done: false,
          todoId: ""
        }
      ]
    },
    {
      id: "label-materials",
      title: "Label materials ready",
      date: "2026-08-14",
      status: "planned",
      goal: "Private listening links, concise artist story, live evidence and campaign data ready to share.",
      notes: "",
      tasks: [
        {
          id: "label-deck",
          title: "Complete the first label presentation",
          dueDate: "2026-08-12",
          done: false,
          todoId: ""
        }
      ]
    },
    {
      id: "you-cant-have-it",
      title: "You Can't Have It",
      date: "2026-09-01",
      status: "planned",
      goal: "Release the single with a focused story and use it to demonstrate audience movement.",
      notes: "Distribution support confirmed.",
      tasks: []
    },
    {
      id: "campaign-signal",
      title: "Read the signal",
      date: "2026-09-15",
      status: "planned",
      goal: "Review saves, followers, fan response, live reaction and the creative that travelled furthest.",
      notes: "",
      tasks: []
    },
    {
      id: "label-conversations",
      title: "Right conversations",
      date: "2026-10-15",
      status: "planned",
      goal: "Build direct relationships with a short list of labels that can materially accelerate Ella.",
      notes: "This date and approach are a draft decision point, not a fixed commitment.",
      tasks: []
    },
    {
      id: "nashville-decision",
      title: "Nashville decision gate",
      date: "2026-11-01",
      status: "planned",
      goal: "Choose the next release move based on real label interest, campaign evidence and the live build.",
      notes: "No release is committed by this checkpoint.",
      tasks: []
    },
    {
      id: "headline",
      title: "Headline show",
      date: "2026-12-04",
      status: "planned",
      goal: "Turn the headline into a defining Ella Crow moment and the opening of the next chapter.",
      notes: "",
      tasks: []
    }
  ]
};

let roadmap = loadRoadmap();

const checkpointDialog = document.querySelector("#checkpointDialog");
const checkpointForm = document.querySelector("#checkpointForm");
const taskDialog = document.querySelector("#taskDialog");
const taskForm = document.querySelector("#taskForm");
const journeyDialog = document.querySelector("#journeyDialog");
const journeyForm = document.querySelector("#journeyForm");
const roadmapTrack = document.querySelector("#roadmapTrack");
const roadmapViewport = document.querySelector("#roadmapViewport");

function cloneDefaultRoadmap() {
  return JSON.parse(JSON.stringify(defaultRoadmap));
}

function loadRoadmap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(roadmapStorageKey) || "null");
    if (!parsed || !Array.isArray(parsed.checkpoints)) return cloneDefaultRoadmap();
    return {
      ...cloneDefaultRoadmap(),
      ...parsed,
      checkpoints: parsed.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        tasks: Array.isArray(checkpoint.tasks) ? checkpoint.tasks : []
      }))
    };
  } catch {
    return cloneDefaultRoadmap();
  }
}

function saveRoadmap() {
  localStorage.setItem(roadmapStorageKey, JSON.stringify(roadmap));
}

function loadTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(roadmapTodoStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  localStorage.setItem(roadmapTodoStorageKey, JSON.stringify(todos));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString, includeYear = false) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(date);
}

function midpointDate(firstDate, secondDate) {
  const first = new Date(`${firstDate}T12:00:00`);
  const second = new Date(`${secondDate}T12:00:00`);
  const midpoint = new Date((first.getTime() + second.getTime()) / 2);
  const year = midpoint.getFullYear();
  const month = String(midpoint.getMonth() + 1).padStart(2, "0");
  const day = String(midpoint.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStamp(dateString) {
  return new Date(`${dateString}T00:00:00`).getTime();
}

function todayStamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function allRoadmapTasks() {
  return roadmap.checkpoints.flatMap((checkpoint) =>
    checkpoint.tasks.map((task) => ({ ...task, checkpointId: checkpoint.id }))
  );
}

function journeyRangeLabel() {
  const formatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
  const start = new Date(`${roadmap.startDate}T00:00:00`);
  const target = new Date(`${roadmap.targetDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) return "The journey";
  return `${formatter.format(start)} — ${formatter.format(target)}`;
}

function reconcileTasksFromTodos() {
  const todos = loadTodos();
  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
  let changed = false;

  roadmap.checkpoints.forEach((checkpoint) => {
    checkpoint.tasks.forEach((task) => {
      if (!task.todoId) return;
      const todo = todosById.get(task.todoId);
      if (!todo) {
        task.todoId = "";
        changed = true;
        return;
      }
      if (task.done !== Boolean(todo.done)) {
        task.done = Boolean(todo.done);
        changed = true;
      }
    });
  });

  if (changed) saveRoadmap();
}

function completionProgress() {
  const checkpoints = roadmap.checkpoints;
  const tasks = allRoadmapTasks();
  const total = checkpoints.length + tasks.length;
  if (!total) return 0;
  const complete = checkpoints.filter((checkpoint) => checkpoint.status === "complete").length
    + tasks.filter((task) => task.done).length;
  return Math.round((complete / total) * 100);
}

function timelineProgress() {
  const start = dateStamp(roadmap.startDate);
  const end = dateStamp(roadmap.targetDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(100, ((todayStamp() - start) / (end - start)) * 100));
}

function roadmapHealth() {
  const overdueTasks = allRoadmapTasks().filter((task) => !task.done && dateStamp(task.dueDate) < todayStamp());
  const overdueCheckpoints = roadmap.checkpoints.filter((checkpoint) =>
    checkpoint.status !== "complete" && dateStamp(checkpoint.date) < todayStamp()
  );
  const actual = completionProgress();
  const expected = timelineProgress();

  if (overdueTasks.length || overdueCheckpoints.length || actual + 12 < expected) {
    return {
      state: "attention",
      label: "Needs attention",
      detail: overdueTasks.length || overdueCheckpoints.length
        ? `${overdueTasks.length + overdueCheckpoints.length} overdue item${overdueTasks.length + overdueCheckpoints.length === 1 ? "" : "s"} need a decision.`
        : "Progress is behind the current journey pace."
    };
  }

  if (actual > expected + 15) {
    return {
      state: "ahead",
      label: "Ahead of plan",
      detail: "Completed work is running ahead of the journey pace."
    };
  }

  return {
    state: "track",
    label: "On track",
    detail: "The journey is moving within the current plan."
  };
}

function renderTask(task, checkpointId) {
  return `
    <li class="${task.done ? "complete" : ""}">
      <label>
        <input type="checkbox" data-action="toggle-task" data-checkpoint-id="${escapeHtml(checkpointId)}" data-task-id="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}>
        <span>${escapeHtml(task.title)}</span>
      </label>
      <div>
        <small>${formatDate(task.dueDate)}</small>
        ${task.todoId ? '<i title="Added to To Do">T</i>' : ""}
        <button data-action="edit-task" data-checkpoint-id="${escapeHtml(checkpointId)}" data-task-id="${escapeHtml(task.id)}" type="button">Edit</button>
      </div>
    </li>
  `;
}

function renderCheckpoint(checkpoint, index) {
  const tasks = checkpoint.tasks || [];
  const completeTasks = tasks.filter((task) => task.done).length;
  return `
    <article class="roadmap-stop ${escapeHtml(checkpoint.status)}" data-checkpoint-id="${escapeHtml(checkpoint.id)}">
      <div class="roadmap-stop-marker">
        <span>${checkpoint.status === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="roadmap-stop-card">
        <div class="roadmap-stop-top">
          <div>
            <span>${formatDate(checkpoint.date, true)}</span>
            <i>${checkpoint.status === "complete" ? "Complete" : checkpoint.status === "active" ? "In progress" : "Planned"}</i>
          </div>
          <button data-action="edit-checkpoint" data-id="${escapeHtml(checkpoint.id)}" type="button">•••</button>
        </div>
        <h4>${escapeHtml(checkpoint.title)}</h4>
        <p>${escapeHtml(checkpoint.goal)}</p>
        ${checkpoint.notes ? `<small class="roadmap-stop-note">${escapeHtml(checkpoint.notes)}</small>` : ""}
        <div class="roadmap-stop-actions">
          <span>${tasks.length ? `${completeTasks}/${tasks.length} actions` : "No actions yet"}</span>
          <button data-action="add-task" data-id="${escapeHtml(checkpoint.id)}" type="button">+ Add action</button>
        </div>
        ${tasks.length ? `<ul class="roadmap-task-list">${tasks.map((task) => renderTask(task, checkpoint.id)).join("")}</ul>` : ""}
      </div>
    </article>
  `;
}

function renderCheckpointTrack() {
  return roadmap.checkpoints.map((checkpoint, index) => {
    const nextCheckpoint = roadmap.checkpoints[index + 1];
    const betweenButton = nextCheckpoint
      ? `
        <button
          class="roadmap-between-add"
          data-action="add-between"
          data-date="${midpointDate(checkpoint.date, nextCheckpoint.date)}"
          type="button"
          aria-label="Add checkpoint between ${escapeHtml(checkpoint.title)} and ${escapeHtml(nextCheckpoint.title)}"
          title="Add checkpoint here"
        >+</button>
      `
      : "";
    return `${renderCheckpoint(checkpoint, index)}${betweenButton}`;
  }).join("");
}

function renderRoadmap() {
  reconcileTasksFromTodos();
  roadmap.checkpoints.sort((a, b) => dateStamp(a.date) - dateStamp(b.date));
  const progress = completionProgress();
  const tasks = allRoadmapTasks();
  const overdue = tasks.filter((task) => !task.done && dateStamp(task.dueDate) < todayStamp());
  const nextCheckpoint = roadmap.checkpoints.find((checkpoint) => checkpoint.status !== "complete");
  const health = roadmapHealth();

  document.querySelector("#roadmapTitle").textContent = roadmap.title;
  document.querySelector("#roadmapDescription").textContent = roadmap.description;
  document.querySelector("#journeyRangeLabel").textContent = journeyRangeLabel();
  document.querySelector("#roadmapProgressValue").textContent = `${progress}%`;
  document.querySelector("#roadmapProgressFill").style.width = `${progress}%`;
  document.querySelector("#nextCheckpointLabel").textContent = nextCheckpoint?.title || "Journey complete";
  document.querySelector("#nextCheckpointDate").textContent = nextCheckpoint ? formatDate(nextCheckpoint.date, true) : "All checkpoints complete";
  document.querySelector("#openRoadmapTasks").textContent = tasks.filter((task) => !task.done).length;
  document.querySelector("#overdueRoadmapTasks").textContent = overdue.length
    ? `${overdue.length} overdue`
    : "Nothing overdue";
  document.querySelector("#roadmapSignalLabel").textContent = health.label;
  document.querySelector("#roadmapSignalDetail").textContent = health.detail;
  document.querySelector("#roadmapSignal").dataset.state = health.state;
  roadmapTrack.innerHTML = roadmap.checkpoints.length
    ? renderCheckpointTrack()
    : '<div class="roadmap-empty"><strong>The road is open.</strong><span>Add the first checkpoint to begin.</span></div>';
}

function findCheckpoint(id) {
  return roadmap.checkpoints.find((checkpoint) => checkpoint.id === id);
}

function openCheckpointDialog(checkpoint = null, suggestedDate = "") {
  checkpointForm.reset();
  document.querySelector("#checkpointId").value = checkpoint?.id || "";
  document.querySelector("#checkpointDialogTitle").textContent = checkpoint ? "Edit checkpoint" : "Add checkpoint";
  document.querySelector("#checkpointTitle").value = checkpoint?.title || "";
  document.querySelector("#checkpointDate").value = checkpoint?.date || suggestedDate || roadmap.targetDate;
  document.querySelector("#checkpointStatus").value = checkpoint?.status || "planned";
  document.querySelector("#checkpointGoal").value = checkpoint?.goal || "";
  document.querySelector("#checkpointNotes").value = checkpoint?.notes || "";
  document.querySelector("#deleteCheckpointButton").hidden = !checkpoint;
  checkpointDialog.showModal();
}

function openTaskDialog(checkpointId, task = null) {
  const checkpoint = findCheckpoint(checkpointId);
  if (!checkpoint) return;
  taskForm.reset();
  document.querySelector("#taskCheckpointId").value = checkpointId;
  document.querySelector("#roadmapTaskId").value = task?.id || "";
  document.querySelector("#taskDialogTitle").textContent = task ? "Edit action" : "Add action";
  document.querySelector("#roadmapTaskTitle").value = task?.title || "";
  document.querySelector("#roadmapTaskDueDate").value = task?.dueDate || checkpoint.date;
  document.querySelector("#roadmapTaskAddToTodo").checked = task ? Boolean(task.todoId) : true;
  document.querySelector("#deleteRoadmapTaskButton").hidden = !task;
  taskDialog.showModal();
}

function syncTaskToTodo(task, checkpoint) {
  const todos = loadTodos();
  let todo = task.todoId ? todos.find((item) => item.id === task.todoId) : null;

  if (!todo) {
    todo = {
      id: crypto.randomUUID(),
      type: "manual",
      category: "Roadmap",
      title: task.title,
      dueDate: task.dueDate,
      notes: `Roadmap · ${checkpoint.title}`,
      done: task.done,
      roadmapTaskId: task.id
    };
    todos.push(todo);
    task.todoId = todo.id;
  } else {
    todo.title = task.title;
    todo.dueDate = task.dueDate;
    todo.notes = `Roadmap · ${checkpoint.title}`;
    todo.done = task.done;
  }

  saveTodos(todos);
}

function removeTaskFromTodo(task) {
  if (!task.todoId) return;
  saveTodos(loadTodos().filter((todo) => todo.id !== task.todoId));
  task.todoId = "";
}

checkpointForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#checkpointId").value;
  const existing = findCheckpoint(id);
  const values = {
    title: document.querySelector("#checkpointTitle").value.trim(),
    date: document.querySelector("#checkpointDate").value,
    status: document.querySelector("#checkpointStatus").value,
    goal: document.querySelector("#checkpointGoal").value.trim(),
    notes: document.querySelector("#checkpointNotes").value.trim()
  };
  if (!values.title || !values.date || !values.goal) return;

  if (existing) {
    Object.assign(existing, values);
  } else {
    roadmap.checkpoints.push({
      id: crypto.randomUUID(),
      ...values,
      tasks: []
    });
  }

  saveRoadmap();
  checkpointDialog.close();
  renderRoadmap();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const checkpoint = findCheckpoint(document.querySelector("#taskCheckpointId").value);
  if (!checkpoint) return;
  const taskId = document.querySelector("#roadmapTaskId").value;
  let task = checkpoint.tasks.find((item) => item.id === taskId);
  const title = document.querySelector("#roadmapTaskTitle").value.trim();
  const dueDate = document.querySelector("#roadmapTaskDueDate").value;
  if (!title || !dueDate) return;

  if (!task) {
    task = { id: crypto.randomUUID(), title, dueDate, done: false, todoId: "" };
    checkpoint.tasks.push(task);
  } else {
    task.title = title;
    task.dueDate = dueDate;
  }

  if (document.querySelector("#roadmapTaskAddToTodo").checked) {
    syncTaskToTodo(task, checkpoint);
  } else {
    removeTaskFromTodo(task);
  }

  saveRoadmap();
  taskDialog.close();
  renderRoadmap();
});

journeyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  roadmap.title = document.querySelector("#journeyTitle").value.trim();
  roadmap.description = document.querySelector("#journeyDescription").value.trim();
  roadmap.startDate = document.querySelector("#journeyStartDate").value;
  roadmap.targetDate = document.querySelector("#journeyTargetDate").value;
  saveRoadmap();
  journeyDialog.close();
  renderRoadmap();
});

document.querySelector("#addCheckpointButton").addEventListener("click", () => openCheckpointDialog());
document.querySelector("#editRoadmapButton").addEventListener("click", () => {
  document.querySelector("#journeyTitle").value = roadmap.title;
  document.querySelector("#journeyDescription").value = roadmap.description;
  document.querySelector("#journeyStartDate").value = roadmap.startDate;
  document.querySelector("#journeyTargetDate").value = roadmap.targetDate;
  journeyDialog.showModal();
});

document.querySelector("#deleteCheckpointButton").addEventListener("click", () => {
  const checkpoint = findCheckpoint(document.querySelector("#checkpointId").value);
  if (!checkpoint || !window.confirm(`Delete “${checkpoint.title}” and its actions?`)) return;
  checkpoint.tasks.forEach(removeTaskFromTodo);
  roadmap.checkpoints = roadmap.checkpoints.filter((item) => item.id !== checkpoint.id);
  saveRoadmap();
  checkpointDialog.close();
  renderRoadmap();
});

document.querySelector("#deleteRoadmapTaskButton").addEventListener("click", () => {
  const checkpoint = findCheckpoint(document.querySelector("#taskCheckpointId").value);
  const task = checkpoint?.tasks.find((item) => item.id === document.querySelector("#roadmapTaskId").value);
  if (!checkpoint || !task || !window.confirm(`Delete “${task.title}”?`)) return;
  removeTaskFromTodo(task);
  checkpoint.tasks = checkpoint.tasks.filter((item) => item.id !== task.id);
  saveRoadmap();
  taskDialog.close();
  renderRoadmap();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

roadmapTrack.addEventListener("click", (event) => {
  const addBetween = event.target.closest('[data-action="add-between"]');
  if (addBetween) {
    openCheckpointDialog(null, addBetween.dataset.date);
    return;
  }

  const editCheckpoint = event.target.closest('[data-action="edit-checkpoint"]');
  if (editCheckpoint) {
    openCheckpointDialog(findCheckpoint(editCheckpoint.dataset.id));
    return;
  }

  const addTask = event.target.closest('[data-action="add-task"]');
  if (addTask) {
    openTaskDialog(addTask.dataset.id);
    return;
  }

  const editTask = event.target.closest('[data-action="edit-task"]');
  if (editTask) {
    const checkpoint = findCheckpoint(editTask.dataset.checkpointId);
    const task = checkpoint?.tasks.find((item) => item.id === editTask.dataset.taskId);
    if (checkpoint && task) openTaskDialog(checkpoint.id, task);
  }
});

roadmapTrack.addEventListener("change", (event) => {
  const checkbox = event.target.closest('[data-action="toggle-task"]');
  if (!checkbox) return;
  const checkpoint = findCheckpoint(checkbox.dataset.checkpointId);
  const task = checkpoint?.tasks.find((item) => item.id === checkbox.dataset.taskId);
  if (!checkpoint || !task) return;
  task.done = checkbox.checked;
  if (task.todoId) syncTaskToTodo(task, checkpoint);
  saveRoadmap();
  renderRoadmap();
});

document.querySelector("#scrollRoadmapBack").addEventListener("click", () => {
  roadmapViewport.scrollBy({ left: -520, behavior: "smooth" });
});

document.querySelector("#scrollRoadmapForward").addEventListener("click", () => {
  roadmapViewport.scrollBy({ left: 520, behavior: "smooth" });
});

window.addEventListener("ella-cloud-data-updated", (event) => {
  const keys = event.detail?.keys || [];
  if (keys.includes(roadmapStorageKey)) {
    roadmap = loadRoadmap();
    renderRoadmap();
    return;
  }
  if (keys.includes(roadmapTodoStorageKey)) renderRoadmap();
});

if (!localStorage.getItem(roadmapStorageKey)) saveRoadmap();
renderRoadmap();
