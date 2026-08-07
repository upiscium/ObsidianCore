module.exports = async params => {
  const { app } = params;
  const TASK_ROOT = "02-Task";
  const DAILY_ROOT = "00-DailyNote";

  const files = app.vault
    .getMarkdownFiles()
    .filter(file => file.path.startsWith(`${TASK_ROOT}/`));

  let migrated = 0;
  let skipped = 0;
  const failures = [];

  for (const file of files) {
    try {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};

      if (!isTaskType(fm.type)) {
        skipped += 1;
        continue;
      }

      const content = await app.vault.read(file);
      const bodyDependencies = extractBodyDependencies(content);

      await app.fileManager.processFrontMatter(
        file,
        frontmatter => {
          frontmatter.type = "task";
          frontmatter.title =
            String(frontmatter.title ?? "").trim() ||
            stripTaskTimestamp(file.basename);

          frontmatter.status = normalizeTaskStatus(
            frontmatter.status
          );

          frontmatter.priority = normalizeTaskPriority(
            frontmatter.priority
          );

          if (!frontmatter.created) {
            frontmatter.created = window.moment(
              file.stat.ctime
            ).format("YYYY-MM-DD");
          }

          if (
            frontmatter.status === "done" &&
            !frontmatter.completed
          ) {
            frontmatter.completed = window.moment(
              file.stat.mtime
            ).format("YYYY-MM-DD");
          }

          if (frontmatter.status !== "done") {
            frontmatter.completed = null;
          }

          if (!frontmatter.start && frontmatter.scheduled) {
            frontmatter.start = frontmatter.scheduled;
          }

          frontmatter.start = frontmatter.start ?? null;
          frontmatter.due = frontmatter.due ?? null;
          frontmatter.workspace = frontmatter.workspace ?? null;
          frontmatter.project = frontmatter.project ?? null;

          if (!frontmatter.source) {
            frontmatter.source = normalizeSource(
              frontmatter.source_path,
              frontmatter.created,
              DAILY_ROOT
            );
          }

          if (frontmatter.triaged === null ||
              frontmatter.triaged === undefined) {
            frontmatter.triaged = true;
          }

          frontmatter.depends_on = [
            ...new Set([
              ...asArray(frontmatter.depends_on).map(String),
              ...bodyDependencies
            ])
          ];

          delete frontmatter.scheduled;
          delete frontmatter.source_path;
          delete frontmatter.updated;
          delete frontmatter.reviewed;
        }
      );

      migrated += 1;
    } catch (error) {
      console.error(`Task移行失敗: ${file.path}`, error);
      failures.push(file.path);
    }
  }

  new Notice(
    `Task移行完了: ${migrated}件 / スキップ: ${skipped}件 / 失敗: ${failures.length}件`
  );

  if (failures.length > 0) {
    console.warn("移行に失敗したTask:", failures);
  }

  return {
    migrated,
    skipped,
    failures
  };
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

function normalizeTaskPriority(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const aliases = {
    high: "high",
    medium: "medium",
    low: "low",
    none: null,
    urgent: "high",
    normal: "medium",
    lowest: "low",
    "0": "high",
    "1": "high",
    "2": "medium",
    "3": "low",
    "4": "low",
    "5": null
  };

  return aliases[String(value)] ?? null;
}

function normalizeSource(value, created, dailyRoot) {
  const raw = String(value ?? "").trim();

  if (raw.startsWith("[[") && raw.endsWith("]]")) {
    return raw;
  }

  if (raw) {
    const path = raw.replace(/\.md$/, "");
    return `[[${path}]]`;
  }

  const date = window.moment(created, "YYYY-MM-DD", true);

  if (!date.isValid()) {
    return null;
  }

  return (
    `[[${dailyRoot}/${date.format("YYYY")}/${date.format("MM")}/` +
    `${date.format("YYYY-MM-DD")}]]`
  );
}

function asArray(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractBodyDependencies(content) {
  const section = String(content).match(
    /(?:^|\n)##\s+Dependencies?\s*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i
  )?.[1] ?? "";

  return Array.from(
    section.matchAll(/\[\[([^\]]+)\]\]/g),
    match => `[[${match[1]}]]`
  ).filter(link => !link.includes("98-System/"));
}

function stripTaskTimestamp(name) {
  return String(name)
    .replace(/^\d{8}-\d{6}-\d{3}-/, "")
    .replace(/^\d{8}-\d{4}-/, "")
    .trim();
}
