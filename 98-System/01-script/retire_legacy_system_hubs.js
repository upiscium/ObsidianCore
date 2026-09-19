const LEGACY_FILES = Object.freeze([
  {
    path: "02-Task/backlog.md",
    expected: `# Currently back logged
~~~meta-bind-embed
[[98-System/02-embed/05-task/backlog|backlog]]
~~~`.replaceAll("~~~", "```")
  },
  {
    path: "10-Project/hub.md",
    expected: `# 🚀 Active Projects
~~~dvjs
const activeProjects = dv.pages('"10-Project"')
    .where(p => p.type === "project")
    .where(p => p.status !== "✅ 完了" && p.status !== "🗑️ 破棄")
    .sort(p => p.file.mtime, "desc");

if (activeProjects.length > 0) {
    dv.table(
        ["プロジェクト", "Workspace", "最終更新日", "ステータス", "優先度"],
        activeProjects.map(p => [
            p.file.link,
            p.workspace || "-",
            p.file.mday ? p.file.mday.toISODate() : "-",
            p.status || "-",
            p.priority || "-"
        ])
    );
} else {
    dv.paragraph("現在進行中のプロジェクトはありません。");
}
~~~
# 📦 Archived Projects
~~~dvjs
const archivedProjects = dv.pages('"10-Project"')
    .where(p => p.type === "project")
    .where(p => p.status === "✅ 完了")
    .sort(p => p.file.mtime, "desc");

if (archivedProjects.length > 0) {
    dv.table(
        ["プロジェクト", "Workspace", "最終更新日", "ステータス", "優先度"],
        archivedProjects.map(p => [
            p.file.link,
            p.workspace || "-",
            p.file.mday ? p.file.mday.toISODate() : "-",
            p.status || "-",
            p.priority || "-"
        ])
    );
} else {
    dv.paragraph("アーカイブされたプロジェクトはありません。");
}
~~~
# 🗑️ Discarded Projects
> [!info]- Table
> ~~~dvjs
> const discardedProjects = dv.pages('"10-Project"')
 >    .where(p => p.type === "project")
>     .where(p => p.status === "🗑️ 破棄")
>     .sort(p => p.file.mtime, "desc");
> 
> if (discardedProjects.length > 0) {
>     dv.table(
 >        ["プロジェクト", "Workspace", "最終更新日", "ステータス", "優先度"],
>         discardedProjects.map(p => [
 >            p.file.link,
 >            p.workspace || "-",
 >            p.file.mday ? p.file.mday.toISODate() : "-",
 >            p.status || "-",
 >            p.priority || "-"
 >        ])
 >    );
> } else {
 >    dv.paragraph("破棄されたプロジェクトはありません。");
> }
> ~~~`.replaceAll("~~~", "```")
  },
  {
    path: "11-Knowledge/hub.md",
    expected: `# 📋️ノート一覧
~~~dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status AS "Status",
  category AS "Category",
  maturity AS "Maturity",
  source_type AS "Source",
  created AS "Created"
FROM "11-Knowledge"
WHERE type = "knowledge-note"
WHERE file.folder = this.file.folder
WHERE !contains(list("archived", "deleted"), status)
SORT created DESC, file.name ASC
~~~
# 🏃作業中・未完了
~~~dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status AS "Status",
  category AS "Category",
  maturity AS "Maturity",
  source_type AS "Source",
  created AS "Created"
FROM "11-Knowledge"
WHERE type = "knowledge-note"
WHERE file.folder = this.file.folder
WHERE !contains(list("archived", "deleted"), status)
WHERE contains(list("not-yet-running", "planning", "running"), status)
SORT
  choice(status = "running", 0,
  choice(status = "planning", 1,
  choice(status = "not-yet-running", 2, 9))) ASC,
  created DESC,
  file.name ASC
~~~
# ⏸️保留中
~~~dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status AS "Status",
  category AS "Category",
  maturity AS "Maturity",
  source_type AS "Source",
  created AS "Created"
FROM "11-Knowledge"
WHERE type = "knowledge-note"
WHERE file.folder = this.file.folder
WHERE !contains(list("archived", "deleted"), status)
WHERE status = "stopped"
SORT created DESC, file.name ASC
~~~
# 🏺古い・見直し候補
~~~dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status AS "Status",
  category AS "Category",
  maturity AS "Maturity",
  source_type AS "Source",
  created AS "Created"
FROM "11-Knowledge"
WHERE type = "knowledge-note"
WHERE file.folder = this.file.folder
WHERE !contains(list("archived", "deleted"), status)
WHERE maturity = "outdated"
SORT created DESC, file.name ASC
~~~
# 📝下書き・断片
~~~dataview
TABLE WITHOUT ID
  file.link AS "Note",
  status AS "Status",
  category AS "Category",
  maturity AS "Maturity",
  source_type AS "Source",
  created AS "Created"
FROM "11-Knowledge"
WHERE type = "knowledge-note"
WHERE file.folder = this.file.folder
WHERE !contains(list("archived", "deleted"), status)
WHERE contains(list("seed", "draft"), maturity)
SORT
  choice(maturity = "draft", 0,
  choice(maturity = "seed", 1, 9)) ASC,
  created DESC,
  file.name ASC
~~~`.replaceAll("~~~", "```")
  }
]);

function normalizeContent(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trimEnd();
}

function matchesAuditedLegacyContent(current, expected) {
  return normalizeContent(current) === normalizeContent(expected);
}

async function retireLegacySystemHubs(tp, context = {}) {
  const runtimeApp = context.app ?? globalThis.app;
  const NoticeCtor = context.Notice ?? globalThis.Notice;

  if (!runtimeApp?.vault?.getAbstractFileByPath
      || typeof runtimeApp.vault.read !== "function"
      || typeof runtimeApp?.fileManager?.trashFile !== "function") {
    throw new Error("Legacy Hub retirement requires Vault read/path lookup and FileManager.trashFile");
  }

  const eligible = [];
  const missing = [];
  const refused = [];

  for (const spec of LEGACY_FILES) {
    const file = runtimeApp.vault.getAbstractFileByPath(spec.path);
    if (!file) {
      missing.push(spec.path);
      continue;
    }
    if (file.extension !== "md") {
      refused.push({ path: spec.path, reason: "not-markdown" });
      continue;
    }

    const current = await runtimeApp.vault.read(file);
    if (!matchesAuditedLegacyContent(current, spec.expected)) {
      refused.push({ path: spec.path, reason: "content-mismatch" });
      continue;
    }
    eligible.push(file);
  }

  if (refused.length > 0) {
    const paths = refused.map(item => item.path).join(", ");
    if (NoticeCtor) new NoticeCtor(`Legacy Hub退役を中止: 監査済み本文と一致しません: ${paths}`);
    return { retired: 0, missing, refused, cancelled: false, failures: [] };
  }

  if (eligible.length === 0) {
    if (NoticeCtor) new NoticeCtor("Legacy Hub退役: 既に対象ファイルはありません。");
    return { retired: 0, missing, refused: [], cancelled: false, failures: [] };
  }

  const confirm = context.confirm ?? (async paths => {
    if (typeof tp?.system?.suggester !== "function") {
      throw new Error("Legacy Hub retirement requires Templater suggester confirmation");
    }
    return await tp.system.suggester(
      ["監査済みlegacy HubをTrashへ移動", "キャンセル"],
      [true, false],
      false,
      `対象: ${paths.join(", ")}`
    );
  });

  const approved = await confirm(eligible.map(file => file.path));
  if (approved !== true) {
    if (NoticeCtor) new NoticeCtor("Legacy Hub退役をキャンセルしました。");
    return { retired: 0, missing, refused: [], cancelled: true, failures: [] };
  }

  let retired = 0;
  const failures = [];
  for (const file of eligible) {
    try {
      await runtimeApp.fileManager.trashFile(file);
      retired += 1;
    } catch (error) {
      console.error(`Legacy Hub retirement failed: ${file.path}`, error);
      failures.push(file.path);
    }
  }

  if (NoticeCtor) {
    new NoticeCtor(
      `Legacy Hub退役: Trash移動 ${retired} / 既に不存在 ${missing.length} / 失敗 ${failures.length}`
    );
  }

  return { retired, missing, refused: [], cancelled: false, failures };
}

module.exports = retireLegacySystemHubs;
module.exports.LEGACY_FILES = LEGACY_FILES;
module.exports.normalizeContent = normalizeContent;
module.exports.matchesAuditedLegacyContent = matchesAuditedLegacyContent;
