import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const expression = file => new Function(`"use strict"; return (${fs.readFileSync(file, "utf8")});`)();
const I = expression("98-System/01-script/idea_meta_utils.js");
const R = expression("98-System/01-script/reference_utils.js");

test("Idea adoption metadata distinguishes legacy history without mutating or inferring", () => {
  const legacy = Object.freeze({ status: "adopted", project: "[[10-Project/Related]]", ai_source: "preserve" });
  assert.equal(I.adoptionState(legacy), "legacy");
  assert.equal(legacy.adopted_project, undefined);
  assert.equal(I.adoptionState({ status: "active" }), "none");
  assert.equal(I.adoptionState({ status: "archived", adopted_project: null, adopted_at: "" }), "none");
  assert.equal(I.adoptionState({ status: "adopted", adopted_project: "[[P]]" }), "partial");
  assert.equal(I.adoptionState({ status: "archived", adopted_at: "2026-10-28" }), "partial");
  assert.equal(I.adoptionState({ status: "adopted", adopted_project: "[[P]]", adopted_at: "2026-10-28" }), "complete");
});

test("Idea adoption dates require real strict Gregorian date strings", () => {
  for (const value of ["2026-10-28", "2024-02-29", "2000-02-29", "0099-01-01"]) {
    assert.equal(I.normalizeAdoptionDate(value), value);
  }
  for (const value of [null, undefined, "", "2026-2-01", "2026-02-29", "1900-02-29", "2026-04-31",
    "2026-00-10", "2026-13-01", "2026-01-00", "0000-01-01", "2026-10-28T00:00:00Z",
    " 2026-10-28", "2026-10-28\n", 20261028, ["2026-10-28"], new Date("2026-10-28")]) {
    assert.equal(I.normalizeAdoptionDate(value), null, String(value));
  }
});

const item = path => ({ file: { path: `${path}.md`, basename: path.split("/").pop() } });

test("Strict reference diagnostics reject ambiguous and stale links without changing legacy readers", () => {
  const a = item("10-Project/A/P");
  const b = item("10-Project/B/P");
  assert.equal(R.inspectReference("[[P]]", [a, b]).status, "ambiguous");
  assert.equal(R.inspectReference("[[10-Project/Old/P]]", [a]).status, "unresolved");
  assert.equal(R.inspectReference("[[10-project/a/p.md|Display]]", [a, b]).target, a);
  assert.equal(R.inspectReference({ path: "10-Project/A/P", display: "Display" }, [a, b]).target, a);
  assert.equal(R.inspectReference("P", [a]).legacy, true);
  for (const value of [[], ["[[P]]"], ["[[P]]", "[[P]]"], "[[P]] [[P]]", "[[P]", "[[P|a|b]]", "[[P#Heading]]", {}, { path: "" }, 7, false]) {
    assert.equal(R.inspectReference(value, [a]).status, "malformed", String(value));
  }
  for (const value of [null, undefined, ""]) assert.equal(R.inspectReference(value, [a]).status, "missing");
  assert.equal(R.resolveIndexedReference("[[10-Project/Old/P]]", R.indexByFilePath([a])), a);
  assert.equal(R.inspectReference("[[P]]", [a], [a.file, item("Other/P").file]).status, "ambiguous");
  assert.equal(R.inspectReference("[[Other/P]]", [a], [a.file, item("Other/P").file]).status, "unresolved");
});
