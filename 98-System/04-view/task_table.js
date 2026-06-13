// 98-System/dataview/views/task-table/view.js

async function loadLib(path) {
  const source = await dv.io.load(path);

  if (!source) {
    throw new Error(`Dataview library not found: ${path}`);
  }

  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/meta_utils.js");

const config = {
  mode: "today",
  source: '"02-Task"',
  emptyMessage: "対象のTaskはありません。",
  ...(input ?? {})
};

// ==========================================================
// Compatibility helpers
// ==========================================================
//
// meta_utils.js の関数名を移行中でも壊れにくくするため、
// taskStatusLabel / isTaskClosedStatus があれば優先し、
// なければ旧名 statusLabel / isClosedStatus を使う。

const taskStatusLabel =
  U.taskStatusLabel ??
  U.statusLabel;

const taskStatusOrder =
  U.taskStatusOrder ??
  U.statusOrder;

const isTaskClosedStatus =
  U.isTaskClosedStatus ??
  U.isClosedStatus;

if (!taskStatusLabel) {
  throw new Error("meta_utils.js に taskStatusLabel または statusLabel がありません。");
}

if (!taskStatusOrder) {
  throw new Error("meta_utils.js に taskStatusOrder または statusOrder がありません。");
}

if (!isTaskClosedStatus) {
  throw new Error("meta_utils.js に isTaskClosedStatus または isClosedStatus がありません。");
}

// ==========================================================
// Date constants
// ==========================================================

const today = dv.date("today").startOf("day");
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

function lt(value, target) {
  const valueDate = d(value);
  return valueDate && dv.compare(valueDate, target) < 0;
}

function lte(value, target) {
  const valueDate = d(value);
  return valueDate && dv.compare(valueDate, target) <= 0;
}

function eq(value, target) {
  const valueDate = d(value);
  return valueDate && dv.compare(valueDate, target) === 0;
}

function gt(value, target) {
  const valueDate = d(value);
  return valueDate && dv.compare(valueDate, target) > 0;
}

function gte(value, target) {
  const valueDate = d(value);
  return valueDate && dv.compare(valueDate, target) >= 0;
}

function firstReviewDate(task) {
  return d(task.reviewed) ?? d(task.updated) ?? d(task.created) ?? task.file.ctime;
}

// ==========================================================
// Task link helpers
// ==========================================================

function stripTaskTimestamp(name) {
  return String(name)
    // 先頭: 20260612-1749-やることリスト
    .replace(/^\d{8}-\d{4}-/, "")

    // 念のため: 20260612_1749_やることリスト
    .replace(/^\d{8}_\d{4}_/, "")

    // 念のため: 202606121749-やることリスト
    .replace(/^\d{12}[\s_-]+/, "")

    // 区切り文字の残骸を掃除
    .replace(/^[\s_-]+|[\s_-]+$/g, "")
    .trim();
}

function taskLink(task) {
  const displayName = stripTaskTimestamp(task.file.name) || task.file.name;
  return dv.fileLink(task.file.path, false, displayName);
}

// ==========================================================
// Render helpers
// ==========================================================

function renderCommonRow(task, options = {}) {
  const {
    showStart = true,
    showScheduled = true,
    showDue = true,
    showCreated = false,
    showReviewed = false,
    showUpdated = false,
    showStatus = true
  } = options;

  return [
    taskLink(task),
    ...(showStatus ? [taskStatusLabel(task.status)] : []),
    U.priorityLabel(task.priority),
    ...(showStart ? [U.formatDate(task.start)] : []),
    ...(showScheduled ? [U.formatDate(task.scheduled)] : []),
    ...(showDue ? [U.formatDate(task.due)] : []),
    ...(showReviewed ? [U.formatDate(task.reviewed)] : []),
    ...(showUpdated ? [U.formatDate(task.updated)] : []),
    ...(showCreated ? [U.formatDate(task.created)] : []),
    U.fieldText(task.workspace),
    U.fieldText(task.project)
  ];
}

function commonHeaders(options = {}) {
  const {
    showStart = true,
    showScheduled = true,
    showDue = true,
    showCreated = false,
    showReviewed = false,
    showUpdated = false,
    showStatus = true
  } = options;

  return [
    "Task",
    ...(showStatus ? ["Status"] : []),
    "Priority",
    ...(showStart ? ["Start"] : []),
    ...(showScheduled ? ["Scheduled"] : []),
    ...(showDue ? ["Due"] : []),
    ...(showReviewed ? ["Reviewed"] : []),
    ...(showUpdated ? ["Updated"] : []),
    ...(showCreated ? ["Created"] : []),
    "Workspace",
    "Project"
  ];
}

// ==========================================================
// Main
// ==========================================================

try {
  let tasks = dv.pages(config.source)
    .where(t => t.type === "task-pack");

  switch (config.mode) {
    case "overdue":
      tasks = tasks
        .where(t => U.isTaskActionableStatus(t.status))
        .where(t => t.due && lt(t.due, today));
      break;

    case "today":
      tasks = tasks
        .where(t => U.isTaskActionableStatus(t.status))
        .where(t => t.due && eq(t.due, today));
      break;

    case "available":
      tasks = tasks
        .where(t => U.isTaskActionableStatus(t.status))
        .where(t => !t.due || gt(t.due, today))
        .where(t =>
          (t.scheduled && lte(t.scheduled, today)) ||
          (!t.scheduled && t.start && lte(t.start, today))
        );
      break;

    case "upcoming":
      tasks = tasks
        .where(t => U.isTaskActionableStatus(t.status))
        .where(t =>
          (t.scheduled && gt(t.scheduled, today)) ||
          (!t.scheduled && t.start && gt(t.start, today))
        )
        .where(t => !t.due || gte(t.due, today));
      break;

    case "waiting-blocked":
      tasks = tasks
        .where(t => U.isWaitingOrBlockedStatus(t.status));
      break;

    case "unplanned":
      tasks = tasks
        .where(t => U.isTaskActionableStatus(t.status))
        .where(t => !t.start)
        .where(t => !t.scheduled)
        .where(t => !t.due);
      break;

    case "someday":
      tasks = tasks
        .where(t => U.isSomedayStatus(t.status));
      break;

    default:
      throw new Error(`Unknown task-table mode: ${config.mode}`);
  }

  const rows = Array.from(tasks);

  switch (config.mode) {
    case "overdue":
      rows.sort((a, b) =>
        dv.compare(dateOrFuture(a.due), dateOrFuture(b.due))
      );
      break;

    case "today":
      rows.sort((a, b) => {
        const priority = U.priorityOrder(a.priority) - U.priorityOrder(b.priority);
        if (priority !== 0) return priority;

        const due = dv.compare(dateOrFuture(a.due), dateOrFuture(b.due));
        if (due !== 0) return due;

        return dv.compare(dateOrFuture(a.scheduled), dateOrFuture(b.scheduled));
      });
      break;

    case "available":
      rows.sort((a, b) => {
        const priority = U.priorityOrder(a.priority) - U.priorityOrder(b.priority);
        if (priority !== 0) return priority;

        const scheduled = dv.compare(dateOrFuture(a.scheduled), dateOrFuture(b.scheduled));
        if (scheduled !== 0) return scheduled;

        const start = dv.compare(dateOrFuture(a.start), dateOrFuture(b.start));
        if (start !== 0) return start;

        return dv.compare(dateOrFuture(a.due), dateOrFuture(b.due));
      });
      break;

    case "waiting-blocked":
      rows.sort((a, b) => {
        const status = taskStatusOrder(a.status) - taskStatusOrder(b.status);
        if (status !== 0) return status;

        const due = dv.compare(dateOrFuture(a.due), dateOrFuture(b.due));
        if (due !== 0) return due;

        const scheduled = dv.compare(dateOrFuture(a.scheduled), dateOrFuture(b.scheduled));
        if (scheduled !== 0) return scheduled;

        return dv.compare(dateOrFuture(a.start), dateOrFuture(b.start));
      });
      break;

    case "upcoming":
      rows.sort((a, b) => {
        const scheduled = dv.compare(dateOrFuture(a.scheduled), dateOrFuture(b.scheduled));
        if (scheduled !== 0) return scheduled;

        const start = dv.compare(dateOrFuture(a.start), dateOrFuture(b.start));
        if (start !== 0) return start;

        const priority = U.priorityOrder(a.priority) - U.priorityOrder(b.priority);
        if (priority !== 0) return priority;

        return dv.compare(dateOrFuture(a.due), dateOrFuture(b.due));
      });
      break;

    case "unplanned":
      rows.sort((a, b) => {
        const created = dv.compare(dateOrPast(b.created), dateOrPast(a.created));
        if (created !== 0) return created;

        return dv.compare(b.file.ctime, a.file.ctime);
      });
      break;

    case "someday":
      rows.sort((a, b) => {
        const review = dv.compare(
          d(a.reviewed) ?? d(a.created) ?? a.file.ctime,
          d(b.reviewed) ?? d(b.created) ?? b.file.ctime
        );

        if (review !== 0) return review;

        return dv.compare(b.file.ctime, a.file.ctime);
      });
      break;
  }

  if (rows.length === 0) {
    dv.paragraph(config.emptyMessage);
  } else {
    switch (config.mode) {
      case "overdue":
        dv.table(
          commonHeaders({
            showStart: false,
            showScheduled: true,
            showDue: true
          }),
          rows.map(t => renderCommonRow(t, {
            showStart: false,
            showScheduled: true,
            showDue: true
          }))
        );
        break;

      case "today":
      case "available":
      case "waiting-blocked":
      case "upcoming":
        dv.table(
          commonHeaders({
            showStart: true,
            showScheduled: true,
            showDue: true
          }),
          rows.map(t => renderCommonRow(t, {
            showStart: true,
            showScheduled: true,
            showDue: true
          }))
        );
        break;

      case "unplanned":
        dv.table(
          ["Task", "Status", "Priority", "Workspace", "Project", "Created"],
          rows.map(t => [
            taskLink(t),
            taskStatusLabel(t.status),
            U.priorityLabel(t.priority),
            U.fieldText(t.workspace),
            U.fieldText(t.project),
            U.formatDate(t.created)
          ])
        );
        break;

      case "someday":
        dv.table(
          ["Task", "Priority", "Reviewed", "Created", "Workspace", "Project"],
          rows.map(t => [
            taskLink(t),
            U.priorityLabel(t.priority),
            U.formatDate(t.reviewed),
            U.formatDate(t.created),
            U.fieldText(t.workspace),
            U.fieldText(t.project)
          ])
        );
        break;
    }
  }
} catch (error) {
  dv.paragraph("⚠️ Task table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
