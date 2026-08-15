(() => {
  const PROJECT_STATUS_LABELS = {
    planning: "📝 計画",
    running: "🏃 進行中",
    stopped: "⏸️ 停止",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const PROJECT_STATUS_ORDER = { running: 0, planning: 1, stopped: 2, done: 3, cancelled: 4 };
  const PROJECT_STATUSES = new Set(["planning", "running", "stopped", "done", "cancelled"]);

  const WORKSPACE_LIFECYCLE_LABELS = {
    active: "✅ 有効",
    inactive: "⏸️ 休止",
    archived: "📦 アーカイブ"
  };
  const WORKSPACE_LIFECYCLE_ORDER = { active: 0, inactive: 1, archived: 2 };
  const WORKSPACE_LIFECYCLES = new Set(["active", "inactive", "archived"]);

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

  function normalizeWorkspaceLifecycle(value) {
    return normalizeFromSet(value, WORKSPACE_LIFECYCLES);
  }

  function workspaceLifecycleLabel(value) {
    const key = normalizeWorkspaceLifecycle(value);
    return key ? WORKSPACE_LIFECYCLE_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function workspaceLifecycleOrder(value) {
    const key = normalizeWorkspaceLifecycle(value);
    return key ? WORKSPACE_LIFECYCLE_ORDER[key] : 999;
  }

  function isWorkspaceActiveLifecycle(value) {
    return normalizeWorkspaceLifecycle(value) === "active";
  }

  function isWorkspaceVisibleLifecycle(value) {
    const lifecycle = normalizeWorkspaceLifecycle(value);
    return lifecycle === "active" || lifecycle === "inactive";
  }

  function isWorkspaceArchivedLifecycle(value) {
    return normalizeWorkspaceLifecycle(value) === "archived";
  }

  function normalizeProjectStatus(value) {
    return normalizeFromSet(value, PROJECT_STATUSES);
  }

  function projectStatusLabel(value) {
    const key = normalizeProjectStatus(value);
    return key ? PROJECT_STATUS_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function projectStatusOrder(value) {
    const key = normalizeProjectStatus(value);
    return key ? PROJECT_STATUS_ORDER[key] : 999;
  }

  function isProjectActiveStatus(value) {
    const status = normalizeProjectStatus(value);
    return status === "planning" || status === "running";
  }

  function isProjectListStatus(value) {
    const status = normalizeProjectStatus(value);
    return status === "planning" || status === "running" || status === "stopped";
  }

  function isProjectArchivedStatus(value) {
    return normalizeProjectStatus(value) === "done";
  }

  function isProjectHiddenStatus(value) {
    return normalizeProjectStatus(value) === "cancelled";
  }

  function isProjectVisibleInWorkspace(projectStatus, workspaceLifecycle) {
    return isWorkspaceActiveLifecycle(workspaceLifecycle) && isProjectListStatus(projectStatus);
  }

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return "none";
    const key = String(value).trim();
    return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, key) && key !== "none"
      ? key
      : null;
  }

  function priorityLabel(value) {
    const key = normalizePriority(value);
    return key ? PRIORITY_LABELS[key] : `❓ ${String(value ?? "")}`;
  }

  function priorityOrder(value) {
    const key = normalizePriority(value);
    return key ? PRIORITY_ORDER[key] : 999;
  }

  function formatDate(value) {
    if (!value) return "-";
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    if (value.toISODate) return value.toISODate();
    return String(value);
  }

  return {
    normalizeWorkspaceLifecycle,
    workspaceLifecycleLabel,
    workspaceLifecycleOrder,
    isWorkspaceActiveLifecycle,
    isWorkspaceVisibleLifecycle,
    isWorkspaceArchivedLifecycle,
    normalizeProjectStatus,
    projectStatusLabel,
    projectStatusOrder,
    isProjectActiveStatus,
    isProjectListStatus,
    isProjectArchivedStatus,
    isProjectHiddenStatus,
    isProjectVisibleInWorkspace,
    normalizePriority,
    priorityLabel,
    priorityOrder,
    formatDate
  };
})()
