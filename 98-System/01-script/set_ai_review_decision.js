module.exports = async function setAiReviewDecision(_tp, decision) {
  const requested = String(decision ?? "").trim();
  if (!["approve", "reject"].includes(requested)) {
    new Notice("Review decisionが不正です。");
    return { status: "rejected", reason: "invalid-decision" };
  }

  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || activeFile.extension !== "md") {
    new Notice("AI Human Reviewを開いてから実行してください。");
    return { status: "rejected", reason: "no-active-review" };
  }

  const frontmatter = app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {};
  if (
    frontmatter.type !== "ai-pipeline-projection"
    || frontmatter.ai_stage !== "review"
    || !/^04-AI\/50-Review\/[0-9a-f]{64}\.md$/.test(activeFile.path)
  ) {
    new Notice("現在のファイルはAI Human Reviewではありません。");
    return { status: "rejected", reason: "not-review-projection" };
  }

  const caseId = String(frontmatter.ai_case_id ?? "").trim();
  const expectedPath = `04-AI/50-Review/${caseId}.md`;
  if (!/^[0-9a-f]{64}$/.test(caseId) || activeFile.path !== expectedPath) {
    new Notice("Review projectionのcase bindingが不正です。");
    return { status: "rejected", reason: "case-binding-mismatch" };
  }

  const currentRequest = normalizeOptional(frontmatter.review_request);
  if (currentRequest === requested) {
    new Notice(`Review requestは既に${requested}です。`);
    return {
      status: "already_decided",
      reviewRequest: requested,
    };
  }
  if (currentRequest) {
    new Notice(`Review requestは既に${currentRequest}です。`);
    return { status: "rejected", reason: "review-already-decided" };
  }

  try {
    await app.fileManager.processFrontMatter(activeFile, fm => {
      if (
        fm.type !== "ai-pipeline-projection"
        || fm.ai_stage !== "review"
        || String(fm.ai_case_id ?? "").trim() !== caseId
      ) {
        throw new Error("Review projection changed concurrently");
      }

      const current = normalizeOptional(fm.review_request);
      if (current === requested) return;
      if (current) {
        throw new Error(`Review request changed concurrently: ${current}`);
      }
      fm.review_request = requested;
    });
  } catch (error) {
    new Notice(
      `Review requestの保存に失敗しました: ${String(error?.message ?? error)}`
    );
    return {
      status: "failed",
      reason: "review-update-failed",
    };
  }

  new Notice(
    requested === "approve"
      ? "AI candidateをApproveしました。"
      : "AI candidateをRejectしました。"
  );
  return {
    status: "updated",
    reviewRequest: requested,
  };

  function normalizeOptional(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
};
