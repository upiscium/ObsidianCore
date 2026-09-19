(S => (() => {
  if (!S || typeof S.normalizeDateKey !== "function") {
    throw new Error("task_schedule_utils.js is required");
  }

  const DEFAULT_THRESHOLDS = Object.freeze({
    doingStaleDays: 7
  });
  const DAY_MS = 24 * 60 * 60 * 1000;

  function thresholds(overrides = {}) {
    const result = { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) };
    for (const [key, value] of Object.entries(result)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid Task attention threshold: ${key}`);
      }
      result[key] = Math.floor(value);
    }
    return result;
  }

  function dayNumber(value) {
    const key = S.normalizeDateKey(value);
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  }

  function daysSince(value, today) {
    const valueDay = dayNumber(value);
    const todayDay = dayNumber(today);
    if (valueDay === null || todayDay === null) return null;
    return todayDay - valueDay;
  }

  function taskModifiedDate(task) {
    return task?.file?.mtime ?? task?.file?.mday ?? null;
  }

  function isStaleDoingTask(task, today, overrides = {}) {
    const config = thresholds(overrides);
    if (!task || task.backlog === true || String(task.status ?? "") !== "doing") {
      return false;
    }
    const age = daysSince(taskModifiedDate(task), today);
    return age !== null && age >= config.doingStaleDays;
  }

  function isBlockedTask(task, blocked, isActionableStatus) {
    if (typeof isActionableStatus !== "function") {
      throw new Error("isActionableStatus is required");
    }
    return Boolean(
      task &&
      task.backlog !== true &&
      blocked &&
      isActionableStatus(task.status)
    );
  }

  function projectActionableTaskCount(project, tasks, matchesReference, isActionableStatus) {
    if (typeof matchesReference !== "function") {
      throw new Error("matchesReference is required");
    }
    if (typeof isActionableStatus !== "function") {
      throw new Error("isActionableStatus is required");
    }

    const reference = project?.file?.path ?? project?.file?.name ?? null;
    if (!reference) return 0;

    return Array.from(tasks ?? []).filter(task =>
      task &&
      task.backlog !== true &&
      isActionableStatus(task.status) &&
      matchesReference(task.project, reference)
    ).length;
  }

  function isRunningProjectWithoutAction(project, tasks, matchesReference, isActionableStatus) {
    return String(project?.status ?? "") === "running" &&
      projectActionableTaskCount(project, tasks, matchesReference, isActionableStatus) === 0;
  }

  function reasonText(kind, age, config = DEFAULT_THRESHOLDS) {
    const t = thresholds(config);
    if (kind === "doing-stale") {
      return `doingのまま${age}日更新されていません（基準 ${t.doingStaleDays}日）`;
    }
    if (kind === "project-no-action") {
      return "runningですが、Backlog以外のactionable Taskがありません";
    }
    return "要対応です";
  }

  return Object.freeze({
    DEFAULT_THRESHOLDS,
    thresholds,
    daysSince,
    taskModifiedDate,
    isStaleDoingTask,
    isBlockedTask,
    projectActionableTaskCount,
    isRunningProjectWithoutAction,
    reasonText
  });
})())
