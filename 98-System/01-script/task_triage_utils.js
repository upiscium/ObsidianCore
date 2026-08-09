(() => {
  const ALLOWED_PRIORITIES = new Set(["high", "medium", "low"]);

  function normalizePriority(value) {
    if (value === null || value === undefined || value === "") return null;
    const priority = String(value).trim();
    if (!ALLOWED_PRIORITIES.has(priority)) {
      throw new Error(`不正なTask priorityです: ${priority}`);
    }
    return priority;
  }

  function normalizeDate(value, { field, required = false }) {
    const text = String(value ?? "").trim();
    if (!text) {
      if (required) throw new Error(`${field}は必須です。`);
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error(`${field}はYYYY-MM-DD形式で指定してください。`);
    }

    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`${field}の日付が不正です: ${text}`);
    }

    return text;
  }

  function normalizeLink(value) {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
  }

  function buildTriagePatch({ priority, start, due, workspace, project }) {
    const nextPriority = normalizePriority(priority);
    const nextStart = normalizeDate(start, { field: "Start" });
    const nextDue = normalizeDate(due, { field: "Due", required: true });
    const nextWorkspace = normalizeLink(workspace);
    const nextProject = normalizeLink(project);

    if (nextStart && nextStart > nextDue) {
      throw new Error("StartはDue以前の日付にしてください。");
    }

    if (nextProject && !nextWorkspace) {
      throw new Error("Projectを設定する場合はWorkspaceも設定してください。");
    }

    return {
      priority: nextPriority,
      start: nextStart,
      due: nextDue,
      workspace: nextWorkspace,
      project: nextProject,
      triaged: true
    };
  }

  function applyTriagePatch(frontmatter, patch) {
    Object.assign(frontmatter, patch);
    return frontmatter;
  }

  return {
    normalizePriority,
    normalizeDate,
    buildTriagePatch,
    applyTriagePatch
  };
})()
