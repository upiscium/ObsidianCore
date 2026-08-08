(() => {
  const STATUS_LABELS = {
    todo: "⬜ 未着手",
    doing: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const STATUS_ORDER = { doing: 0, todo: 1, done: 2, cancelled: 3 };
  const STATUS_ALIASES = {
    todo: "todo",
    doing: "doing",
    done: "done",
    cancelled: "cancelled",
    "not-yet-running": "todo",
    planning: "todo",
    running: "doing",
    waiting: "todo",
    blocked: "todo",
    someday: "todo",
    stopped: "todo",
    archived: "done",
    deleted: "cancelled",
    none: "todo"
  };

  const PRIORITY_LABELS = {
    high: "🔴 高",
    medium: "🟡 中",
    low: "🟢 低",
    none: "▫️ 無"
  };
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };
  const PRIORITY_ALIASES = {
    high: "high",
    medium: "medium",
    low: "low",
    none: "none",
    urgent: "high",
    normal: "medium",
    lowest: "low",
    "0": "high",
    "1": "high",
    "2": "medium",
    "3": "low",
    "4": "low",
    "5": "none"
  };

  function normalizeKey(value) {
    return value === null || value === undefined || value === ""
      ? "none"
      : String(value);
  }

  function normalizeTaskStatus(value) {
    return STATUS_ALIASES[normalizeKey(value)] ?? "todo";
  }

  function normalizeTaskPriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    return PRIORITY_ALIASES[String(value)] ?? "none";
  }

  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null && typeof value.array === "function") {
      return value.array();
    }
    return [value];
  }

  function taskStatusLabel(value) {
    const key = normalizeTaskStatus(value);
    return STATUS_LABELS[key] ?? `❓ ${key}`;
  }

  function taskStatusOrder(value) {
    return STATUS_ORDER[normalizeTaskStatus(value)] ?? 999;
  }

  function taskPriorityLabel(value) {
    const key = normalizeTaskPriority(value);
    return PRIORITY_LABELS[key] ?? `❓ ${String(value)}`;
  }

  function taskPriorityOrder(value) {
    return PRIORITY_ORDER[normalizeTaskPriority(value)] ?? 999;
  }

  function isTaskType(value) {
    return ["task", "task-pack"].includes(String(value ?? ""));
  }

  function isTaskClosedStatus(value) {
    return ["done", "cancelled"].includes(normalizeTaskStatus(value));
  }

  function isTaskActionableStatus(value) {
    return !isTaskClosedStatus(value);
  }

  function isTaskTodoStatus(value) {
    return normalizeTaskStatus(value) === "todo";
  }

  function isTaskDoingStatus(value) {
    return normalizeTaskStatus(value) === "doing";
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
    formatDate,
    dateOnly
  };
})()
