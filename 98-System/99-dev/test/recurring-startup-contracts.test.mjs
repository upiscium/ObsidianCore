import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const manifestPath = path.join(root, "98-System/99-dev/setup/automation-manifest.json");
const readmePath = path.join(root, "98-System/99-dev/setup/README.md");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const startupTemplatePath = "98-System/03-template/99-startup/generate-recurring-tasks.md";
const periodicStartupTemplatePath = "98-System/03-template/99-startup/create_periodic_note.md";

test("automation manifest requires both Templater startup registrations", () => {
  assert.equal(manifest.templater?.startup_configuration?.enable_startup_templates, true);
  assert.equal(manifest.templater?.startup_configuration?.registration, "plugin-local-manual-once-per-vault");

  const entries = manifest.templater?.startup_templates ?? [];
  const recurring = entries.find(item => item?.template === startupTemplatePath);
  const periodic = entries.find(item => item?.template === periodicStartupTemplatePath);

  assert.ok(recurring, "Recurring startup template must be declared in the automation manifest");
  assert.ok(periodic, "Periodic-note startup template must be declared in the automation manifest");
  assert.equal(recurring.required, true);
  assert.equal(periodic.required, true);
  assert.ok(fs.existsSync(path.join(root, startupTemplatePath)));
  assert.ok(fs.existsSync(path.join(root, periodicStartupTemplatePath)));
});

test("style distribution contract preserves config sync while providing normal-Vault fallback for both styles", () => {
  const distribution = manifest.style_distribution;
  assert.equal(distribution?.source, "98-System/90-config/styles/obsidian-core.css");
  assert.equal(distribution?.target, "<vault.configDir>/snippets/obsidian-core.css");
  assert.equal(distribution?.responsive_source, "98-System/90-config/styles/obsidian-core-mobile.css");
  assert.equal(distribution?.responsive_target, "<vault.configDir>/snippets/obsidian-core-mobile.css");
  assert.equal(distribution?.installer_script, "98-System/01-script/sync_core_style.js");
  assert.equal(distribution?.activation, "startup-managed-canonical-with-shared-config");
  assert.equal(distribution?.appearance_target, "<vault.configDir>/appearance.json");
  assert.deepEqual(distribution?.canonical_snippets, ["obsidian-core", "obsidian-core-mobile"]);
  assert.equal(distribution?.legacy_managed_snippets?.length, 8);
  assert.equal(distribution?.unrelated_snippets, "preserve");
  assert.equal(distribution?.config_sync_role, "optional-redundant-path");
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
  assert.match(startup, /runtimeActivation/);
  assert.match(startup, /reload_required/);
  assert.match(startup, /再読み込み/);
  assert.match(startup, /Dashboard/);
});

test("periodic-note startup template idempotently owns Daily and Monthly creation", () => {
  const startup = fs.readFileSync(path.join(root, periodicStartupTemplatePath), "utf8");
  assert.ok(startup.includes("00-DailyNote/"));
  assert.ok(startup.includes("01-MonthlyNote/"));
  assert.ok(startup.includes("daily-note-template.md"));
  assert.ok(startup.includes("monthly-note-template.md"));
  assert.match(startup, /if \(existing\)/);
  assert.match(startup, /return false/);
  assert.match(startup, /tp\.file\.create_new/);
});

test("setup documentation keeps shared config valid and documents both startup templates", () => {
  const readme = fs.readFileSync(readmePath, "utf8");
  assert.match(readme, /Enable startup templates/);
  assert.ok(readme.includes(startupTemplatePath));
  assert.ok(readme.includes(periodicStartupTemplatePath));
  assert.match(readme, /one-time local registration/i);
  assert.match(readme, /98-System\/90-config\/styles\/obsidian-core\.css/);
  assert.match(readme, /obsidian-core-mobile\.css/);
  assert.match(readme, /configDir/);
  assert.match(readme, /config directory synchronization/i);
  assert.match(readme, /keep it enabled/i);
  assert.match(readme, /CSS snippets/);
  assert.match(readme, /enabledCssSnippets/);
  assert.match(readme, /unrelated private\/local snippets/i);
  assert.match(readme, /private.*runtime.*API/i);
  assert.match(readme, /Recurring Task生成/);
  assert.match(readme, /Daily \/ Monthly Note creation/);
  assert.match(readme, /manual fallback/i);
});
