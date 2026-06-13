async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/meta_utils.js");

const config = {
  source: `"${dv.current().file.folder}"`,
  type: "project-note",
  mode: "active", // active | archived
  excludeCurrentFile: true,
  emptyMessage: "対象のノートはありません。",
  ...(input ?? {})
};

let pages = dv.pages(config.source)
  .where(p => p.type === config.type);

if (config.excludeCurrentFile) {
  const currentFileName = dv.current().file.name;
  pages = pages.where(p => p.file.name !== currentFileName);
}

if (config.mode === "active") {
  pages = pages.where(p => U.isActiveStatus(p.status));
}

if (config.mode === "archived") {
  pages = pages.where(p => U.isArchivedStatus(p.status));
}

const rows = Array.from(pages)
  .sort((a, b) => dv.compare(b.file.mtime, a.file.mtime));

if (rows.length === 0) {
  dv.paragraph(config.emptyMessage);
} else if (config.mode === "archived") {
  dv.table(
    ["ノート名", "最終更新日"],
    rows.map(p => [
      p.file.link,
      U.formatDate(p.file.mday)
    ])
  );
} else {
  dv.table(
    ["ノート名", "ステータス", "優先度", "最終更新日"],
    rows.map(p => [
      p.file.link,
      U.statusLabel(p.status),
      U.priorityLabel(p.priority),
      U.formatDate(p.file.mday)
    ])
  );
}
