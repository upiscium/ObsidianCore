import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const helperPath = "98-System/05-lib/ai/acknowledge_validation.js";
const helper = new Function(`return (${read(helperPath)});`)();
const caseId = "a".repeat(64);

function rejected(overrides = {}) {
  return {
    type: "ai-pipeline-projection",
    ai_case_id: caseId,
    ai_stage: "validation",
    validation_result: "rejected",
    source_kind: "validation_record",
    source_sha256: "b".repeat(64),
    proposal_sha256: "c".repeat(64),
    target_path: "11-Knowledge/Rejected-Candidate.md",
    file: {
      path: `04-AI/30-Validation/${caseId}.md`,
      link: "Rejected Candidate",
      mtime: 1,
    },
    ...overrides,
  };
}

function mockApp(page, frontmatterOverrides = {}) {
  const file = { path: page.file.path, extension: "md" };
  let current = { ...page, ...frontmatterOverrides };
  delete current.file;
  const before = { ...current };
  let calls = 0;
  const app = {
    vault: {
      getAbstractFileByPath: p => (p === file.path ? file : null),
    },
    fileManager: {
      async processFrontMatter(target, callback) {
        assert.equal(target, file);
        calls += 1;
        const draft = { ...current };
        callback(draft);
        current = draft;
      },
    },
  };
  return { app, current: () => current, before, calls: () => calls };
}

test("legacy rejected Validation may add only acknowledge_request; acknowledgement remains pending", async () => {
  const page = rejected();
  assert.equal(helper.isEligible(page), true);
  assert.equal(helper.requestState(page), "none");
  const harness = mockApp(page);
  const result = await helper.requestAcknowledgement(harness.app, page);
  assert.deepEqual(result, { status: "requested", state: "pending" });
  assert.deepEqual(harness.current(), {
    ...harness.before,
    acknowledge_request: "acknowledge",
  });
  assert.equal(harness.calls(), 1);
  const pendingPage = { ...page, acknowledge_request: "acknowledge" };
  assert.equal(helper.requestState(pendingPage), "pending");
  const duplicate = await helper.requestAcknowledgement(harness.app, pendingPage);
  assert.deepEqual(duplicate, { status: "already_requested", state: "pending" });
  assert.deepEqual(harness.current(), {
    ...harness.before,
    acknowledge_request: "acknowledge",
  });
});

test("blank acknowledgement field is equivalent to historical absence", async () => {
  const page = rejected({ acknowledge_request: "" });
  const harness = mockApp(page);
  await helper.requestAcknowledgement(harness.app, page);
  assert.equal(harness.current().acknowledge_request, "acknowledge");
});

test("only exact rejected Validation case path and binding may request acknowledgement", async () => {
  const good = rejected();
  for (const changes of [
    { file: { path: `04-AI/50-Review/${caseId}.md` } },
    { file: { path: `04-AI/30-Validation/../30-Validation/${caseId}.md` } },
    { file: { path: `04-AI/30-Validation/${"A".repeat(64)}.md` } },
    { file: { path: `03-AI/30-Validation/${caseId}.md` } },
    { ai_case_id: "not-a-sha" },
    { type: "note" },
    { ai_stage: "failed" },
    { ai_stage: "review" },
    { validation_result: "accepted" },
    { source_kind: "proposal" },
    { source_sha256: "" },
    { proposal_sha256: "bad" },
    { target_path: "05-Idea/Unrelated.md" },
  ]) {
    const page = rejected(changes);
    assert.equal(helper.isEligible(page), false, JSON.stringify(changes));
    const harness = mockApp(page);
    await assert.rejects(helper.requestAcknowledgement(harness.app, page), /Not an eligible/);
    assert.equal(harness.calls(), 0);
  }
  assert.equal(helper.isEligible(good), true);
});

test("unexpected request values and changed protected frontmatter fail closed", async () => {
  const page = rejected();
  for (const changed of [
    { source_sha256: "d".repeat(64) },
    { proposal_sha256: "e".repeat(64) },
    { target_path: "11-Knowledge/Other.md" },
    { ai_case_id: "f".repeat(64) },
    { validation_result: "accepted" },
    { ai_stage: "review" },
    { type: "ordinary-note" },
    { acknowledge_request: "reject" },
    { acknowledge_request: ["acknowledge"] },
  ]) {
    const harness = mockApp(page, changed);
    await assert.rejects(helper.requestAcknowledgement(harness.app, page));
    assert.deepEqual(harness.current(), harness.before, JSON.stringify(changed));
  }
  const unsupported = rejected({ acknowledge_request: "approve" });
  assert.equal(helper.requestState(unsupported), "invalid");
  await assert.rejects(helper.requestAcknowledgement(mockApp(unsupported).app, unsupported));
});

test("unavailable Obsidian file/writer cannot create an acknowledgement", async () => {
  const page = rejected();
  await assert.rejects(
    helper.requestAcknowledgement({ vault: { getAbstractFileByPath: () => null } }, page),
    /unavailable/,
  );
  await assert.rejects(
    helper.requestAcknowledgement({ vault: {
      getAbstractFileByPath: () => ({ path: page.file.path, extension: "md" }),
    } }, page),
    /writer is unavailable/,
  );
});

test("Rejected UI shows real Acknowledge button and never removes the projection on click", async () => {
  const page = rejected();
  const harness = mockApp(page);
  const eventHandlers = new Map();
  let tableHeaders;
  let tableRows;
  const button = {
    disabled: false,
    textContent: "",
    className: "",
    addEventListener: (event, fn) => eventHandlers.set(event, fn),
    replaceWith: node => { button.replacement = node; },
  };
  const doc = {
    createElement: tag => {
      assert.equal(tag, "button");
      return button;
    },
    createTextNode: text => ({ text }),
  };
  const notices = [];
  const Notice = class { constructor(message) { notices.push(message); } };
  const dv = {
    io: { load: async p => read(p) },
    pages: root => root === '"04-AI"' ? [page] : [],
    compare: (a, b) => a === b ? 0 : a < b ? -1 : 1,
    table(headers, rows) { tableHeaders = headers; tableRows = rows; },
    paragraph: () => { throw new Error("rejected case should not be empty"); },
  };
  const view = read("98-System/04-view/ai/ai_stage_table.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("dv", "input", "document", "app", "Notice", view)(
    dv, { mode: "rejected" }, doc, harness.app, Notice,
  );
  assert.equal(tableHeaders.at(-1), "Action");
  assert.equal(tableRows.length, 1);
  assert.equal(tableRows[0].at(-1), button);
  assert.equal(button.textContent, "Acknowledge");
  await eventHandlers.get("click")();
  assert.equal(harness.current().acknowledge_request, "acknowledge");
  assert.equal(button.replacement.text, "確認要求済み・処理待ち");
  assert.equal(notices.length, 1);
  assert.match(notices[0], /削除完了までは一覧に残ります/);
  assert.equal("delete" in harness.app.vault, false);
  const pending = rejected({ acknowledge_request: "acknowledge" });
  let pendingRows;
  const pendingDv = { ...dv, pages: () => [pending], table: (_h, rows) => { pendingRows = rows; } };
  await new AsyncFunction("dv", "input", "document", "app", "Notice", view)(
    pendingDv, { mode: "rejected" }, doc, harness.app, Notice,
  );
  assert.equal(pendingRows[0].at(-1), "確認要求済み・処理待ち");
});
