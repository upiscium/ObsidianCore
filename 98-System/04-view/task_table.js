async function loadLib(path) {
  const source = await dv.io.load(path);

  if (!source) {
    throw new Error(`Dataview library not found: ${path}`);
  }

  return new Function(
    "dv",
    `"use strict"; return (${source});`
  )(dv);
}

const U = await loadLib("98-System/01-script/meta_utils.js");

const config = {
  mode: "primary",
  source: '"02-Task"',
  emptyMessage: "対象のTaskはありません。",
  project: null,
  workspace: null,
  ...(input ?? {})
};

const today = dv.date("today").startOf("day");
const primaryLimit = today.plus({ days: 14 });
const farFuture = dv.date("9999-12-31").startOf("day");
const farPast = dv.date("0001-01-01").startOf("day");

// ==========================================================
// Date helpers
// ==========================================================

function d(value) {
  return U.dateOnly(value, dv);
}

function dateOrFuture(value) {
  return d(value) ?? farFuture;
}

function dateOrPast(value) {
  return d(value) ?? farPast;
}

function compareDate(a, b) {
  return dv.compare(dateOrFuture(a), dateOrFuture(b));
}

function lt(value, target) {
  const date = d(value);
  return date && dv.compare(date, target) < 0;
}

function lte(value, target) {
  const date = d(value);
  return date && dv.compare(date, target) <= 0;
}

function eq(value, target) {
  const date = d(value);
  return date && dv.compare(date, target) === 0;
}

function gt(value, target) {
  const date = d(value);
  return date && dv.compare(date, target) > 0;
}

// ==========================================================
// Reference helpers
// ==========================================================

function parseReference(value) {
  if (value && typeof value === "object" && value.path) {
    return {
      path: String(value.path).replace(/\.md$/, ""),
      alias: value.display ?? null
    };
  }

  const raw = String(value ?? "").trim();
  const alias = raw.match(/\|([^\]]+)\]\]$/)?.[1] ?? null;
  const path = raw
    .replace(/^["']|["']$/g, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .replace(/\.md$/, "");

  return { path, alias };
}

function referenceKeys(value) {
  return U.asArray(value)
    .map(item => parseReference(item).path)
    .filter(Boolean)
    .flatMap(path => [path, path.split("/").pop()]);
}

function matchesFilter(value, filter) {
  if (!filter) return true;

  const valueKeys = new Set(referenceKeys(value));
  return referenceKeys(filter).some(key => valueKeys.has(key));
}

function matchesContext(task) {
  return (
    matchesFilter(task.project, config.project) &&
    matchesFilter(task.workspace, config.workspace)
  );
}

function referenceDisplay(value) {
  if (!value) return "-";

  const reference = parseReference(value);
  if (!reference.path) return "-";

  const page = dv.page(reference.path) ?? dv.page(reference.path.split("/").pop());

  if (!page) {
    return reference.alias ?? reference.path.split("/").pop();
  }

  return dv.fileLink(
    page.file.path,
    false,
    reference.alias ?? page.file.name
  );
}

// ==========================================================
// Task helpers
// ==========================================================

function stripTaskTimestamp(name) {
  return String(name)
    .replace(/^\d{8}-\d{6}-\d{3}-/, "")
    .replace(/^\d{8}-\d{4}-/, "")
    .replace(/^\d{8}_\d{4}_/, "")
    .replace(/^\d{12}[\s_-]+/, "")
    .replace(/^[\s_-]+|[\s_-]+$/g, "")
    .trim();
}

function taskTitle(task) {
  return (
    String(task.title ?? "").trim() ||
    stripTaskTimestamp(task.file.name) ||
    task.file.name
  );
}

function taskLink(task) {
  return dv.fileLink(task.file.path, false, taskTitle(task));
}

function isOpen(task) {
  return U.isTaskActionableStatus(task.status);
}

function isTriaged(task) {
  // 旧Taskでtriagedが存在しない場合は、既存TaskをInboxへ大量流入させない。
  return task.triaged !== false;
}

function startReady(task) {
  return !task.start || lte(task.start, today);
}

function isPrimary(task) {
  if (!isOpen(task) || !isTriaged(task) || !startReady(task)) {
    return false;
  }

  const due = d(task.due);

  // Overdue / Todayとの重複を防止する。
  if (due && dv.compare(due, today) <= 0) {
    return false;
  }

  const dueWithinTwoWeeks =
    due && dv.compare(due, primaryLimit) <= 0;

  const highPriority =
    U.normalizeTaskPriority(task.priority) === "high";

  return dueWithinTwoWeeks || highPriority;
}

// ==========================================================
// Dependency helpers
// ==========================================================

function resolveDependency(value) {
  if (!value) return null;

  if (value && typeof value === "object" && value.path) {
    return dv.page(value.path);
  }

  const target = parseReference(value).path;
  if (!target) return null;

  return dv.page(target) ?? dv.page(target.split("/").pop());
}

function dependencyPages(task) {
  return U.asArray(task.depends_on).map(value => ({
    raw: value,
    page: resolveDependency(value)
  }));
}

function dependencyHasPathTo(task, targetPath, visited = new Set()) {
  const path = String(task?.file?.path ?? "");

  if (!path) return false;
  if (path === targetPath) return true;
  if (visited.has(path)) return false;

  visited.add(path);

  return dependencyPages(task)
    .filter(item => item.page)
    .some(item =>
      dependencyHasPathTo(item.page, targetPath, visited)
    );
}

function dependencyInfo(task) {
  const dependencies = dependencyPages(task);
  const unresolved = [];
  const missing = [];

  for (const dependency of dependencies) {
    if (!dependency.page) {
      const reference = parseReference(dependency.raw);
      missing.push(
        reference.alias ||
        reference.path.split("/").pop() ||
        "不明"
      );
      continue;
    }

    if (!U.isTaskClosedStatus(dependency.page.status)) {
      unresolved.push(dependency.page);
    }
  }

  const cyclic = dependencies
    .filter(item => item.page)
    .some(item =>
      dependencyHasPathTo(item.page, task.file.path, new Set())
    );

  return {
    blocked: cyclic || unresolved.length > 0 || missing.length > 0,
    cyclic,
    unresolved,
    missing
  };
}

function dependencyReason(task) {
  const info = dependencyInfo(task);
  const parts = [];

  if (info.cyclic) {
    parts.push("循環依存");
  }

  if (info.unresolved.length > 0) {
    parts.push(
      info.unresolved
        .map(page => String(page.title ?? stripTaskTimestamp(page.file.name)))
        .join(", ")
    );
  }

  if (info.missing.length > 0) {
    parts.push(`参照不明: ${info.missing.join(", ")}`);
  }

  return parts.join(" / ");
}

function effectiveStatus(task) {
  const reason = dependencyReason(task);

  if (reason) {
    return `⛔ Blocked — ${reason}`;
  }

  return U.taskStatusLabel(task.status);
}

// ==========================================================
// Interactive controls
// ==========================================================

function getTaskFile(task) {
  const file = app.vault.getAbstractFileByPath(task.file.path);

  if (!file || file.extension !== "md") {
    throw new Error(`Taskファイルが見つかりません: ${task.file.path}`);
  }

  return file;
}

async function setTaskStatus(task, nextStatus) {
  const file = getTaskFile(task);

  await app.fileManager.processFrontMatter(
    file,
    frontmatter => {
      frontmatter.status = nextStatus;

      if (nextStatus === "done") {
        frontmatter.completed =
          frontmatter.completed ||
          window.moment().format("YYYY-MM-DD");
      } else {
        frontmatter.completed = null;
      }
    }
  );
}

function createDoneToggle(task) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;
  checkbox.setAttribute("aria-label", "Taskを完了にする");

  checkbox.addEventListener("change", async event => {
    if (!event.target.checked) return;

    checkbox.disabled = true;

    try {
      await setTaskStatus(task, "done");
      checkbox.closest("tr")?.remove();
      new Notice(`Taskを完了しました: ${taskTitle(task)}`);
    } catch (error) {
      console.error(error);
      checkbox.checked = false;
      checkbox.disabled = false;
      new Notice("Taskの完了処理に失敗しました。");
    }
  });

  return checkbox;
}

function createTriagedToggle(task) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.triaged === true;
  checkbox.setAttribute("aria-label", "Taskを整理済みにする");

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;

    try {
      const file = getTaskFile(task);

      await app.fileManager.processFrontMatter(
        file,
        frontmatter => {
          frontmatter.triaged = checkbox.checked;
        }
      );

      if (config.mode === "inbox" && checkbox.checked) {
        checkbox.closest("tr")?.remove();
      }
    } catch (error) {
      console.error(error);
      checkbox.checked = !checkbox.checked;
      new Notice("整理済み状態の更新に失敗しました。");
    } finally {
      checkbox.disabled = false;
    }
  });

  return checkbox;
}

// ==========================================================
// Query
// ==========================================================

let tasks = Array.from(
  dv.pages(config.source)
    .where(task => U.isTaskType(task.type))
    .where(matchesContext)
);

switch (config.mode) {
  case "overdue":
    tasks = tasks.filter(task =>
      isOpen(task) &&
      isTriaged(task) &&
      task.due &&
      lt(task.due, today)
    );
    break;

  case "today":
    tasks = tasks.filter(task =>
      isOpen(task) &&
      isTriaged(task) &&
      task.due &&
      eq(task.due, today)
    );
    break;

  case "primary":
    tasks = tasks.filter(isPrimary);
    break;

  case "inbox":
    tasks = tasks.filter(task =>
      isOpen(task) && task.triaged === false
    );
    break;

  default:
    throw new Error(`Unknown task-table mode: ${config.mode}`);
}

// ==========================================================
// Sort
// ==========================================================

function statusRank(task) {
  if (dependencyInfo(task).blocked) return 2;
  if (U.isTaskDoingStatus(task.status)) return 0;
  return 1;
}

tasks.sort((a, b) => {
  if (config.mode === "inbox") {
    const created = dv.compare(
      dateOrPast(b.created),
      dateOrPast(a.created)
    );

    if (created !== 0) return created;
    return dv.compare(b.file.ctime, a.file.ctime);
  }

  if (config.mode === "primary") {
    const status = statusRank(a) - statusRank(b);
    if (status !== 0) return status;
  }

  const due = compareDate(a.due, b.due);
  if (due !== 0) return due;

  const priority =
    U.taskPriorityOrder(a.priority) -
    U.taskPriorityOrder(b.priority);

  if (priority !== 0) return priority;

  return compareDate(a.start, b.start);
});

// ==========================================================
// Render
// ==========================================================

if (tasks.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  const commonHeaders = [
    "完了",
    "Task",
    "Status",
    "Priority",
    "Start",
    "Due",
    "Workspace",
    "Project"
  ];

  const commonRow = task => [
    createDoneToggle(task),
    taskLink(task),
    effectiveStatus(task),
    U.taskPriorityLabel(task.priority),
    U.formatDate(task.start),
    U.formatDate(task.due),
    referenceDisplay(task.workspace),
    referenceDisplay(task.project)
  ];

  if (config.mode === "inbox") {
    dv.table(
      ["整理", ...commonHeaders, "Source", "Created"],
      tasks.map(task => [
        createTriagedToggle(task),
        ...commonRow(task),
        referenceDisplay(task.source),
        U.formatDate(task.created)
      ])
    );
  } else {
    dv.table(commonHeaders, tasks.map(commonRow));
  }
}
