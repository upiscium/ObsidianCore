import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("98-System/99-dev/setup/automation-manifest.json"));
const readme = read("98-System/99-dev/setup/README.md");
const prefix = "98-System/03-template/99-startup/";
const desktop = prefix + "startup-desktop.md";
const mobile = prefix + "startup-mobile.md";
const oldPeriodic = prefix + "create_periodic_note.md";
const oldRecurring = prefix + "generate-recurring-tasks.md";

function startupSource(file) {
  const source = read(file);
  assert.match(source, /^<%\*\n/);
  assert.match(source, /-%>\s*$/);
  return source.slice(4).replace(/-%>\s*$/, "");
}

test("manifest separates desktop/mobile Startup registrations and chooses exactly one writer", () => {
  const config = manifest.templater?.startup_configuration;
  assert.equal(config.enable_startup_templates, true);
  assert.equal(config.registration, "manual-once-per-device-profile");
  assert.equal(config.subscription_writer_profile, "mobile");
  assert.deepEqual(config.profiles?.desktop, {
    config_folder: ".obsidian", templates: [desktop], subscription_writer: false,
  });
  assert.deepEqual(config.profiles?.mobile, {
    config_folder: ".obsidian-mobile", templates: [mobile], subscription_writer: true,
  });
  assert.equal(config.profiles.desktop.subscription_writer +
               config.profiles.mobile.subscription_writer, 1);
  const entries = manifest.templater.startup_templates;
  for (const [template, profile, required] of [
    [desktop, "desktop", true], [mobile, "mobile", true],
    [oldPeriodic, "legacy", false], [oldRecurring, "legacy", false],
  ]) {
    const match = entries.find(item => item.template === template);
    assert.ok(match);
    assert.equal(match.profile, profile);
    assert.equal(match.required, required);
    assert.ok(fs.existsSync(path.join(root, template)));
  }
});

test("device-guarded entrypoints do not invoke the opposite device's startup jobs", async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  async function invoke(file, isMobile) {
    const calls = [];
    const tp = {
      obsidian: { Platform: { isMobile } },
      user: {
        async sync_core_style() { calls.push("CSS"); return { status: "unchanged" }; },
        async create_periodic_note() { calls.push("periodic"); return { ok: true }; },
        async generate_recurring_tasks() { calls.push("recurring"); return {}; },
        async sync_subscriptions(_tp, month, opts) {
          assert.equal(month, null);
          assert.deepEqual(opts, { automatic: true, silent: true });
          calls.push("subscription");
          return { ok: true, added: 1 };
        },
      },
    };
    const Notices = [];
    class Notice { constructor(message) { Notices.push(message); } }
    await new AsyncFunction("tp", "Notice", "console", startupSource(file))(tp, Notice, console);
    return { calls, Notices };
  }

  assert.deepEqual((await invoke(desktop, false)).calls, ["CSS", "periodic", "recurring"]);
  assert.deepEqual((await invoke(mobile, true)).calls, ["CSS", "periodic", "subscription"]);
  assert.deepEqual((await invoke(desktop, true)).calls, []);
  assert.deepEqual((await invoke(mobile, false)).calls, []);
});

test("periodic note creation keeps legacy public startup wrapper and reusable user script", () => {
  assert.equal(read(oldPeriodic), "<%* await tp.user.create_periodic_note(tp); %>\n");
  const userScript = read("98-System/01-script/create_periodic_note.js");
  assert.match(userScript, /module\.exports = async function createPeriodicNote\(tp\)/);
  assert.match(userScript, /00-DailyNote\//);
  assert.match(userScript, /01-MonthlyNote\//);
  assert.match(userScript, /daily-note-template\.md/);
  assert.match(userScript, /monthly-note-template\.md/);
  assert.match(userScript, /if \(existing\)/);
  assert.match(userScript, /return false/);
  assert.match(userScript, /tp\.file\.create_new/);
});

test("legacy Recurring startup still synchronizes CSS before Recurring generation", () => {
  const startup = read(oldRecurring);
  const styleCall = startup.indexOf("tp.user.sync_core_style(tp)");
  const recurringCall = startup.indexOf("tp.user.generate_recurring_tasks(tp)");
  assert.ok(styleCall >= 0);
  assert.ok(recurringCall > styleCall);
  assert.equal((startup.match(/try\s*\{/g) ?? []).length, 2);
  assert.equal((startup.match(/catch\s*\(error\)/g) ?? []).length, 2);
});

test("style distribution keeps device-local config targets and canonical style sources", () => {
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

test("setup explains separate Obsidian config profiles and human local registration", () => {
  assert.match(readme, /Enable startup templates/);
  assert.ok(readme.includes(desktop));
  assert.ok(readme.includes(mobile));
  assert.match(readme, /one-time local registration/i);
  assert.match(readme, /Override config folder/);
  assert.match(readme, /\.obsidian-mobile/);
  assert.match(readme, /single.writer/i);
  assert.match(readme, /98-System\/90-config\/styles\/obsidian-core\.css/);
  assert.match(readme, /obsidian-core-mobile\.css/);
  assert.match(readme, /configDir/);
  assert.match(readme, /config directory synchronization/i);
  assert.match(readme, /CSS snippets/);
  assert.match(readme, /enabledCssSnippets/);
  assert.match(readme, /unrelated private\/local snippets/i);
  assert.match(readme, /private.*runtime.*API/i);
  assert.match(readme, /Recurring Task生成/);
  assert.match(readme, /Daily \/ Monthly Note creation/);
  assert.match(readme, /manual fallback/i);
});


test("periodic shared user script creates missing notes once and leaves existing notes intact", async () => {
  const source = read("98-System/01-script/create_periodic_note.js");
  const module = { exports: {} };
  new Function("module", "exports", source)(module, module.exports);
  class TFile { constructor(p) { this.path = p; this.extension = "md"; } }
  class TFolder { constructor(p) { this.path = p; } }
  const files = new Map([
    ["98-System/03-template/01-note/daily-note-template.md", new TFile("98-System/03-template/01-note/daily-note-template.md")],
    ["98-System/03-template/01-note/monthly-note-template.md", new TFile("98-System/03-template/01-note/monthly-note-template.md")],
  ]);
  const created = [];
  const app = {
    vault: {
      getAbstractFileByPath(p) { return files.get(p) ?? null; },
      async createFolder(p) { const folder = new TFolder(p); files.set(p, folder); return folder; },
    },
  };
  const tp = {
    app,
    obsidian: { TFile, TFolder, Notice: class Notice { constructor() {} } },
    file: {
      async create_new(template, title, open, folder) {
        assert.ok(template instanceof TFile);
        assert.equal(open, false);
        const name = folder.path + "/" + title + ".md";
        assert.equal(files.has(name), false);
        const file = new TFile(name);
        files.set(name, file);
        created.push(name);
      },
    },
  };
  const originalWindow = globalThis.window;
  globalThis.window = {
    moment() {
      return { format(mask) {
        return {
          YYYY: "2026",
          MM: "10",
          "YYYY-MM-DD": "2026-10-11",
        }[mask];
      } };
    },
  };
  try {
    const first = await module.exports(tp);
    assert.equal(first.ok, true);
    assert.equal(first.createdDaily, true);
    assert.equal(first.createdMonthly, true);
    assert.deepEqual(created, [
      "00-DailyNote/2026/10/2026-10-11.md",
      "01-MonthlyNote/2026/2026-10.md",
    ]);
    const second = await module.exports(tp);
    assert.equal(second.ok, true);
    assert.equal(second.createdDaily, false);
    assert.equal(second.createdMonthly, false);
    assert.equal(created.length, 2);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
