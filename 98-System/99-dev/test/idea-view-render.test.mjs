import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const file = "98-System/04-view/ideas/idea_table.js";
const source = fs.readFileSync(path.join(root, file), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function idea(name, { status = "active", workspace = "[[03-Workspace/Research|Research]]",
    project = null, mday = "2026-10-27" } = {}) {
  return {
    type: "idea",
    status,
    workspace,
    project,
    file: {
      path: "05-Idea/" + name + ".md",
      link: { path: "05-Idea/" + name + ".md" },
      mtime: mday === null ? null : { toFormat: pattern => {
        assert.equal(pattern, "yyyy-MM-dd");
        return mday;
      } },
      mday: mday === null ? null : { toFormat: pattern => {
        assert.equal(pattern, "yyyy-MM-dd");
        return mday;
      } },
    },
  };
}

async function render(input, inputPages) {
  const output = { tables: [], paragraphs: [], sources: [] };
  const dv = {
    io: { async load(name) {
      return fs.readFileSync(path.join(root, name), "utf8");
    } },
    pages(query) {
      output.sources.push(query);
      let selected = [...inputPages];
      return {
        where(predicate) {
          selected = selected.filter(predicate);
          return this;
        },
        [Symbol.iterator]() { return selected[Symbol.iterator](); },
      };
    },
    compare(a, b) {
      return String(a?.toFormat?.("yyyy-MM-dd") ?? a ?? "")
        .localeCompare(String(b?.toFormat?.("yyyy-MM-dd") ?? b ?? ""));
    },
    table(headers, rows) { output.tables.push({ headers, rows }); },
    paragraph(text) { output.paragraphs.push(text); },
  };
  await new AsyncFunction("dv", "input", source)(dv, input);
  return output;
}

test("Idea table renders nonempty active inventory with safe date formatting", async () => {
  const items = [
    idea("Earlier", { mday: "2026-10-12" }),
    idea("Latest", { mday: "2026-10-27" }),
    idea("Archived", { status: "archived" }),
  ];
  const result = await render({ mode: "active" }, items);
  assert.deepEqual(result.sources, ['"05-Idea"']);
  assert.equal(result.tables.length, 1);
  assert.deepEqual(result.tables[0].headers, ["Idea", "Workspace", "Project", "Status", "最終更新日"]);
  assert.deepEqual(result.tables[0].rows.map(r => r[0].path), ["05-Idea/Latest.md", "05-Idea/Earlier.md"]);
  assert.deepEqual(result.tables[0].rows.map(r => r[4]), ["2026-10-27", "2026-10-12"]);
  assert.deepEqual(result.paragraphs, []);
});

test("Idea table preserves workspace and project filtering and recent limit", async () => {
  const items = [
    idea("Mismatch", { workspace: "[[03-Workspace/Personal]]", mday: "2026-10-31" }),
    idea("Unscoped-Project", { project: null, mday: "2026-10-30" }),
    idea("Older", { project: "[[10-Project/Alpha|Alpha]]", mday: "2026-10-24" }),
    idea("Recent", { project: "[[10-Project/Alpha|Alpha]]", mday: "2026-10-27" }),
  ];
  const result = await render({
    mode: "active",
    workspace: "03-Workspace/Research.md",
    project: "10-Project/Alpha.md",
    limit: 1,
  }, items);
  assert.equal(result.tables.length, 1);
  assert.deepEqual(result.tables[0].rows.map(r => r[0].path), ["05-Idea/Recent.md"]);
});

test("Idea table handles blank modified date and empty adopted inventory", async () => {
  const result = await render({ mode: "active" }, [idea("MissingDate", { mday: null })]);
  assert.equal(result.tables[0].rows[0][4], "—");
  const empty = await render({ mode: "adopted", emptyMessage: "empty" }, [idea("Open")]);
  assert.equal(empty.tables.length, 0);
  assert.deepEqual(empty.paragraphs, ["empty"]);
});
