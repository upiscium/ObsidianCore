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

if (config.mode === "summary") {
  dv.paragraph(`承認待ちの提案: ${pages.length} 件（[[98-System/02-embed/hub/ai-hub|AI HUB]]で確認）`);
} else if (pages.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.paragraph(`承認待ち: ${pages.length} 件。ノートを開いて、「Knowledgeに昇格」か「Ideaとして保持」を選びます。`);
  dv.table(
    ["提案", "カテゴリ", "作成日"],
    pages.map(page => [
      page.file.link,
      page?.category ?? "▫️",
      page.file.ctime,
    ])
  );
}
