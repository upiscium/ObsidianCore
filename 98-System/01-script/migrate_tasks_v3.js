module.exports = async params => {
  const { app } = params;
  const TASK_ROOT = "02-Task";
  const DAILY_ROOT = "00-DailyNote";

  const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith(`${TASK_ROOT}/`));
  let migrated = 0;
  let skipped = 0;
  const failures = [];

  for (const file of files) {
    try {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};
      if (!isTaskType(fm.type)) { skipped += 1; continue; }

      const content = await app.vault.read(file);
      const bodyDependencies = extractBodyDependencies(content);
      const legacyStatus = String(fm.status ?? "").trim();
      const shouldBacklog = legacyStatus === "someday" || normalizeBoolean(fm.backlog);

      await app.fileManager.processFrontMatter(file, frontmatter => {
        frontmatter.type = "task";
        frontmatter.title = String(frontmatter.title ?? "").trim() || stripTaskTimestamp(file.basename);
        frontmatter.status = shouldBacklog ? "todo" : normalizeTaskStatus(frontmatter.status);
        frontmatter.priority = normalizeTaskPriority(frontmatter.priority);

        if (!frontmatter.created) frontmatter.created = window.moment(file.stat.ctime).format("YYYY-MM-DD");
        if (frontmatter.status === "done" && !frontmatter.completed) frontmatter.completed = window.moment(file.stat.mtime).format("YYYY-MM-DD");
        if (frontmatter.status !== "done") frontmatter.completed = null;
        if (!frontmatter.start && frontmatter.scheduled) frontmatter.start = frontmatter.scheduled;

        frontmatter.start = frontmatter.start ?? null;
        frontmatter.due = frontmatter.due ?? null;
        frontmatter.workspace = frontmatter.workspace ?? null;
        frontmatter.project = frontmatter.project ?? null;

        if (!frontmatter.source) {
          frontmatter.source = normalizeSource(frontmatter.source_path, frontmatter.created, DAILY_ROOT);
        }

        frontmatter.backlog = shouldBacklog;
        if (shouldBacklog && frontmatter.status !== "done" && frontmatter.status !== "cancelled") {
          frontmatter.start = null;
          frontmatter.due = null;
          frontmatter.triaged = true;
        } else if (frontmatter.triaged === null || frontmatter.triaged === undefined) {
          frontmatter.triaged = isValidDate(frontmatter.due) && !isStartAfterDue(frontmatter.start, frontmatter.due);
        }

        frontmatter.depends_on = [...new Set([
          ...asArray(frontmatter.depends_on).map(String),
          ...bodyDependencies
        ])];

        delete frontmatter.scheduled;
        delete frontmatter.source_path;
        delete frontmatter.updated;
        delete frontmatter.reviewed;
      });
      migrated += 1;
    } catch (error) {
      console.error(`Task移行失敗: ${file.path}`, error);
      failures.push(file.path);
    }
  }

  new Notice(`Task移行完了: ${migrated}件 / スキップ: ${skipped}件 / 失敗: ${failures.length}件`);
  if (failures.length > 0) console.warn("移行に失敗したTask:", failures);
  return { migrated, skipped, failures };
};

function isTaskType(value) { return ["task", "task-pack"].includes(String(value ?? "")); }
function normalizeTaskStatus(value) {
  const aliases = { todo:"todo", doing:"doing", done:"done", cancelled:"cancelled", "not-yet-running":"todo", planning:"todo", running:"doing", waiting:"todo", blocked:"todo", someday:"todo", stopped:"todo", archived:"done", deleted:"cancelled" };
  return aliases[String(value ?? "todo")] ?? "todo";
}
function normalizeTaskPriority(value) {
  if (value === null || value === undefined || value === "") return null;
  const aliases = { high:"high", medium:"medium", low:"low", none:null, urgent:"high", normal:"medium", lowest:"low", "0":"high", "1":"high", "2":"medium", "3":"low", "4":"low", "5":null };
  return aliases[String(value)] ?? null;
}
function normalizeSource(value, created, dailyRoot) {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("[[") && raw.endsWith("]]")) return raw;
  if (raw) return `[[${raw.replace(/\.md$/, "")}]]`;
  const date = window.moment(created, "YYYY-MM-DD", true);
  if (!date.isValid()) return null;
  return `[[${dailyRoot}/${date.format("YYYY")}/${date.format("MM")}/${date.format("YYYY-MM-DD")}]]`;
}
function normalizeBoolean(value) { return value === true || String(value ?? "").trim().toLowerCase() === "true"; }
function asIsoDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = window.moment(value, ["YYYY-MM-DD", window.moment.ISO_8601], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}
function isValidDate(value) { return asIsoDate(value) !== null; }
function isStartAfterDue(start, due) {
  const startDate = asIsoDate(start), dueDate = asIsoDate(due);
  if (!startDate || !dueDate) return false;
  return window.moment(startDate).isAfter(window.moment(dueDate), "day");
}
function asArray(value) { if (value === null || value === undefined || value === "") return []; return Array.isArray(value) ? value : [value]; }
function extractBodyDependencies(content) {
  const section = String(content).match(/(?:^|\n)##\s+Dependencies?\s*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i)?.[1] ?? "";
  return Array.from(section.matchAll(/\[\[([^\]]+)\]\]/g), match => `[[${match[1]}]]`).filter(link => !link.includes("98-System/"));
}
function stripTaskTimestamp(name) { return String(name).replace(/^\d{8}-\d{6}-\d{3}-/, "").replace(/^\d{8}-\d{4}-/, "").trim(); }
