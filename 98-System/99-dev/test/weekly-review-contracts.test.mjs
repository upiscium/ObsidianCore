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
const healthFactory = readExpression("98-System/01-script/entity_task_health_utils.js");
const H = healthFactory(S);
const factory = readExpression("98-System/01-script/weekly_review_utils.js");
const W = factory(S);
const T = readExpression("98-System/01-script/task_meta_utils.js");
const E = readExpression("98-System/01-script/entity_meta_utils.js");
const today = "2026-08-09";

function file(pathValue, mtime) {
  return {
    path: pathValue,
    name: pathValue.split("/").pop().replace(/\.md$/, ""),
    mtime
  };
}

function summarize(tasks, blocked = false) {
  return H.summarizeTasks(tasks, {
    today,
    isTodoStatus: T.isTaskTodoStatus,
    isDoingStatus: T.isTaskDoingStatus,
    isActionableStatus: T.isTaskActionableStatus,
    isBlocked: () => blocked
  });
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

test("running Project without canonical Next Action is surfaced for future, blocked, and empty cases", () => {
  const project = { status: "running", file: file("10-Project/Terreate/Terreate.md", "2026-08-09") };
  const isRunning = value => E.normalizeProjectStatus(value) === "running";

  assert.equal(W.isRunningProjectWithoutNextAction(project, summarize([{ status: "todo" }]), isRunning), false);
  assert.equal(W.isRunningProjectWithoutNextAction(project, summarize([{ status: "todo", start: "2026-08-10" }]), isRunning), true);
  assert.equal(W.isRunningProjectWithoutNextAction(project, summarize([{ status: "todo" }], true), isRunning), true);
  assert.equal(W.isRunningProjectWithoutNextAction(project, summarize([]), isRunning), true);
  assert.equal(W.isRunningProjectWithoutNextAction({ ...project, status: "planning" }, summarize([]), isRunning), false);
});

test("latest activity uses related activity instead of Entity mtime alone", () => {
  assert.equal(
    W.latestActivity(["2026-06-01", "2026-08-08", "2026-07-15"]),
    "2026-08-08"
  );
  assert.equal(W.latestActivity([null, undefined, ""]), null);
});

test("Entity review buckets can use externally computed activity", () => {
  const project = (status, mtime) => ({ entityType: "Project", status, file: file("10-Project/A/A.md", mtime) });
  const workspace = (lifecycle, mtime) => ({ entityType: "Workspace", lifecycle, file: file("03-Workspace/A/A.md", mtime) });
  const isActiveEntity = entity => entity.entityType === "Workspace"
    ? E.isWorkspaceActiveLifecycle(entity.lifecycle)
    : E.isProjectActiveStatus(entity.status);

  assert.equal(W.entityReviewBucket(project("running", "2026-01-01"), today, isActiveEntity, {}, "2026-08-08"), null);
  assert.equal(W.entityReviewBucket(project("running", "2026-08-09"), today, isActiveEntity, {}, "2026-07-10"), "stale");
  assert.equal(W.entityReviewBucket(project("running", "2026-08-09"), today, isActiveEntity, {}, "2026-05-11"), "state-decision");
  assert.equal(W.entityReviewBucket(project("done", "2026-01-01"), today, isActiveEntity, {}, "2026-01-01"), null);
  assert.equal(W.entityReviewBucket(workspace("inactive", "2026-01-01"), today, isActiveEntity, {}, "2026-01-01"), null);
});

test("Weekly Review view compiles as a three-part decision queue", () => {
  const viewPath = "98-System/04-view/weekly_review.js";
  const source = fs.readFileSync(path.join(root, viewPath), "utf8");
  assert.doesNotThrow(() => new Function("dv", "input", "app", "document", "Notice", `return (async () => {\n${source}\n})();`));
  assert.match(source, /entity_task_health_utils\.js/);
  assert.match(source, /isRunningProjectWithoutNextAction/);
  assert.match(source, /Project \/ Workspace Decisions/);
  assert.match(source, /Task Decisions/);
  assert.match(source, /Backlog Decisions/);
  assert.match(source, /latestActivity/);
  assert.doesNotMatch(source, /projectActionableTaskCount/);
  assert.doesNotMatch(source, /更新が止まった Doing Task/);

  const embed = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/weekly-review.md"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "98-System/02-embed/05-task/dashboard-tasks.md"), "utf8");
  assert.match(embed, /dv\.view\("98-System\/04-view\/weekly_review"\)/);
  assert.match(dashboard, /\[\[weekly-review\]\]/);
});
