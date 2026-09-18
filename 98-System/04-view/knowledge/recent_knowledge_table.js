async function loadExpression(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function(`"use strict"; return (${source});`)();
}

const M = await loadExpression("98-System/05-lib/knowledge/knowledge_view_utils.js");

const config = {
  source: '"11-Knowledge"',
  days: 7,
  limit: 5,
  ...(input ?? {})
};

if (!Number.isInteger(config.days) || config.days < 0) {
  throw new Error("Recent Knowledge days must be a non-negative integer");
}
if (!Number.isInteger(config.limit) || config.limit < 0) {
  throw new Error("Recent Knowledge limit must be a non-negative integer");
}

const today = dv.date("today").startOf("day");
const cutoff = today.minus({ days: config.days });
const pages = Array.from(dv.pages(config.source));
const rows = M.selectRecent(pages, {
  cutoff,
  compare: dv.compare,
  limit: config.limit
});

function dateText(value) {
  if (!value) return "-";
  if (typeof value.toFormat === "function") return value.toFormat("yyyy-MM-dd");
  if (typeof value.toISODate === "function") return value.toISODate();
  return String(value).slice(0, 10);
}

dv.table(
  ["リンク", "最終更新日"],
  rows.map(page => [
    page.file.link,
    dateText(page.file.mday)
  ])
);
