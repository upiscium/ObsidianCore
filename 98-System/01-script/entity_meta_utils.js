(() => {
  const STATUS_LABELS = {
    planning: "📝 計画",
    running: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const STATUS_ORDER = { running: 0, planning: 1, done: 2, cancelled: 3 };
  const STATUS_ALIASES = {
    planning: "planning",
    running: "running",
    done: "done",
    cancelled: "cancelled",
    "not-yet-running": "planning",
    stopped: "planning",
    waiting: "planning",
    blocked: "planning",
    someday: "planning",
    archived: "done",
    deleted: "cancelled",
    none: "planning"
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

  function normalizeStatus(value) {
    const key = value === null || value === undefined || value === ""
      ? "none"
      : String(value);
    return STATUS_ALIASES[key] ?? "planning";
  }

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    return PRIORITY_ALIASES[String(value)] ?? "none";
  }

  function statusLabel(value) {
    const key = normalizeStatus(value);
    return STATUS_LABELS[key] ?? `❓ ${key}`;
  }

  function statusOrder(value) {
    return STATUS_ORDER[normalizeStatus(value)] ?? 999;
  }

  function priorityLabel(value) {
    const key = normalizePriority(value);
    return PRIORITY_LABELS[key] ?? `❓ ${String(value)}`;
  }

  function priorityOrder(value) {
    return PRIORITY_ORDER[normalizePriority(value)] ?? 999;
  }

  function isActiveStatus(value) {
    return ["planning", "running"].includes(normalizeStatus(value));
  }

  function isArchivedStatus(value) {
    return normalizeStatus(value) === "done";
  }

  function isHiddenStatus(value) {
    return normalizeStatus(value) === "cancelled";
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  return {
    normalizeStatus,
    normalizePriority,
    statusLabel,
    statusOrder,
    priorityLabel,
    priorityOrder,
    isActiveStatus,
    isArchivedStatus,
    isHiddenStatus,
    formatDate
  };
})()
