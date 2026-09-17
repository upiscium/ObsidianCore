import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const manifestPath = path.join(root, "98-System/99-dev/setup/automation-manifest.json");
const readmePath = path.join(root, "98-System/99-dev/setup/README.md");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const startupTemplatePath = "98-System/03-template/99-startup/generate-recurring-tasks.md";

test("automation manifest requires the existing Templater startup registration", () => {
  assert.equal(manifest.templater?.startup_configuration?.enable_startup_templates, true);
  assert.equal(manifest.templater?.startup_configuration?.registration, "plugin-local-manual-once-per-vault");

  const entry = (manifest.templater?.startup_templates ?? [])
    .find(item => item?.template === startupTemplatePath);
  assert.ok(entry, "Required startup template must be declared in the automation manifest");
  assert.equal(entry.required, true);
  assert.ok(fs.existsSync(path.join(root, startupTemplatePath)));
});

test("style distribution contract uses normal Vault sync plus configDir-local installation", () => {
  const distribution = manifest.style_distribution;
  assert.equal(distribution?.source, "98-System/90-config/styles/obsidian-core.css");
  assert.equal(distribution?.installer_script, "98-System/01-script/sync_core_style.js");
  assert.equal(distribution?.target, "<vault.configDir>/snippets/obsidian-core.css");
  assert.equal(distribution?.activation, "manual-once-per-device");
});

test("startup template synchronizes CSS independently before recurring Task generation", () => {
  const startup = fs.readFileSync(path.join(root, startupTemplatePath), "utf8");
  const styleCall = startup.indexOf("tp.user.sync_core_style(tp)");
  const recurringCall = startup.indexOf("tp.user.generate_recurring_tasks(tp)");
  assert.ok(styleCall >= 0);
  assert.ok(recurringCall > styleCall);
  assert.equal((startup.match(/try\s*\{/g) ?? []).length, 2);
  assert.equal((startup.match(/catch\s*\(error\)/g) ?? []).length, 2);
  assert.match(startup, /Appearance > CSS snippets/);
  assert.match(startup, /Dashboard/);
});

test("setup documentation includes one-time Templater registration, CSS activation, and recurring fallback", () => {
  const readme = fs.readFileSync(readmePath, "utf8");
  assert.match(readme, /Enable startup templates/);
  assert.match(readme, new RegExp(startupTemplatePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /one-time local registration/i);
  assert.match(readme, /98-System\/90-config\/styles\/obsidian-core\.css/);
  assert.match(readme, /configDir/);
  assert.match(readme, /CSS snippets/);
  assert.match(readme, /Recurring Task生成/);
  assert.match(readme, /manual fallback/i);
});
