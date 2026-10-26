import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const remove = require(path.join(root, "98-System/01-script/delete_entity.js"));

function fixture(type, { answer, changed = false, invalidPath = false, child = true } = {}) {
  const name = type === "project" ? "ExampleProject" : "ExampleWorkspace";
  const prefix = type === "project" ? "10-Project" : "03-Workspace";
  const folderPath = `${prefix}/${name}`;
  const entryPath = invalidPath ? `${prefix}/Other.md` : `${folderPath}/${name}.md`;
  const file = { path: entryPath, basename: name, extension: "md" };
  const other = { path: `${folderPath}/Note.md`, basename: "Note", extension: "md" };
  const folder = { path: folderPath, children: child ? [file, other] : [file] };
  const trashed = [];
  const notices = [];
  const app = {
    workspace: { getActiveFile: () => file },
    vault: {
      getAbstractFileByPath: target =>
        target === folderPath ? folder : target === entryPath ? (changed ? null : file) : null,
      trash: async (target, system) => trashed.push({ target, system })
    },
    metadataCache: { getFileCache: () => ({ frontmatter: { type } }) }
  };
  class Notice { constructor(value) { notices.push(String(value)); } }
  const tp = { system: { prompt: async message => {
    assert.match(message, /Entryファイルのみ/);
    assert.match(message, /紐付く/);
    return answer;
  } } };
  return { tp, app, Notice, file, other, trashed, notices };
}

for (const type of ["project", "workspace"]) {
  test(`safe ${type} delete trashes only its canonical entry after typed confirmation`, async () => {
    const f = fixture(type, { answer: `DELETE ${type === "project" ? "ExampleProject" : "ExampleWorkspace"}` });
    const result = await remove(f.tp, f);
    assert.equal(result.ok, true);
    assert.deepEqual(f.trashed, [{ target: f.file, system: false }]);
    assert.notEqual(f.trashed[0].target, f.other);
    assert.match(f.notices.at(-1), /ゴミ箱/);
  });

  test(`${type} delete rejects a wrong confirmation or cancel`, async () => {
    for (const answer of [null, "", "DELETE wrong"]) {
      const f = fixture(type, { answer });
      assert.deepEqual((await remove(f.tp, f)).reason, "cancelled");
      assert.equal(f.trashed.length, 0);
    }
  });

  test(`${type} delete rejects noncanonical path and concurrent changes`, async () => {
    const token = `DELETE ${type === "project" ? "ExampleProject" : "ExampleWorkspace"}`;
    const bad = fixture(type, { answer: token, invalidPath: true });
    assert.equal((await remove(bad.tp, bad)).reason, "noncanonical-path");
    const changed = fixture(type, { answer: token, changed: true });
    assert.equal((await remove(changed.tp, changed)).reason, "changed-since-confirmation");
    assert.equal(bad.trashed.length + changed.trashed.length, 0);
  });
}

test("Project and Workspace system zones expose only typed-confirmation delete commands", () => {
  const command = fs.readFileSync("98-System/00-command/delete_entity.md", "utf8");
  assert.match(command, /tp\.user\.delete_entity\(tp\)/);
  for (const type of ["project", "workspace"]) {
    const buttons = fs.readFileSync(`98-System/02-embed/01-button/${type}-system-buttons.md`, "utf8");
    assert.match(buttons, new RegExp(`id: delete-${type}`));
    assert.match(buttons, /templateFile: "98-System\/00-command\/delete_entity.md"/);
    assert.match(buttons, /style: destructive/);
  }
  const runtime = fs.readFileSync("98-System/01-script/delete_entity.js", "utf8");
  assert.doesNotMatch(runtime, /deleteFile|permanentDelete/);
  assert.match(runtime, /vault\.trash\(file, false\)/);
});
