module.exports = async function addTaskDependency(tp) {
  const TASK_ROOT = "02-Task";
  const activeFile = app.workspace.getActiveFile();

  if (!activeFile || activeFile.extension !== "md") {
    new Notice("Taskファイルを開いてから実行してください。");
    return;
  }

  const activeFm =
    app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};

  if (!isTaskType(activeFm.type)) {
    new Notice("現在のファイルはTaskではありません。");
    return;
  }

  const existingPaths = new Set(
    asArray(activeFm.depends_on)
      .map(value => resolveLinkFile(value, activeFile.path)?.path)
      .filter(Boolean)
  );

  const candidates = app.vault
    .getMarkdownFiles()
    .filter(file =>
      file.path.startsWith(`${TASK_ROOT}/`) &&
      file.path !== activeFile.path
    )
    .map(file => {
      const fm =
        app.metadataCache.getFileCache(file)?.frontmatter ?? {};

      return {
        file,
        fm,
        title:
          String(fm.title ?? "").trim() ||
          stripTaskTimestamp(file.basename),
        status: normalizeTaskStatus(fm.status),
        project: referenceLabel(fm.project)
      };
    })
    .filter(task =>
      isTaskType(task.fm.type) &&
      !["done", "cancelled"].includes(task.status) &&
      !existingPaths.has(task.file.path) &&
      !dependsTransitivelyOn(
        task.file,
        activeFile.path,
        new Set()
      )
    )
    .sort((a, b) => {
      const status = statusOrder(a.status) - statusOrder(b.status);
      if (status !== 0) return status;
      return a.title.localeCompare(b.title, "ja");
    });

  if (candidates.length === 0) {
    new Notice("追加できる依存Taskがありません。");
    return;
  }

  const selected = await tp.system.suggester(
    candidates.map(task => {
      const suffix = task.project ? ` — ${task.project}` : "";
      return `${statusLabel(task.status)} | ${task.title}${suffix}`;
    }),
    candidates,
    false,
    "依存するTaskを選択"
  );

  if (!selected) return;

  const link = app.fileManager.generateMarkdownLink(
    selected.file,
    activeFile.path,
    undefined,
    selected.title
  );

  await app.fileManager.processFrontMatter(
    activeFile,
    frontmatter => {
      const current = asArray(frontmatter.depends_on)
        .map(value => String(value));

      if (!current.includes(link)) {
        current.push(link);
      }

      frontmatter.depends_on = current;
    }
  );

  new Notice(`依存Taskを追加しました: ${selected.title}`);
};

function isTaskType(value) {
  return ["task", "task-pack"].includes(String(value ?? ""));
}

function normalizeTaskStatus(value) {
  const aliases = {
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

  return aliases[String(value ?? "todo")] ?? "todo";
}

function statusLabel(value) {
  return {
    todo: "⬜ 未着手",
    doing: "🏃 進行中",
    done: "✅ 完了",
    cancelled: "🚫 キャンセル"
  }[normalizeTaskStatus(value)];
}

function statusOrder(value) {
  return {
    doing: 0,
    todo: 1,
    done: 2,
    cancelled: 3
  }[normalizeTaskStatus(value)] ?? 999;
}

function stripTaskTimestamp(name) {
  return String(name)
    .replace(/^\d{8}-\d{6}-\d{3}-/, "")
    .replace(/^\d{8}-\d{4}-/, "")
    .trim();
}

function asArray(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
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
    .replace(/\.md$/, "");
}

function resolveLinkFile(value, sourcePath) {
  const linkpath = normalizeLinkpath(value);
  if (!linkpath) return null;

  return app.metadataCache.getFirstLinkpathDest(
    linkpath,
    sourcePath
  );
}

function dependsTransitivelyOn(file, targetPath, visited) {
  if (!file || visited.has(file.path)) return false;
  if (file.path === targetPath) return true;

  visited.add(file.path);

  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};

  return asArray(fm.depends_on).some(value => {
    const dependency = resolveLinkFile(value, file.path);
    return dependency
      ? dependsTransitivelyOn(dependency, targetPath, visited)
      : false;
  });
}

function referenceLabel(value) {
  if (!value) return "";

  if (value && typeof value === "object" && value.path) {
    return value.display ?? value.path.split("/").pop();
  }

  const raw = String(value).trim();
  const alias = raw.match(/\|([^\]]+)\]\]$/)?.[1];

  if (alias) return alias;

  return normalizeLinkpath(raw).split("/").pop();
}
