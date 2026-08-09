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
const factory = readExpression("98-System/01-script/task_reschedule_utils.js");
const Q = factory(S);
const today = "2026-08-09";

test("Task reschedule date presets are deterministic", () => {
  assert.equal(Q.addDays(today, 1), "2026-08-10");
  assert.equal(Q.addDays(today, 3), "2026-08-12");
  assert.equal(Q.addDays(today, 7), "2026-08-16");
  assert.equal(Q.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(Q.addDays("2028-02-28", 1), "2028-02-29");
});

test("Due presets update only Due", () => {
  assert.deepEqual(Q.buildReschedulePatch({
    currentStart: "2026-08-10",
    currentDue: "2026-08-20",
    duePreset: "plus3",
    today
  }), { due: "2026-08-12" });

  assert.deepEqual(Q.buildReschedulePatch({
    currentDue: "2026-08-20",
    duePreset: "nextWeek",
    today
  }), { due: "2026-08-16" });
});

test("Start can be deferred, cleared, or set explicitly", () => {
  assert.deepEqual(Q.buildReschedulePatch({
    currentStart: "2026-08-09",
    currentDue: "2026-08-30",
    startPreset: "tomorrow",
    today
  }), { start: "2026-08-10" });

  assert.deepEqual(Q.buildReschedulePatch({
    currentStart: "2026-08-09",
    currentDue: "2026-08-30",
    startPreset: "clear",
    today
  }), { start: null });

  assert.deepEqual(Q.buildReschedulePatch({
    currentDue: "2026-09-30",
    startPreset: "custom",
    customStart: "2026-09-01",
    today
  }), { start: "2026-09-01" });
});

test("Due and Start can move atomically", () => {
  assert.deepEqual(Q.buildReschedulePatch({
    currentStart: "2026-08-20",
    currentDue: "2026-08-25",
    startPreset: "tomorrow",
    duePreset: "plus3",
    today
  }), {
    start: "2026-08-10",
    due: "2026-08-12"
  });
});

test("reschedule rejects Start after final Due", () => {
  assert.throws(() => Q.buildReschedulePatch({
    currentStart: "2026-08-20",
    currentDue: "2026-08-30",
    duePreset: "tomorrow",
    today
  }), /StartはDue以前/);

  assert.throws(() => Q.buildReschedulePatch({
    currentDue: "2026-08-15",
    startPreset: "nextWeek",
    today
  }), /StartはDue以前/);
});

test("custom dates must be valid calendar dates", () => {
  assert.throws(() => Q.buildReschedulePatch({
    duePreset: "custom",
    customDue: "2026-02-30",
    today
  }), /DueはYYYY-MM-DD/);

  assert.throws(() => Q.buildReschedulePatch({
    startPreset: "custom",
    customStart: "2026\/08\/10",
    today
  }), /StartはYYYY-MM-DD/);
});

test("keeping both fields is a no-op patch", () => {
  assert.deepEqual(Q.buildReschedulePatch({
    currentStart: "2026-08-10",
    currentDue: "2026-08-20",
    today
  }), {});
});

test("applying a reschedule patch preserves unrelated Task metadata", () => {
  const frontmatter = {
    type: "task",
    title: "Example",
    source: "[[Source]]",
    created: "2026-08-09",
    completed: null,
    status: "doing",
    priority: "high",
    workspace: "[[03-Workspace/Research]]",
    project: "[[10-Project/Terreate]]",
    triaged: true,
    backlog: false,
    depends_on: ["[[02-Task/Dependency]]"],
    start: "2026-08-10",
    due: "2026-08-20"
  };

  const patch = Q.buildReschedulePatch({
    currentStart: frontmatter.start,
    currentDue: frontmatter.due,
    startPreset: "clear",
    duePreset: "nextWeek",
    today
  });
  Q.applyReschedulePatch(frontmatter, patch);

  assert.equal(frontmatter.start, null);
  assert.equal(frontmatter.due, "2026-08-16");
  assert.equal(frontmatter.status, "doing");
  assert.equal(frontmatter.priority, "high");
  assert.equal(frontmatter.workspace, "[[03-Workspace/Research]]");
  assert.equal(frontmatter.project, "[[10-Project/Terreate]]");
  assert.equal(frontmatter.triaged, true);
  assert.equal(frontmatter.backlog, false);
  assert.deepEqual(frontmatter.depends_on, ["[[02-Task/Dependency]]"]);
});

test("Task metadata embed exposes the reschedule action", () => {
  const embed = fs.readFileSync(path.join(root, "98-System/02-embed/00-meta/task-note-meta.md"), "utf8");
  const command = fs.readFileSync(path.join(root, "98-System/00-command/reschedule_task.md"), "utf8");
  assert.match(embed, /BUTTON\[task-reschedule\]/);
  assert.match(embed, /id: task-reschedule/);
  assert.match(embed, /templateFile: "98-System\/00-command\/reschedule_task\.md"/);
  assert.match(command, /tp\.user\.reschedule_task\(tp\)/);
});
