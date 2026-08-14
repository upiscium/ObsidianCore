async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/entity_meta_utils.js");

const config = {
  source: '"10-Project"',
  emptyMessage: "High Priority Projectはありません。",
  ...(input ?? {})
};

try {
  const projects = Array.from(
    dv.pages(config.source)
      .where(p => p.type === "project")
      .where(p => U.normalizePriority(p.priority) === "high")
      .where(p => U.isProjectListStatus(p.status))
  ).sort((a, b) => {
    const statusDelta = U.statusOrder(a.status) - U.statusOrder(b.status);
    if (statusDelta !== 0) return statusDelta;
    return dv.compare(b.file.mtime, a.file.mtime);
  });

  if (projects.length === 0) {
    dv.paragraph(config.emptyMessage);
  } else {
    dv.table(
      ["Project", "Workspace", "Status", "最終更新日"],
      projects.map(project => [
        project.file.link,
        project.workspace ?? "-",
        U.statusLabel(project.status),
        U.formatDate(project.file.mday)
      ])
    );
  }
} catch (error) {
  dv.paragraph("⚠️ High Priority Project table の描画中にエラーが発生しました。");
  dv.paragraph("```text\n" + String(error.stack ?? error.message ?? error) + "\n```");
}
