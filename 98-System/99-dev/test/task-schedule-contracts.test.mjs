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
const T = readExpression("98-System/01-script/task_meta_utils.js");
const today = "2026-08-09";

test("future Task buckets have deterministic 7/8/30/31 day boundaries", () => {
  assert.equal(S.futureBucket({ due: "2026-08-10", today }), "next7");
  assert.equal(S.futureBucket({ due: "2026-08-16", today }), "next7");
  assert.equal(S.futureBucket({ due: "2026-08-17", today }), "next30");
  assert.equal(S.futureBucket({ due: "2026-09-08", today }), "next30");
  assert.equal(S.futureBucket({ due: "2026-09-09", today }), "later");
});

test("today and past dates are not future Tasks", () => {
  assert.equal(S.futureBucket({ due: "2026-08-09", today }), null);
  assert.equal(S.futureBucket({ due: "2026-08-08", today }), null);
});

test("future Start takes precedence over a farther Due", () => {
  assert.equal(S.effectiveFutureDate({
    start: "2026-08-12",
    due: "2026-10-01",
    today
  }), "2026-08-12");
  assert.equal(S.futureBucket({
    start: "2026-08-12",
    due: "2026-10-01",
    today
  }), "next7");
});

test("past or current Start falls back to future Due", () => {
  assert.equal(S.effectiveFutureDate({
    start: "2026-08-09",
    due: "2026-08-20",
    today
  }), "2026-08-20");
  assert.equal(S.effectiveFutureDate({
    start: "2026-08-01",
    due: "2026-09-20",
    today
  }), "2026-09-20");
});

test("date handling validates calendar dates and crosses month boundaries", () => {
  assert.equal(S.normalizeDateKey("2026-02-29"), null);
  assert.equal(S.normalizeDateKey("2028-02-29"), "2028-02-29");
  assert.equal(S.futureBucket({ due: "2026-09-01", today: "2026-08-30" }), "next7");
});

test("future views include only actionable non-backlog Tasks", () => {
  const base = { status: "todo", backlog: false, due: "2026-08-12" };
  assert.equal(S.matchesFutureMode(base, "next7", today, T.isTaskActionableStatus), true);
  assert.equal(S.matchesFutureMode({ ...base, status: "doing" }, "next7", today, T.isTaskActionableStatus), true);
  assert.equal(S.matchesFutureMode({ ...base, status: "done" }, "next7", today, T.isTaskActionableStatus), false);
  assert.equal(S.matchesFutureMode({ ...base, status: "cancelled" }, "next7", today, T.isTaskActionableStatus), false);
  assert.equal(S.matchesFutureMode({ ...base, backlog: true }, "next7", today, T.isTaskActionableStatus), false);
});

test("future view mode must be explicit", () => {
  assert.throws(
    () => S.matchesFutureMode({ status: "todo", due: "2026-08-12" }, "future", today, T.isTaskActionableStatus),
    /Unknown future Task mode/
  );
});
