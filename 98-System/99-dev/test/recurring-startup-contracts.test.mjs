import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const manifestPath = path.join(root, "98-System/99-dev/setup/automation-manifest.json");
const readmePath = path.join(root, "98-System/99-dev/setup/README.md");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const startupTemplatePath = "98-System/03-template/99-startup/generate-recurring-tasks.md";

test("automation manifest requires recurring Task startup generation", () => {
  assert.equal(manifest.templater?.startup_configuration?.enable_startup_templates, true);
  assert.equal(manifest.templater?.startup_configuration?.registration, "plugin-local-manual-once-per-vault");

  const entry = (manifest.templater?.startup_templates ?? [])
    .find(item => item?.template === startupTemplatePath);
  assert.ok(entry, "Recurring Task startup template must be declared in the automation manifest");
  assert.equal(entry.required, true);
  assert.ok(fs.existsSync(path.join(root, startupTemplatePath)));
});

test("startup template executes the idempotent recurring generator", () => {
  const startup = fs.readFileSync(path.join(root, startupTemplatePath), "utf8");
  assert.match(startup, /tp\.user\.generate_recurring_tasks\(tp\)/);
  assert.match(startup, /try\s*\{/);
  assert.match(startup, /catch\s*\(error\)/);
  assert.match(startup, /Dashboard/);
});

test("setup documentation includes one-time Templater registration and manual fallback", () => {
  const readme = fs.readFileSync(readmePath, "utf8");
  assert.match(readme, /Enable startup templates/);
  assert.match(readme, new RegExp(startupTemplatePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /one-time local registration/i);
  assert.match(readme, /Recurring Task生成/);
  assert.match(readme, /manual fallback/i);
});
