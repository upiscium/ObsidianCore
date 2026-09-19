import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath =>
  new Function(`"use strict"; return (${read(relativePath)});`)();

function commonJs(relativePath) {
  const module = { exports: {} };
  new Function("module", "exports", read(relativePath))(module, module.exports);
  return module.exports;
}

const U = expression("98-System/05-lib/finance/subscription_runtime_utils.js");

test("Subscription runtime utility owns canonical paths and normalization", () => {
  assert.deepEqual(U.CONFIG, {
    registryFolder: "96-Global/00-subscription",
    monthlyFolder: "01-MonthlyNote",
    expenseHeading: "# 今月の支出",
    defaultCategory: "サブスク",
  });

  assert.equal(U.normalizeYearMonth("2026-9"), "2026-09");
  assert.equal(U.normalizeYearMonth("2026-09"), "2026-09");
  assert.equal(U.normalizeYearMonth("2026-13"), null);
  assert.equal(U.normalizeAmount("1,234"), 1234);
  assert.equal(U.normalizeAmount("-1"), null);
  assert.equal(U.normalizeBoolean("true"), true);
  assert.equal(U.normalizeBoolean(false), false);
  assert.equal(U.validSubscriptionId("sub_abc-123"), true);
  assert.equal(U.validSubscriptionId("bad id"), false);
  assert.equal(U.validSubscriptionId("bad@id"), false);
});

test("Subscription validation covers monthly, yearly and interval cycles", () => {
  const base = {
    subscription_id: "sub_example",
    name: "Example",
    enabled: true,
    amount: 1200,
    category: "サブスク",
    cycle: "monthly",
    start: "2026-09",
  };

  assert.deepEqual(U.validateSubscription(base), []);

  const yearly = { ...base, cycle: "yearly", payment_month: 9 };
  assert.deepEqual(U.validateSubscription(yearly), []);
  assert.match(U.validateSubscription({ ...yearly, payment_month: null }).join("\n"), /payment_month/);

  const interval = { ...base, cycle: "interval", interval_months: 3 };
  assert.deepEqual(U.validateSubscription(interval), []);
  assert.match(U.validateSubscription({ ...interval, interval_months: 0 }).join("\n"), /interval_months/);

  assert.match(U.validateSubscription({ ...base, subscription_id: "bad id" }).join("\n"), /subscription_id/);
  assert.match(U.validateSubscription({ ...base, amount: -1 }).join("\n"), /amount/);
  assert.match(U.validateSubscription({ ...base, start: "invalid" }).join("\n"), /start/);
});

test("Subscription due calculation preserves cycle semantics", () => {
  const base = {
    subscription_id: "sub_example",
    name: "Example",
    enabled: true,
    amount: 1200,
    category: "サブスク",
    start: "2026-09",
  };

  assert.equal(U.isDueInMonth({ ...base, cycle: "monthly" }, "2026-09"), true);
  assert.equal(U.isDueInMonth({ ...base, cycle: "monthly" }, "2026-08"), false);
  assert.equal(U.isDueInMonth({ ...base, enabled: false, cycle: "monthly" }, "2026-09"), false);

  assert.equal(U.isDueInMonth({ ...base, cycle: "yearly", payment_month: 9 }, "2027-09"), true);
  assert.equal(U.isDueInMonth({ ...base, cycle: "yearly", payment_month: 9 }, "2027-10"), false);

  assert.equal(U.isDueInMonth({ ...base, cycle: "interval", interval_months: 3 }, "2026-09"), true);
  assert.equal(U.isDueInMonth({ ...base, cycle: "interval", interval_months: 3 }, "2026-12"), true);
  assert.equal(U.isDueInMonth({ ...base, cycle: "interval", interval_months: 3 }, "2026-11"), false);
});

test("Subscription content builder emits canonical editable note", () => {
  const content = U.buildSubscriptionContent({
    subscription_id: "sub_example",
    name: "Example Service",
    enabled: true,
    amount: 980,
    category: "クラウド",
    cycle: "yearly",
    start: "2026-09",
    payment_month: 9,
  });

  assert.match(content, /^type: subscription$/m);
  assert.match(content, /^subscription_id: "sub_example"$/m);
  assert.match(content, /^name: "Example Service"$/m);
  assert.match(content, /^enabled: true$/m);
  assert.match(content, /^amount: 980$/m);
  assert.match(content, /^category: "クラウド"$/m);
  assert.match(content, /^cycle: yearly$/m);
  assert.match(content, /^start: "2026-09"$/m);
  assert.match(content, /^payment_month: 9$/m);
  assert.match(content, /^interval_months: $/m);
  assert.match(content, /\[\[subscription-meta\]\]/);
  assert.equal(U.subscriptionKey({ subscription_id: "sub_example" }, "2026-09"), "sub_example@2026-09");
});

test("canonical Subscription create writes an editable registry note", async () => {
  const createSubscription = commonJs("98-System/01-script/create_subscription.js");
  const utilityFile = {
    path: "98-System/05-lib/finance/subscription_runtime_utils.js",
    extension: "js",
    basename: "subscription_runtime_utils",
  };

  const folders = new Set();
  const created = new Map();
  const promptValues = ["Example Service", "980", "クラウド", "2026-09"];

  const app = {
    vault: {
      getAbstractFileByPath(filePath) {
        if (filePath === utilityFile.path) return utilityFile;
        if (folders.has(filePath)) return { path: filePath, type: "folder" };
        return created.get(filePath) ?? null;
      },
      async read(file) {
        if (file.path === utilityFile.path) return read(utilityFile.path);
        throw new Error(`unexpected read: ${file.path}`);
      },
      async createFolder(folderPath) {
        folders.add(folderPath);
        return { path: folderPath, type: "folder" };
      },
      async create(filePath, content) {
        const file = {
          path: filePath,
          extension: "md",
          basename: path.basename(filePath, ".md"),
          content,
        };
        created.set(filePath, file);
        return file;
      },
    },
    workspace: {
      getLeaf() {
        return { openFile: async () => {} };
      },
    },
  };

  const tp = {
    app,
    system: {
      async prompt() {
        return promptValues.shift();
      },
      async suggester(_labels, values) {
        return values[0];
      },
    },
  };

  const oldNotice = globalThis.Notice;
  globalThis.Notice = class Notice { constructor() {} };

  try {
    const result = await createSubscription(tp);
    assert.equal(result.ok, true);
    assert.match(result.path, /^96-Global\/00-subscription\/Example Service\.md$/);
    assert.match(result.subscriptionId, /^sub_/);

    const file = created.get(result.path);
    assert.ok(file);
    assert.match(file.content, /^type: subscription$/m);
    assert.match(file.content, /^subscription_id: "sub_[^"]+"$/m);
    assert.match(file.content, /^name: "Example Service"$/m);
    assert.match(file.content, /^enabled: true$/m);
    assert.match(file.content, /^amount: 980$/m);
    assert.match(file.content, /^category: "クラウド"$/m);
    assert.match(file.content, /^cycle: monthly$/m);
    assert.match(file.content, /^start: "2026-09"$/m);
    assert.match(file.content, /\[\[subscription-meta\]\]/);
  } finally {
    if (oldNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = oldNotice;
  }
});

test("canonical Subscription sync is idempotent against note registry", async () => {
  const sync = commonJs("98-System/01-script/sync_subscriptions.js");
  const utilityFile = {
    path: "98-System/05-lib/finance/subscription_runtime_utils.js",
    extension: "js",
    basename: "subscription_runtime_utils",
  };
  const monthlyFile = {
    path: "01-MonthlyNote/2026/2026-09.md",
    extension: "md",
    basename: "2026-09",
  };
  const subscriptionFile = {
    path: "96-Global/00-subscription/Example.md",
    extension: "md",
    basename: "Example",
  };

  let monthlyContent = [
    "# 2026-09",
    "",
    "# 今月の支出",
    "",
    "# 次",
    "",
  ].join("\n");

  const app = {
    vault: {
      getAbstractFileByPath(filePath) {
        if (filePath === utilityFile.path) return utilityFile;
        if (filePath === monthlyFile.path) return monthlyFile;
        return null;
      },
      getFileByPath(filePath) {
        return filePath === monthlyFile.path ? monthlyFile : null;
      },
      async read(file) {
        if (file.path === utilityFile.path) return read(utilityFile.path);
        throw new Error(`unexpected read: ${file.path}`);
      },
      getMarkdownFiles() {
        return [subscriptionFile];
      },
      async process(file, transform) {
        assert.equal(file.path, monthlyFile.path);
        monthlyContent = transform(monthlyContent);
      },
    },
    metadataCache: {
      getFileCache(file) {
        if (file.path !== subscriptionFile.path) return {};
        return {
          frontmatter: {
            type: "subscription",
            subscription_id: "sub_example",
            name: "Example",
            enabled: true,
            amount: 1200,
            category: "サブスク",
            cycle: "monthly",
            start: "2026-09",
          },
        };
      },
    },
    workspace: {
      getActiveFile() {
        return null;
      },
    },
  };

  const tp = { app, file: { title: "" } };
  const oldNotice = globalThis.Notice;
  globalThis.Notice = class Notice { constructor() {} };

  try {
    const first = await sync(tp, "2026-09", { silent: true });
    assert.deepEqual(
      { ok: first.ok, added: first.added, targetMonth: first.targetMonth },
      { ok: true, added: 1, targetMonth: "2026-09" },
    );
    assert.match(monthlyContent, /\[subscription_key:: sub_example@2026-09\]/);

    const second = await sync(tp, "2026-09", { silent: true });
    assert.equal(second.ok, true);
    assert.equal(second.added, 0);
    assert.equal(
      (monthlyContent.match(/\[subscription_key:: sub_example@2026-09\]/g) ?? []).length,
      1,
    );
  } finally {
    if (oldNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = oldNotice;
  }
});

test("Subscription commands are thin canonical Templater entrypoints", () => {
  assert.equal(
    read("98-System/00-command/create_subscription.md"),
    "<%* await tp.user.create_subscription(tp); %>\n",
  );
  assert.equal(
    read("98-System/00-command/sync_subscriptions.md"),
    "<%* await tp.user.sync_subscriptions(tp); %>\n",
  );

  const create = read("98-System/01-script/create_subscription.js");
  const sync = read("98-System/01-script/sync_subscriptions.js");
  assert.match(create, /subscription_runtime_utils\.js/);
  assert.match(sync, /subscription_runtime_utils\.js/);
  assert.match(create, /U\.CONFIG\.registryFolder/);
  assert.match(sync, /U\.CONFIG\.registryFolder/);
});
