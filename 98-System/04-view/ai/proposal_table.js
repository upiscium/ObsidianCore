const config = {
  mode: "table", // table | summary
  emptyMessage: "承認待ちの提案はありません。",
  ...(input ?? {}),
};
if (config.mode !== "table" && config.mode !== "summary") {
  throw new Error(`proposal_table requires a supported mode (got: ${String(config.mode)})`);
}

const ROOT = "04-AI/Proposals";
const pages = Array.from(dv.pages(`"${ROOT}"`))
  .filter(page => String(page?.type ?? "").trim() === "knowledge-proposal")
  .filter(page => String(page?.file?.folder ?? "") === ROOT)
  .sort((a, b) => dv.compare(b?.file?.ctime ?? null, a?.file?.ctime ?? null));

function day(value) {
  if (value == null) return "▫️";
  if (typeof value?.toFormat === "function") return value.toFormat("MM-dd");
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime())
    ? `${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
    : "▫️";
}

if (config.mode === "summary") {
  dv.paragraph(`承認待ち **${pages.length}** 件 → [[98-System/02-embed/hub/ai-hub|AI HUB]]`);
} else if (pages.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["提案（開いて振り分け）", "分類", "日付"],
    pages.map(page => [page.file.link, page?.category ?? "▫️", day(page.file.ctime)])
  );
}
