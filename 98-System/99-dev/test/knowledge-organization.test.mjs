import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath => new Function(`"use strict"; return (${read(relativePath)});`)();

test("stable knowledge-meta basename delegates to organized Knowledge metadata content", () => {
  assert.equal(
    read("98-System/02-embed/00-meta/knowledge-meta.md"),
    "~~~meta-bind-embed\n[[98-System/02-embed/knowledge/knowledge-meta-content|knowledge-meta-content]]\n~~~\n".replaceAll("~~~", "```"),
  );
  const content = read("98-System/02-embed/knowledge/knowledge-meta-content.md");
  assert.match(content, /knowledge-status-active/);
  assert.match(content, /knowledge-maturity-stable/);
  assert.match(content, /\[\[knowledge-category-dropdown\]\]/);
  assert.match(content, /\[\[knowledge-source-dropdown\]\]/);
});

test("stable updated-knowledge-table delegates to organized Knowledge view", () => {
  assert.equal(
    read("98-System/02-embed/03-table/updated-knowledge-table.md"),
    "~~~dvjs\nawait dv.view(\"98-System/04-view/knowledge/recent_knowledge_table\");\n~~~\n".replaceAll("~~~", "```"),
  );
});

test("organized Recent Knowledge view compiles and owns only presentation filtering", () => {
  const source = read("98-System/04-view/knowledge/recent_knowledge_table.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction("dv", "input", source));
  assert.match(source, /98-System\/05-lib\/shared\/view_utils\.js/);
  assert.match(source, /98-System\/05-lib\/knowledge\/knowledge_view_utils\.js/);
  assert.match(source, /source: '\"11-Knowledge\"'/);
  assert.match(source, /days: 7/);
  assert.match(source, /limit: 5/);
  assert.match(source, /\["リンク", "最終更新日"\]/);
});

test("Recent Knowledge view-model preserves legacy/null visibility, inclusive cutoff, order and limit", () => {
  const V = expression("98-System/05-lib/shared/view_utils.js");
  const factory = expression("98-System/05-lib/knowledge/knowledge_view_utils.js");
  const M = factory(V);
  const compare = (a, b) => Number(a) - Number(b);

  assert.equal(M.isRecentStatusVisible(null), true);
  assert.equal(M.isRecentStatusVisible(""), true);
  assert.equal(M.isRecentStatusVisible("active"), true);
  assert.equal(M.isRecentStatusVisible("outdated"), true);
  assert.equal(M.isRecentStatusVisible("legacy-status"), true);
  assert.equal(M.isRecentStatusVisible("archived"), false);
  assert.equal(M.isRecentStatusVisible("deleted"), false);

  const pages = [
    { file: { name: "hub", mtime: 100 } },
    { file: { name: "Archived", mtime: 100 }, status: "archived" },
    { file: { name: "Deleted", mtime: 100 }, status: "deleted" },
    { file: { name: "Old", mtime: 69 }, status: "active" },
    { file: { name: "Boundary", mtime: 70 }, status: null },
    { file: { name: "A", mtime: 71 }, status: "active" },
    { file: { name: "B", mtime: 72 }, status: "outdated" },
    { file: { name: "C", mtime: 73 }, status: "legacy-status" },
    { file: { name: "D", mtime: 74 }, status: "active" },
    { file: { name: "E", mtime: 75 }, status: "active" },
  ];

  const rows = M.selectRecent(pages, { cutoff: 70, compare, limit: 5 });
  assert.deepEqual(rows.map(page => page.file.name), ["E", "D", "C", "B", "A"]);
  assert.equal(M.isRecentKnowledgeCandidate(pages[4], 70, compare), true);
  assert.equal(M.isRecentKnowledgeCandidate(pages[3], 70, compare), false);
});

test("Knowledge public interfaces remain registered and promotion still emits the stable basename", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const basename = new Set(
    registry.groups
      .filter(group => group.resolution === "basename")
      .flatMap(group => group.paths ?? []),
  );

  assert.equal(basename.has("98-System/02-embed/00-meta/knowledge-meta.md"), true);
  assert.equal(basename.has("98-System/02-embed/03-table/updated-knowledge-table.md"), true);

  const promotion = read("98-System/01-script/knowledge_promotion_utils.js");
  assert.match(promotion, /const replacement = "```meta-bind-embed\\n\[\[knowledge-meta\]\]\\n```";/);
});
