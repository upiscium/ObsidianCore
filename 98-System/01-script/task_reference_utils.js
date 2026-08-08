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

  function parseReference(value) {
    if (value && typeof value === "object" && value.path) {
      return {
        path: String(value.path).replace(/\.md$/, ""),
        alias: value.display ?? null
      };
    }

    const raw = String(value ?? "").trim();
    return {
      path: normalizeLinkpath(raw),
      alias: raw.match(/\|([^\]]+)\]\]$/)?.[1] ?? null
    };
  }

  function normalizeReferences(value) {
    return asArray(value).map(normalizeLinkpath).filter(Boolean);
  }

  function referenceKeys(value) {
    return asArray(value)
      .map(item => parseReference(item).path)
      .filter(Boolean)
      .flatMap(path => [path, path.split("/").pop()]);
  }

  function matchesReference(value, filter) {
    if (!filter) return true;
    const keys = new Set(referenceKeys(value));
    return referenceKeys(filter).some(key => keys.has(key));
  }

  function referenceLabel(value) {
    if (!value) return "";
    const reference = parseReference(value);
    return reference.alias ?? reference.path.split("/").pop() ?? "";
  }

  function resolveLinkFile(app, value, sourcePath) {
    const linkpath = normalizeLinkpath(value);
    if (!linkpath) return null;
    return app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) ?? null;
  }

  function resolveDataviewPage(dv, value) {
    if (!value) return null;
    const reference = parseReference(value);
    if (!reference.path) return null;
    return dv.page(reference.path) ?? dv.page(reference.path.split("/").pop()) ?? null;
  }

  function dataviewReferenceDisplay(dv, value, empty = "-") {
    if (!value) return empty;
    const reference = parseReference(value);
    if (!reference.path) return empty;
    const page = resolveDataviewPage(dv, value);
    if (!page) return reference.alias ?? reference.path.split("/").pop() ?? empty;
    return dv.fileLink(page.file.path, false, reference.alias ?? page.file.name);
  }

  function dependencyPages(dv, task) {
    return asArray(task?.depends_on).map(raw => ({
      raw,
      page: resolveDataviewPage(dv, raw)
    }));
  }

  function dependencyHasPathTo(dv, task, targetPath, visited = new Set()) {
    const path = String(task?.file?.path ?? "");
    if (!path) return false;
    if (path === targetPath) return true;
    if (visited.has(path)) return false;
    visited.add(path);

    return dependencyPages(dv, task)
      .filter(item => item.page)
      .some(item => dependencyHasPathTo(dv, item.page, targetPath, visited));
  }

  function dependencyInfo(dv, task, isClosedStatus) {
    const dependencies = dependencyPages(dv, task);
    const unresolved = [];
    const missing = [];

    for (const dependency of dependencies) {
      if (!dependency.page) {
        missing.push(referenceLabel(dependency.raw) || "不明");
        continue;
      }
      if (!isClosedStatus(dependency.page.status)) unresolved.push(dependency.page);
    }

    const cyclic = dependencies
      .filter(item => item.page)
      .some(item => dependencyHasPathTo(dv, item.page, task.file.path, new Set()));

    return {
      blocked: cyclic || unresolved.length > 0 || missing.length > 0,
      cyclic,
      unresolved,
      missing
    };
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
    parseReference,
    normalizeReferences,
    referenceKeys,
    matchesReference,
    referenceLabel,
    resolveLinkFile,
    resolveDataviewPage,
    dataviewReferenceDisplay,
    dependencyPages,
    dependencyHasPathTo,
    dependencyInfo,
    findEntityNotes,
    entityMatchesReference,
    makeEntityLink
  };
})()
