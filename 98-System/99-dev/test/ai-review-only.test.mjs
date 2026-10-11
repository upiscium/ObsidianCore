import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const summary = read("98-System/04-view/ai/ai_dashboard_summary.js");
const table = read("98-System/04-view/ai/ai_stage_table.js");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const id = ch => ch.repeat(64);

function fixture(ch, stage, mtime, extras = {}) {
  return {
    ai_case_id: id(ch),
    ai_stage: stage,
    ai_status: stage,
    file: { path: `04-AI/${stage}/${id(ch)}.md`, link: `${ch}-${stage}`, mtime },
    ...extras,
  };
}

function setup(pages) {
  const tableCalls = [];
  const paragraphs = [];
  const appended = [];
  const dv = {
    io: { load: async name => read(name) },
    pages: source => {
      assert.equal(source, '"04-AI"', "only canonical 04-AI projections may be read");
      return pages;
    },
    compare: (a, b) => a === b ? 0 : a < b ? -1 : 1,
    table: (columns, rows) => tableCalls.push({ columns, rows }),
    paragraph: text => paragraphs.push(text),
    container: { append: node => appended.push(node) },
  };
  const document = {
    createElement(tag) {
      return {
        tag,
        style: {},
        className: "",
        textContent: "",
        children: [],
        append(...nodes) { this.children.push(...nodes); },
      };
    },
  };
  return { dv, document, tableCalls, paragraphs, appended };
}

function texts(node) {
  return [node.textContent, ...(node.children ?? []).flatMap(texts)];
}

async function countInDashboard(pages) {
  const state = setup(pages);
  await new AsyncFunction("dv", "input", "document", summary)(state.dv, {}, state.document);
  assert.equal(state.appended.length, 1);
  return texts(state.appended[0]).filter(Boolean);
}

test("Review-only dashboard shows zero, not a health or staleness assertion", async () => {
  const labels = await countInDashboard([]);
  assert.deepEqual(labels, ["Review", "0", "Review待ちはありません。"]);
});

test("Review count honors latest-by-case, stage precedence and valid IDs", async () => {
  const cases = [
    fixture("a", "review", 6),
    fixture("b", "review", 50),
    fixture("b", "completed", 10), // Completed wins despite earlier mtime
    fixture("c", "validation", 40, { validation_result: "rejected" }),
    fixture("d", "input", 1),
    fixture("d", "review", 7),
    fixture("e", "processing", 6), // unknown stage is not a case
    { ...fixture("f", "review", 8), ai_case_id: "not-a-sha" },
  ];
  assert.deepEqual(await countInDashboard(cases), [
    "Review", "2", "判断待ちのAI成果物があります。",
  ]);

  const state = setup(cases);
  await new AsyncFunction("dv", "input", table)(state.dv, {
    mode: "review",
    emptyMessage: "Review待ちはありません。",
  });
  assert.equal(state.tableCalls.length, 1);
  const rows = state.tableCalls[0].rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row[0]).sort(), ["a-review", "d-review"]);
  assert.deepEqual(state.paragraphs, []);
});

test("Review table empty state remains calm when projections are non-actionable", async () => {
  const state = setup([
    fixture("a", "input", 1),
    fixture("b", "validation", 2, { validation_result: "rejected" }),
    fixture("c", "completed", 3),
  ]);
  await new AsyncFunction("dv", "input", table)(state.dv, {
    mode: "review",
    emptyMessage: "Review待ちはありません。",
  });
  assert.deepEqual(state.tableCalls, []);
  assert.deepEqual(state.paragraphs, ["Review待ちはありません。"]);
});
