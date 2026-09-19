async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const K = await loadExpression("98-System/01-script/knowledge_meta_utils.js");
const V = await loadExpression("98-System/05-lib/shared/view_utils.js");

const config = {
  source: '"11-Knowledge"',
  emptyMessage: "Knowledgeはまだありません。",
  ...(input ?? {})
};

const pages = Array.from(dv.pages(config.source))
  .filter(page => page?.file?.name !== "hub")
  .filter(page => page?.type === "knowledge-note")
  .filter(page => !K.isArchivedStatus(page.status) && !K.isHiddenStatus(page.status))
  .sort((a, b) => {
    const statusDelta = K.statusOrder(a?.status) - K.statusOrder(b?.status);
    if (statusDelta !== 0) return statusDelta;
    return V.compareFileMtimeDesc(a, b, dv.compare);
  });

function dateText(value) {
  if (!value) return "-";
  if (typeof value.toFormat === "function") return value.toFormat("yyyy-MM-dd");
  if (typeof value.toISODate === "function") return value.toISODate();
  return String(value).slice(0, 10);
}

if (pages.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["Knowledge", "Status", "カテゴリ", "成熟度", "情報源", "最終更新日"],
    pages.map(page => [
      page.file.link,
      K.statusLabel(page.status),
      K.categoryLabel(page.category),
      K.maturityLabel(page.maturity),
      K.sourceTypeLabel(page.source_type),
      dateText(page.file.mday)
    ])
  );
}
