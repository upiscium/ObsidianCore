async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/01-script/note_meta_utils.js");

const config = {
  source: `"${dv.current().file.folder}"`,
  type: null,
  mode: "active", // active | archived
  excludeCurrentFile: true,
  emptyMessage: "対象のノートはありません。",
  ...(input ?? {})
};

const allowedTypes = new Set(["project-note", "workspace-note"]);
const allowedModes = new Set(["active", "archived"]);

if (!allowedTypes.has(config.type)) {
  throw new Error(`note_table requires type: project-note | workspace-note (got: ${String(config.type)})`);
}
if (!allowedModes.has(config.mode)) {
  throw new Error(`note_table requires mode: active | archived (got: ${String(config.mode)})`);
}

let pages = dv.pages(config.source)
  .where(p => p.type === config.type);

if (config.excludeCurrentFile) {
  const currentFileName = dv.current().file.name;
  pages = pages.where(p => p.file.name !== currentFileName);
}

if (config.mode === "active") {
  pages = pages.where(p => U.isActiveLifecycle(p.lifecycle));
} else {
  pages = pages.where(p => U.isArchivedLifecycle(p.lifecycle));
}

const rows = Array.from(pages)
  .sort((a, b) => dv.compare(b.file.mtime, a.file.mtime));

if (rows.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["ノート名", "カテゴリ", "最終更新日"],
    rows.map(p => [
      p.file.link,
      U.categoryLabel(p.category),
      U.formatDate(p.file.mday)
    ])
  );
}
