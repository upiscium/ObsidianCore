(S => (() => {
  if (!S || typeof S.normalizeDateKey !== "function") {
    throw new Error("task_schedule_utils.js is required");
  }

  const DEFAULT_THRESHOLDS = Object.freeze({
    doingStaleDays: 7,
    backlogStaleDays: 30,
    entityStaleDays: 30,
    entityStateDecisionDays: 90
  });
  const DAY_MS = 24 * 60 * 60 * 1000;

  function thresholds(overrides = {}) {
    const result = { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) };
    for (const [key, value] of Object.entries(result)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid weekly review threshold: ${key}`);
      result[key] = Math.floor(value);
    }
    if (result.entityStateDecisionDays < result.entityStaleDays) {
      throw new Error("entityStateDecisionDays must be >= entityStaleDays");
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

  function taskCreatedDate(task) {
    return task?.created ?? task?.file?.ctime ?? taskModifiedDate(task);
  }

  function isStaleDoingTask(task, today, overrides = {}) {
    const config = thresholds(overrides);
    if (String(task?.status ?? "") !== "doing") return false;
    const age = daysSince(taskModifiedDate(task), today);
    return age !== null && age >= config.doingStaleDays;
  }

  function isOldBacklogTask(task, today, isActionableStatus, overrides = {}) {
    const config = thresholds(overrides);
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
    if (!task || task.backlog !== true || !isActionableStatus(task.status)) return false;
    const age = daysSince(taskCreatedDate(task), today);
    return age !== null && age >= config.backlogStaleDays;
  }

  function isBlockedTask(task, blocked, isActionableStatus) {
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
    return Boolean(task && blocked && isActionableStatus(task.status));
  }

  function projectActionableTaskCount(project, tasks, matchesReference, isActionableStatus) {
    if (typeof matchesReference !== "function") throw new Error("matchesReference is required");
    if (typeof isActionableStatus !== "function") throw new Error("isActionableStatus is required");
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

  function entityReviewBucket(entity, today, isActiveEntity, overrides = {}) {
    const config = thresholds(overrides);
    if (typeof isActiveEntity !== "function") throw new Error("isActiveEntity is required");
    if (!entity || !isActiveEntity(entity)) return null;
    const age = daysSince(entity?.file?.mtime ?? entity?.file?.mday, today);
    if (age === null) return null;
    if (age >= config.entityStateDecisionDays) return "state-decision";
    if (age >= config.entityStaleDays) return "stale";
    return null;
  }

  function reasonText(kind, age, config = DEFAULT_THRESHOLDS) {
    const t = thresholds(config);
    if (kind === "doing-stale") return `doingのまま${age}日更新されていません（基準 ${t.doingStaleDays}日）`;
    if (kind === "backlog-old") return `Backlog登録から${age}日経過しています（基準 ${t.backlogStaleDays}日）`;
    if (kind === "project-no-action") return "runningですが、Backlog以外のactionable Taskがありません";
    if (kind === "entity-stale") return `${age}日更新されていません（基準 ${t.entityStaleDays}日）`;
    if (kind === "entity-state-decision") return `${age}日更新されていません。継続・完了・中止を見直してください（基準 ${t.entityStateDecisionDays}日）`;
    return "レビュー対象です";
  }

  return {
    DEFAULT_THRESHOLDS,
    thresholds,
    daysSince,
    taskModifiedDate,
    taskCreatedDate,
    isStaleDoingTask,
    isOldBacklogTask,
    isBlockedTask,
    projectActionableTaskCount,
    isRunningProjectWithoutAction,
    entityReviewBucket,
    reasonText
  };
})())
