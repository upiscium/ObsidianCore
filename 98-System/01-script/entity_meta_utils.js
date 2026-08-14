(() => {
  const STATUS_LABELS = {
    planning: "📝 計画",
    running: "🏃 進行中",
    stopped: "⏸️ 停止",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const STATUS_ORDER = { running: 0, planning: 1, stopped: 2, done: 3, cancelled: 4 };
  const WORKSPACE_STATUSES = new Set(["planning", "running", "done", "cancelled"]);
  const PROJECT_STATUSES = new Set(["planning", "running", "stopped", "done", "cancelled"]);
  const PRIORITY_LABELS = {
    high: "🔴 高",
    medium: "🟡 中",
    low: "🟢 低",
    none: "▫️ 無"
  };
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function normalizeFromSet(value, allowed) {
    const key = String(value ?? "").trim();
    return allowed.has(key) ? key : null;
  }

  function normalizeWorkspaceStatus(value) {
    return normalizeFromSet(value, WORKSPACE_STATUSES);
  }

  function normalizeProjectStatus(value) {
    return normalizeFromSet(value, PROJECT_STATUSES);
  }

  function normalizeStatus(value) {
    return normalizeWorkspaceStatus(value);
  }

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, key) && key !== "none"
      ? key
      : null;
  }

  function statusLabel(value) {
    const key = normalizeProjectStatus(value);
    return key ? STATUS_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function statusOrder(value) {
    const key = normalizeProjectStatus(value);
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
    const status = normalizeWorkspaceStatus(value);
    return status === "planning" || status === "running";
  }

  function isProjectListStatus(value) {
    const status = normalizeProjectStatus(value);
    return status === "planning" || status === "running" || status === "stopped";
  }

  function isArchivedStatus(value) {
    return normalizeWorkspaceStatus(value) === "done";
  }

  function isHiddenStatus(value) {
    return normalizeWorkspaceStatus(value) === "cancelled";
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  return {
    normalizeStatus,
    normalizeWorkspaceStatus,
    normalizeProjectStatus,
    normalizePriority,
    statusLabel,
    statusOrder,
    priorityLabel,
    priorityOrder,
    isActiveStatus,
    isProjectListStatus,
    isArchivedStatus,
    isHiddenStatus,
    formatDate
  };
})()
