import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

const S = expression("98-System/01-script/task_schedule_utils.js");
const factory = expression("98-System/01-script/task_attention_utils.js");
const A = factory(S);

test("Task Attention keeps only high-signal operational rules", () => {
  const thresholds = A.thresholds({});
  assert.deepEqual(thresholds, { doingStaleDays: 7 });

  const stale = {
    status: "doing",
    backlog: false,
    file: { mtime: "2026-09-10" }
  };
  assert.equal(A.isStaleDoingTask(stale, "2026-09-19", thresholds), true);
  assert.equal(A.isStaleDoingTask({ ...stale, backlog: true }, "2026-09-19", thresholds), false);
  assert.equal(A.isBlockedTask({ status: "todo", backlog: false }, true, status => status === "todo"), true);
  assert.equal(A.isBlockedTask({ status: "todo", backlog: true }, true, status => status === "todo"), false);
});

test("Task Attention detects running Projects without actionable Tasks", () => {
  const project = { status: "running", file: { path: "10-Project/P.md" } };
  const matches = (value, reference) => String(value ?? "").includes(reference);
  const actionable = status => status === "todo" || status === "doing";

  assert.equal(A.isRunningProjectWithoutAction(project, [], matches, actionable), true);
  assert.equal(A.isRunningProjectWithoutAction(project, [
    { status: "todo", backlog: false, project: "[[10-Project/P.md]]" }
  ], matches, actionable), false);
});

test("Task Attention view is compact and excludes Weekly Review inventory buckets", () => {
  const source = read("98-System/04-view/tasks/task_attention.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", "app", "document", "Notice", source));

  assert.match(source, /A\.isBlockedTask/);
  assert.match(source, /A\.isStaleDoingTask/);
  assert.match(source, /A\.isRunningProjectWithoutAction/);
  assert.match(source, /dv\.table\(\["Type", "Item", "Due", "Reason"\]/);
  assert.doesNotMatch(source, /oldBacklog|entityReviewBucket|stateDecision|Backlog登録/);
});

test("Task HUB exposes Attention and Weekly Review stays retired", () => {
  const hub = read("98-System/02-embed/hub/task-hub.md");
  assert.match(hub, /^## Attention$/m);
  assert.match(hub, /98-System\/02-embed\/05-task\/task-attention\|task-attention/);
  assert.doesNotMatch(hub, /Weekly Review|weekly-review/);

  for (const retired of [
    "98-System/02-embed/05-task/weekly-review.md",
    "98-System/04-view/tasks/weekly_review.js",
    "98-System/01-script/weekly_review_utils.js",
    "98-System/99-dev/test/weekly-review-contracts.test.mjs"
  ]) {
    assert.equal(fs.existsSync(path.join(root, retired)), false, retired);
  }
});
