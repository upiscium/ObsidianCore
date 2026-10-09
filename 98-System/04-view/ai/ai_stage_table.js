async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/05-lib/ai/projection_utils.js");

const config = {
  mode: "processing", // processing | review | delivery | completed | rejected | failed | all
  emptyMessage: "AI成果物はありません。",
  ...(input ?? {}),
};

const allowedModes = new Set([
  "processing",
  "review",
  "delivery",
  "completed",
  "rejected",
  "failed",
  "all",
]);
if (!allowedModes.has(config.mode)) {
  throw new Error(`ai_stage_table requires a supported mode (got: ${String(config.mode)})`);
}

const Ack = config.mode === "rejected" || config.mode === "all"
  ? await loadLib("98-System/05-lib/ai/acknowledge_validation.js")
  : null;

function acknowledgementAction(page) {
  if (!Ack || !Ack.isEligible(page)) return "—";
  const state = Ack.requestState(page);
  if (state === "pending") return "確認要求済み・処理待ち";
  if (state === "invalid") return "要求値を確認してください";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Acknowledge";
  button.className = "oc-action";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await Ack.requestAcknowledgement(app, page);
      button.replaceWith(document.createTextNode("確認要求済み・処理待ち"));
      new Notice("確認要求を保存しました。Automationの受付と削除完了までは一覧に残ります。");
    } catch (error) {
      button.disabled = false;
      new Notice(`Acknowledge要求を保存できませんでした: ${String(error?.message ?? error)}`);
    }
  });
  return button;
}

const pages = U.projectionPages(dv);
const current = U.latestByCase(pages, dv)
  .filter(page => config.mode === "all" || U.stateOf(page) === config.mode)
  .sort((a, b) => dv.compare(b?.file?.mtime ?? null, a?.file?.mtime ?? null));

if (current.length === 0) {
  dv.paragraph(config.emptyMessage);
} else {
  dv.table(
    ["Artifact", "Current stage", "Status", "Updated", "Action"],
    current.map(page => [
      page.file.link,
      U.stateLabel(page),
      Ack?.requestState(page) === "pending"
        ? "Acknowledge要求済み"
        : page?.ai_status ?? "▫️",
      page.file.mtime,
      acknowledgementAction(page),
    ])
  );
}
