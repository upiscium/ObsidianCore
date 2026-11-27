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
  // The count as a stat card (caption + number), like the other Dashboard cards.
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "repeat(auto-fit, minmax(8.5rem, 1fr))";
  root.style.gap = "0.6rem";
  root.style.margin = "0.5rem 0 1rem";

  const panel = document.createElement("section");
  panel.className = "oc-panel";
  panel.style.padding = "0.75rem";

  const caption = document.createElement("div");
  caption.className = "oc-caption";
  caption.textContent = "承認待ちの提案";

  const number = document.createElement("div");
  number.className = "oc-number";
  number.style.fontSize = "1.35rem";
  number.style.fontWeight = "700";
  number.textContent = String(pages.length);

  panel.append(caption, number);
  root.append(panel);
  dv.container.append(root);
} else if (pages.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["提案（開いて振り分け）", "分類", "日付"],
    pages.map(page => [page.file.link, page?.category ?? "▫️", day(page.file.ctime)])
  );
}
