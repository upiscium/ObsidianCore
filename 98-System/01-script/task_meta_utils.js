(() => {
  const STATUS_LABELS = {
    todo: "⬜ 未着手",
    doing: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const STATUS_ORDER = { doing: 0, todo: 1, done: 2, cancelled: 3 };
  const PRIORITY_LABELS = {
    high: "🔴 高",
    medium: "🟡 中",
    low: "🟢 低",
    none: "▫️ 無"
  };
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function normalizeTaskStatus(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(STATUS_LABELS, key) ? key : null;
  }

  function normalizeTaskPriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, key) && key !== "none"
      ? key
      : null;
  }

  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null && typeof value.array === "function") return value.array();
    return [value];
  }

  function taskStatusLabel(value) {
    const key = normalizeTaskStatus(value);
    return key ? STATUS_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function taskStatusOrder(value) {
    const key = normalizeTaskStatus(value);
    return key ? STATUS_ORDER[key] : 999;
  }

  function taskPriorityLabel(value) {
    const key = normalizeTaskPriority(value);
    return key ? PRIORITY_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function taskPriorityOrder(value) {
    const key = normalizeTaskPriority(value);
    return key ? PRIORITY_ORDER[key] : 999;
  }

  function isTaskType(value) {
    return String(value ?? "") === "task";
  }

  function isTaskClosedStatus(value) {
    const status = normalizeTaskStatus(value);
    return status === "done" || status === "cancelled";
  }

  function isTaskActionableStatus(value) {
    const status = normalizeTaskStatus(value);
    return status === "todo" || status === "doing";
  }

  function isTaskTodoStatus(value) {
    return normalizeTaskStatus(value) === "todo";
  }

  function isTaskDoingStatus(value) {
    return normalizeTaskStatus(value) === "doing";
  }

  function stripTaskTimestamp(name) {
    return String(name)
      .replace(/^\d{8}-\d{6}-\d{3}-/, "")
      .replace(/^\d{8}-\d{4}-/, "")
      .replace(/^\d{8}_\d{4}_/, "")
      .replace(/^\d{12}[\s_-]+/, "")
      .replace(/^[\s_-]+|[\s_-]+$/g, "")
      .trim();
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  function dateOnly(value, dv) {
    if (!value) return null;
    if (value.startOf) return value.startOf("day");
    const parsed = dv.date(String(value));
    if (!parsed) return null;
    return parsed.startOf ? parsed.startOf("day") : parsed;
  }

  return {
    normalizeTaskStatus,
    normalizeTaskPriority,
    asArray,
    taskStatusLabel,
    taskStatusOrder,
    taskPriorityLabel,
    taskPriorityOrder,
    isTaskType,
    isTaskClosedStatus,
    isTaskActionableStatus,
    isTaskTodoStatus,
    isTaskDoingStatus,
    stripTaskTimestamp,
    formatDate,
    dateOnly
  };
})()
