import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readExpression(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  return new Function(`"use strict"; return (${source});`)();
}

const S = readExpression("98-System/01-script/task_schedule_utils.js");
const factory = readExpression("98-System/01-script/weekly_review_utils.js");
const W = factory(S);
const T = readExpression("98-System/01-script/task_meta_utils.js");
const E = readExpression("98-System/01-script/entity_meta_utils.js");
const G = readExpression("98-System/01-script/reference_utils.js");
const today = "2026-08-09";

function file(pathValue, mtime) {
  return {
    path: pathValue,
    name: pathValue.split("/").pop().replace(/\.md$/, ""),
    mtime
  };
}

test("Weekly Review thresholds are explicit and overridable", () => {
  assert.deepEqual(W.thresholds(), {
    doingStaleDays: 7,
    backlogStaleDays: 30,
    entityStaleDays: 30,
    entityStateDecisionDays: 90
  });
  assert.equal(W.thresholds({ doingStaleDays: 14 }).doingStaleDays, 14);
  assert.throws(() => W.thresholds({ doingStaleDays: -1 }), /Invalid weekly review threshold/);
  assert.throws(
    () => W.thresholds({ entityStaleDays: 60, entityStateDecisionDays: 30 }),
    /entityStateDecisionDays/
  );
});

test("Doing Task becomes stale exactly at the configured boundary", () => {
  assert.equal(W.isStaleDoingTask({ status: "doing", file: file("02-Task/A.md", "2026-08-02") }, today), true);
  assert.equal(W.isStaleDoingTask({ status: "doing", file: file("02-Task/A.md", "2026-08-03") }, today), false);
  assert.equal(W.isStaleDoingTask({ status: "todo", file: file("02-Task/A.md", "2026-07-01") }, today), false);
});

test("old Backlog uses Task age and requires actionable status", () => {
  const base = { status: "todo", backlog: true, created: "2026-07-10", file: file("02-Task/A.md", "2026-08-09") };
  assert.equal(W.isOldBacklogTask(base, today, T.isTaskActionableStatus), true);
  assert.equal(W.isOldBacklogTask({ ...base, created: "2026-07-11" }, today, T.isTaskActionableStatus), false);
  assert.equal(W.isOldBacklogTask({ ...base, status: "done" }, today, T.isTaskActionableStatus), false);
  assert.equal(W.isOldBacklogTask({ ...base, backlog: false }, today, T.isTaskActionableStatus), false);
});

test("Blocked review only includes actionable Tasks", () => {
  assert.equal(W.isBlockedTask({ status: "todo" }, true, T.isTaskActionableStatus), true);
  assert.equal(W.isBlockedTask({ status: "doing" }, true, T.isTaskActionableStatus), true);
  assert.equal(W.isBlockedTask({ status: "done" }, true, T.isTaskActionableStatus), false);
  assert.equal(W.isBlockedTask({ status: "todo" }, false, T.isTaskActionableStatus), false);
});

test("running Project without a non-Backlog actionable Task is surfaced", () => {
  const project = { status: "running", file: file("10-Project/Terreate/Terreate.md", "2026-08-09") };
  const linkedTodo = { status: "todo", backlog: false, project: "[[10-Project/Terreate/Terreate|Terreate]]" };
  const linkedBacklog = { status: "todo", backlog: true, project: "[[10-Project/Terreate/Terreate|Terreate]]" };
  const other = { status: "doing", backlog: false, project: "[[10-Project/Other/Other|Other]]" };

  assert.equal(
    W.projectActionableTaskCount(project, [linkedTodo, linkedBacklog, other], G.matchesReference, T.isTaskActionableStatus),
    1
  );
  assert.equal(
    W.isRunningProjectWithoutAction(project, [linkedBacklog, other], G.matchesReference, T.isTaskActionableStatus),
    true
  );
  assert.equal(
    W.isRunningProjectWithoutAction({ ...project, status: "planning" }, [], G.matchesReference, T.isTaskActionableStatus),
    false
  );
});

test("Entity review buckets separate stale and state-decision candidates", () => {
  const active = daysAgo => ({ status: "running", file: file("10-Project/A/A.md", daysAgo) });
  assert.equal(W.entityReviewBucket(active("2026-07-11"), today, E.isActiveStatus), null);
  assert.equal(W.entityReviewBucket(active("2026-07-10"), today, E.isActiveStatus), "stale");
  assert.equal(W.entityReviewBucket(active("2026-05-12"), today, E.isActiveStatus), "stale");
  assert.equal(W.entityReviewBucket(active("2026-05-11"), today, E.isActiveStatus), "state-decision");
  assert.equal(
    W.entityReviewBucket({ status: "done", file: file("10-Project/A/A.md", "2026-01-01") }, today, E.isActiveStatus),
    null
  );
});

test("Weekly Review view compiles and dashboard embeds it", () => {
  const viewPath = "98-System/04-view/weekly_review.js";
  const source = fs.readFileSync(path.join(root, viewPath), "utf8");
  assert.doesNotThrow(() => new Function("dv", "input", "app", "document", "Notice", `return (async () => {\n${source}\n})();`));

  const embed = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/weekly-review.md"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/dashboard-tasks.md"), "utf8");
  assert.match(embed, /dv\.view\("98-System\/04-view\/weekly_review"\)/);
  assert.match(dashboard, /\[\[weekly-review\]\]/);
});
