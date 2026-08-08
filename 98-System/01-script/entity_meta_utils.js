(() => {
  const STATUS_LABELS = {
    planning: "📝 計画",
    running: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const STATUS_ORDER = { running: 0, planning: 1, done: 2, cancelled: 3 };
  const PRIORITY_LABELS = {
    high: "🔴 高",
    medium: "🟡 中",
    low: "🟢 低",
    none: "▫️ 無"
  };
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function normalizeStatus(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(STATUS_LABELS, key) ? key : null;
  }

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, key) && key !== "none"
      ? key
      : null;
  }

  function statusLabel(value) {
    const key = normalizeStatus(value);
    return key ? STATUS_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function statusOrder(value) {
    const key = normalizeStatus(value);
    return key ? STATUS_ORDER[key] : 999;
  }

  function priorityLabel(value) {
    const key = normalizePriority(value);
    return key ? PRIORITY_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function priorityOrder(value) {
    const key = normalizePriority(value);
    return key ? PRIORITY_ORDER[key] : 999;
  }

  function isActiveStatus(value) {
    const status = normalizeStatus(value);
    return status === "planning" || status === "running";
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
