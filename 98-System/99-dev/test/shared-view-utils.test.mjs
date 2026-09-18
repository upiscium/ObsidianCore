import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath =>
  new Function(`"use strict"; return (${read(relativePath)});`)();

test("shared view utils normalize the existing Work/Finance date shape", () => {
  const V = expression("98-System/05-lib/shared/view_utils.js");

  assert.equal(V.normalizeDate(null), null);
  assert.equal(V.normalizeDate(""), null);
  assert.equal(V.normalizeDate("2026-09-18"), "2026-09-18");
  assert.equal(
    V.normalizeDate({ toFormat: pattern => pattern === "yyyy-MM-dd" ? "2026-09-18" : "unexpected" }),
    "2026-09-18",
  );
  assert.equal(V.normalizeDate({ toString: () => "legacy-date" }), "legacy-date");
});

test("shared view utils preserve descending file mtime ordering", () => {
  const V = expression("98-System/05-lib/shared/view_utils.js");
  const compare = (a, b) => Number(a ?? 0) - Number(b ?? 0);

  const rows = [
    { file: { mtime: 2 } },
    { file: { mtime: 5 } },
    { file: { mtime: 3 } },
  ].sort((a, b) => V.compareFileMtimeDesc(a, b, compare));

  assert.deepEqual(rows.map(row => row.file.mtime), [5, 3, 2]);
});

test("shared view utils stay pure and do not absorb feature semantics", () => {
  const source = read("98-System/05-lib/shared/view_utils.js");

  assert.doesNotMatch(source, /\bdv\b|\bapp\b|\bmoment\b/);
  assert.doesNotMatch(source, /task|workspace|project|knowledge|subscription|expense|income|workplace/i);

  const taskSchedule = read("98-System/01-script/task_schedule_utils.js");
  assert.doesNotMatch(taskSchedule, /05-lib\/shared\/view_utils/);
});
