import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const system = "98-System";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

test("QuickTask is retired from shipped scripts and public interfaces", () => {
  const retiredPath = "98-System/01-script/quick_task.js";
  assert.equal(fs.existsSync(path.join(root, retiredPath)), false);
  const interfaces = readJson("98-System/99-dev/setup/system-interfaces.json");
  for (const group of interfaces.groups) {
    assert.ok(!group.paths.includes(retiredPath), "stale interface in " + group.consumer);
  }
});

test("QuickAdd retains distinct Task Create and Backlog flows", () => {
  const manifest = readJson("98-System/99-dev/setup/automation-manifest.json");
  const choices = manifest.quickadd.required_choices;
  assert.deepEqual(choices.map(entry => entry.name), [
    "Task: New",
    "Work: Add",
    "Work: Manage",
    "System: Validate Vault"
  ]);
  assert.equal(choices[0].script, "98-System/01-script/create_task_unified.js");
  assert.deepEqual(manifest.quickadd.compatibility_choices, [
    { name: "Task: Create", script: "98-System/01-script/create_task.js" },
    { name: "Task: Backlog", script: "98-System/01-script/backlog_task.js" }
  ]);
  const setup = fs.readFileSync(path.join(root, system, "99-dev/setup/README.md"), "utf8");
  assert.doesNotMatch(setup, /^- `Task: Quick` ->/m);
  assert.match(setup, /manual, per-device/);
});
