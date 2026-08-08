(() => {
  const CLOSED_ENTITY_STATUSES = new Set(["done", "archived", "deleted", "cancelled"]);
  const TASK_STATUS_ALIASES = {
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
    deleted: "cancelled"
  };
  const TASK_STATUS_LABELS = {
    todo: "⬜ 未着手",
    doing: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  };
  const TASK_STATUS_ORDER = { doing: 0, todo: 1, done: 2, cancelled: 3 };

  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }

  function isTaskType(value) {
    return ["task", "task-pack"].includes(String(value ?? ""));
  }

  function normalizeTaskStatus(value) {
    return TASK_STATUS_ALIASES[String(value ?? "todo")] ?? "todo";
  }

  function taskStatusLabel(value) {
    return TASK_STATUS_LABELS[normalizeTaskStatus(value)] ?? "❓ 不明";
  }

  function taskStatusOrder(value) {
    return TASK_STATUS_ORDER[normalizeTaskStatus(value)] ?? 999;
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

  function normalizeLinkpath(value) {
    if (value && typeof value === "object" && value.path) {
      return String(value.path).replace(/\.md$/, "");
    }

    return String(value ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .replace(/\.md$/, "")
      .trim();
  }

  function normalizeReferences(value) {
    return asArray(value).map(normalizeLinkpath).filter(Boolean);
  }

  function referenceLabel(value) {
    if (!value) return "";
    if (value && typeof value === "object" && value.path) {
      return String(value.display ?? value.path.split("/").pop() ?? "");
    }

    const raw = String(value).trim();
    const alias = raw.match(/\|([^\]]+)\]\]$/)?.[1];
    if (alias) return alias;
    return normalizeLinkpath(value).split("/").pop() ?? "";
  }

  function resolveLinkFile(app, value, sourcePath) {
    const linkpath = normalizeLinkpath(value);
    if (!linkpath) return null;
    return app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) ?? null;
  }

  function findEntityNotes(app, { folder, types }) {
    return app.vault
      .getMarkdownFiles()
      .filter(file => file.path.startsWith(`${folder}/`))
      .map(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        return {
          file,
          type: String(fm.type ?? "").trim(),
          status: String(fm.status ?? "").trim(),
          displayName: String(
            fm.title ?? fm.project ?? fm.workspace ?? file.basename
          ).trim(),
          workspace: fm.workspace ?? null
        };
      })
      .filter(entity =>
        types.includes(entity.type) && !CLOSED_ENTITY_STATUSES.has(entity.status)
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }

  function entityMatchesReference(value, entity) {
    if (!entity) return false;
    const targets = new Set([
      entity.displayName,
      entity.file.basename,
      entity.file.path,
      entity.file.path.replace(/\.md$/, "")
    ]);
    return normalizeReferences(value).some(reference =>
      targets.has(reference) || targets.has(reference.split("/").pop())
    );
  }

  function makeEntityLink(app, entity, sourcePath) {
    return entity
      ? app.fileManager.generateMarkdownLink(
          entity.file,
          sourcePath,
          undefined,
          entity.displayName
        )
      : null;
  }

  return {
    asArray,
    isTaskType,
    normalizeTaskStatus,
    taskStatusLabel,
    taskStatusOrder,
    stripTaskTimestamp,
    normalizeLinkpath,
    normalizeReferences,
    referenceLabel,
    resolveLinkFile,
    findEntityNotes,
    entityMatchesReference,
    makeEntityLink
  };
})()
