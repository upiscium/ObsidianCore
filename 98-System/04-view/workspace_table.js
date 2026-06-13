// 98-System/dataview/views/workspace-table/view.js

async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/meta_utils.js");

const config = {
  source: '"03-Workspace"',
  projectSource: '"10-Project"',
  emptyMessage: "Workspaceはまだありません。",
  ...(input ?? {})
};

function workspaceKey(value) {
  if (value === null || value === undefined || value === "") return "";

  // 配列の場合は最初の要素を使う
  if (Array.isArray(value)) {
    return value.map(workspaceKey).filter(Boolean)[0] ?? "";
  }

  // Dataview Link型の場合
  if (typeof value === "object" && value.path) {
    return String(value.display ?? value.path.split("/").pop().replace(/\.md$/, ""));
  }

  return String(value);
}

function isSameWorkspace(project, workspace) {
  const key = workspaceKey(project.workspace);

  return (
    key === workspace.file.name ||
    key === workspace.file.path ||
    key === workspace.file.link?.path
  );
}

try {
  const workspaces = Array.from(
    dv.pages(config.source)
      .where(w => w.type === "workspace")
      .where(w => !U.isHiddenStatus(w.status))
  );

  const projects = Array.from(
    dv.pages(config.projectSource)
      .where(p => p.type === "project")
      .where(p => !U.isHiddenStatus(p.status))
  );

  const rows = workspaces
    .map(w => {
      const projectCount = projects
        .filter(p => isSameWorkspace(p, w))
        .length;

      return {
        workspace: w,
        projectCount
      };
    })
    .sort((a, b) => dv.compare(b.workspace.file.mtime, a.workspace.file.mtime));

  if (rows.length === 0) {
    dv.paragraph(config.emptyMessage);
  } else {
    dv.table(
      ["Workspace", "ステータス", "優先度", "Project数", "最終更新日"],
      rows.map(row => {
        const w = row.workspace;

        return [
          w.file.link,
          U.statusLabel(w.status),
          U.priorityLabel(w.priority),
          row.projectCount,
          U.formatDate(w.file.mday)
        ];
      })
    );
  }
} catch (error) {
  dv.paragraph("⚠️ Workspace table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
