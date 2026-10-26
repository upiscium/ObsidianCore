import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const remove = require(path.join(root, "98-System/01-script/delete_entity.js"));

function fixture(type, { answer, invalidPath = false, withNested = true, onPrompt, failTrash = false } = {}) {
  const name = type === "project" ? "ExampleProject" : "ExampleWorkspace";
  const prefix = type === "project" ? "10-Project" : "03-Workspace";
  const folderPath = prefix + "/" + name;
  const entryPath = invalidPath ? prefix + "/Other.md" : folderPath + "/" + name + ".md";
  const parent = { path: prefix, children: [] };
  const folder = { path: folderPath, children: [], parent };
  parent.children.push(folder);
  const file = { path: entryPath, basename: name, extension: "md", parent: folder, stat: { mtime: 100, size: 300 } };
  const note = { path: folderPath + "/Note.md", basename: "Note", extension: "md", parent: folder, stat: { mtime: 100, size: 10 } };
  folder.children.push(file, note);
  const inner = { path: folderPath + "/Documents", parent: folder, children: [] };
  const innerFile = { path: inner.path + "/nested.md", basename: "nested", extension: "md", parent: inner, stat: { mtime: 100, size: 25 } };
  inner.children.push(innerFile);
  if (withNested) folder.children.push(inner);

  const external = { path: "02-Task/Keep.md", extension: "md" };
  const externalProject = { path: "10-Project/Linked/Linked.md", extension: "md" };
  const notices = [];
  const trashed = [];
  const map = new Map([[prefix, parent], [folderPath, folder], [entryPath, file]]);
  let frontmatterType = type;
  let active = file;
  const runtime = {
    workspace: { getActiveFile: () => active },
    vault: {
      getAbstractFileByPath: p => map.get(p) ?? null,
      trash: async (target, system) => {
        if (failTrash) throw Error("simulated trash failure");
        trashed.push({ target, system });
      }
    },
    metadataCache: { getFileCache: () => ({ frontmatter: { type: frontmatterType } }) }
  };
  class Notice { constructor(message) { notices.push(String(message)); } }

  const tp = {
    system: {
      prompt: async (message) => {
        assert.match(message, /フォルダ全体/);
        assert.match(message, /Entry・Note/);
        assert.match(message, /別フォルダ/);
        assert.ok(message.includes(folderPath));
        assert.match(message, /3ファイル・1サブフォルダ|2ファイル・0サブフォルダ/);
        if (onPrompt) await onPrompt({ file, note, inner, innerFile, folder, parent, map, setActive: f => { active = f; }, setType: t => { frontmatterType = t; } });
        return answer;
      }
    }
  };
  return {
    tp, app: runtime, Notice, file, folder, note, inner, innerFile, external, externalProject,
    notices, trashed, folderPath
  };
}

for (const type of ["project", "workspace"]) {
  const name = type === "project" ? "ExampleProject" : "ExampleWorkspace";
  const token = "DELETE " + name;

  test(type + ": confirmation moves the whole recursive folder to local trash", async () => {
    const f = fixture(type, { answer: token });
    const result = await remove(f.tp, f);
    assert.deepEqual(result, { ok: true, path: f.folderPath, files: 3, subfolders: 1 });
    assert.deepEqual(f.trashed, [{ target: f.folder, system: false }]);
    assert.ok(f.folder.children.includes(f.file));
    assert.ok(f.folder.children.includes(f.note));
    assert.ok(f.folder.children.includes(f.inner));
    assert.ok(f.inner.children.includes(f.innerFile));
    assert.notEqual(f.trashed[0].target, f.external);
    assert.notEqual(f.trashed[0].target, f.externalProject);
    assert.match(f.notices.at(-1), /フォルダ全体をゴミ箱/);
  });

  test(type + ": no-subfolder case and wrong/cancelled confirmations", async () => {
    const f = fixture(type, { answer: token, withNested: false });
    assert.equal((await remove(f.tp, f)).ok, true);
    assert.deepEqual(f.trashed, [{ target: f.folder, system: false }]);
    for (const answer of [null, "", "DELETE Wrong", name]) {
      const cancelled = fixture(type, { answer });
      assert.equal((await remove(cancelled.tp, cancelled)).reason, "cancelled");
      assert.equal(cancelled.trashed.length, 0);
    }
  });

  test(type + ": rejects a noncanonical entry before prompting", async () => {
    const f = fixture(type, { answer: token, invalidPath: true });
    assert.equal((await remove(f.tp, f)).reason, "noncanonical-path");
    assert.equal(f.trashed.length, 0);
  });

  test(type + ": rejects added nested files during confirmation", async () => {
    const f = fixture(type, { answer: token, onPrompt: ({ inner }) => {
      inner.children.push({ path: inner.path + "/new.md", parent: inner, extension: "md" });
    } });
    assert.equal((await remove(f.tp, f)).reason, "changed-since-confirmation");
    assert.equal(f.trashed.length, 0);
  });

  test(type + ": rejects modified nested file timestamps", async () => {
    const f = fixture(type, { answer: token, onPrompt: ({ innerFile }) => { innerFile.stat.mtime += 1; } });
    assert.equal((await remove(f.tp, f)).reason, "changed-since-confirmation");
    assert.equal(f.trashed.length, 0);
  });

  test(type + ": rejects a changed active file, folder binding or metadata", async () => {
    const changes = [
      ({ file, setActive }) => setActive({ path: file.path, extension: "md" }),
      ({ folder, map }) => map.set(folder.path, { path: folder.path, children: [] }),
      ({ setType }) => setType("note")
    ];
    for (const onPrompt of changes) {
      const f = fixture(type, { answer: token, onPrompt });
      assert.equal((await remove(f.tp, f)).reason, "changed-since-confirmation");
      assert.equal(f.trashed.length, 0);
    }
  });

  test(type + ": refuses a descendant outside the canonical path", async () => {
    const f = fixture(type, { answer: token });
    f.innerFile.path = "99-Outside/oops.md";
    assert.equal((await remove(f.tp, f)).reason, "invalid-subtree");
    assert.equal(f.trashed.length, 0);
  });

  test(type + ": ambiguous trash failure is not reported as success", async () => {
    const f = fixture(type, { answer: token, failTrash: true });
    assert.equal((await remove(f.tp, f)).reason, "trash-failed");
    assert.equal(f.trashed.length, 0);
    assert.match(f.notices.at(-1), /結果を確認できません/);
  });
}

test("Project and Workspace System Zones wire to the canonical folder-trash script", () => {
  const command = fs.readFileSync("98-System/00-command/delete_entity.md", "utf8");
  assert.match(command, /tp\.user\.delete_entity\(tp\)/);
  for (const type of ["project", "workspace"]) {
    const buttons = fs.readFileSync("98-System/02-embed/01-button/" + type + "-system-buttons.md", "utf8");
    assert.match(buttons, new RegExp("id: delete-" + type));
    assert.match(buttons, /templateFile: "98-System\/00-command\/delete_entity.md"/);
    assert.match(buttons, /style: destructive/);
  }
  const code = fs.readFileSync("98-System/01-script/delete_entity.js", "utf8");
  assert.match(code, /vault\.trash\(folder, false\)/);
  assert.doesNotMatch(code, /vault\.trash\(file,/);
  assert.doesNotMatch(code, /permanentDelete|vault\.delete\(/);
});
