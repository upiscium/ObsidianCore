(() => {
  // Human-facing request only. Automation validates and records the acknowledgement;
  // this client has no authority to delete projections or change pipeline state.
  const SHA256 = /^[0-9a-f]{64}$/;
  const VALIDATION_PATH = /^04-AI\/30-Validation\/([0-9a-f]{64})\.md$/;
  const REQUEST_KEY = "acknowledge_request";
  const REQUEST_VALUE = "acknowledge";

  function exactValue(value) {
    return typeof value === "string" ? value : "";
  }

  function isEligible(page) {
    if (!page || typeof page !== "object") return false;
    const path = exactValue(page?.file?.path);
    const matched = VALIDATION_PATH.exec(path);
    return !!(
      matched
      && SHA256.test(exactValue(page.ai_case_id))
      && matched[1] === page.ai_case_id
      && page.type === "ai-pipeline-projection"
      && page.ai_stage === "validation"
      && page.validation_result === "rejected"
      && page.source_kind === "validation_record"
      && SHA256.test(exactValue(page.source_sha256))
      && SHA256.test(exactValue(page.proposal_sha256))
      && typeof page.target_path === "string"
      && page.target_path.startsWith("11-Knowledge/")
      && page.target_path.endsWith(".md")
    );
  }

  function requestState(page) {
    if (!isEligible(page)) return "ineligible";
    const request = page[REQUEST_KEY];
    if (request == null || request === "") return "none";
    if (request === REQUEST_VALUE) return "pending";
    return "invalid";
  }

  function assertSameRejection(frontmatter, page) {
    if (!frontmatter || typeof frontmatter !== "object") {
      throw new Error("Validation frontmatter is missing");
    }
    for (const key of [
      "type",
      "ai_case_id",
      "ai_stage",
      "validation_result",
      "source_kind",
      "source_sha256",
      "proposal_sha256",
      "target_path",
    ]) {
      if (frontmatter[key] !== page[key]) {
        throw new Error("Validation projection changed since it was listed");
      }
    }
    // A request is never allowed on a non-rejected, different or stale case.
    if (!isEligible({ ...frontmatter, file: { path: page.file.path } })) {
      throw new Error("Validation projection is not eligible");
    }
  }

  async function requestAcknowledgement(obsidianApp, page) {
    if (!isEligible(page)) throw new Error("Not an eligible rejected Validation case");
    if (requestState(page) === "invalid") {
      throw new Error("Unsupported acknowledgement request already present");
    }
    const file = obsidianApp?.vault?.getAbstractFileByPath?.(page.file.path);
    if (!file || file.extension !== "md" || file.path !== page.file.path) {
      throw new Error("Rejected Validation note is unavailable");
    }
    if (typeof obsidianApp?.fileManager?.processFrontMatter !== "function") {
      throw new Error("Obsidian frontmatter writer is unavailable");
    }
    let changed = false;
    await obsidianApp.fileManager.processFrontMatter(file, (frontmatter) => {
      assertSameRejection(frontmatter, page);
      const current = frontmatter[REQUEST_KEY];
      if (current === REQUEST_VALUE) return; // idempotent replay
      if (current != null && current !== "") {
        throw new Error("Conflicting acknowledgement request");
      }
      frontmatter[REQUEST_KEY] = REQUEST_VALUE;
      changed = true;
    });
    return {
      status: changed ? "requested" : "already_requested",
      // This is NOT acknowledgement success; private Intake and Sync must finish.
      state: "pending",
    };
  }

  return {
    REQUEST_KEY,
    REQUEST_VALUE,
    isEligible,
    requestState,
    requestAcknowledgement,
  };
})()
