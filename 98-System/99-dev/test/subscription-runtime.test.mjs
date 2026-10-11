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
  const promptValues = ["Example Service", "980", "クラウド", "2026-09", "1"];

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
        if (file.path === monthlyFile.path) return monthlyContent;
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


test("canonical Subscription sync never references the retired registry", () => {
  const canonical = read("98-System/01-script/sync_subscriptions.js");
  assert.match(canonical, /subscription_runtime_utils\.js/);
  assert.doesNotMatch(canonical, /98-System\/05-data\/subscriptions\.md/);
});


test("USD subscription amounts are explicit and JPY registry notes remain compatible", () => {
  const base = {
    subscription_id: "sub_usd",
    name: "Cloud USD",
    enabled: true,
    amount: 19.99,
    currency: "USD",
    exchange_rate_jpy_per_usd: 155.2,
    category: "クラウド",
    cycle: "monthly",
    start: "2026-10",
  };

  assert.equal(U.normalizeCurrency(undefined), "JPY");
  assert.equal(U.normalizeCurrency("usd"), "USD");
  assert.equal(U.normalizeCurrency(""), "");
  assert.equal(U.normalizeExchangeRate("150.5"), 150.5);
  assert.equal(U.normalizeExchangeRate(""), null);
  assert.equal(U.normalizeAmount(""), null);
  assert.equal(U.normalizeAmount(null), null);

  assert.deepEqual(U.validateSubscription(base), []);
  assert.equal(U.yenExpenseAmount(base), 3103);
  assert.equal(U.yenExpenseAmount({ ...base, amount: 0.01, exchange_rate_jpy_per_usd: 150 }), 2);

  const usdContent = U.buildSubscriptionContent(base);
  assert.match(usdContent, /^amount: 19\.99$/m);
  assert.match(usdContent, /^currency: USD$/m);
  assert.match(usdContent, /^exchange_rate_jpy_per_usd: 155\.2$/m);

  const legacy = { ...base, currency: undefined, amount: 980 };
  assert.deepEqual(U.validateSubscription(legacy), []);
  assert.equal(U.yenExpenseAmount(legacy), 980);
  assert.match(U.buildSubscriptionContent(legacy), /^currency: JPY$/m);

  assert.match(U.validateSubscription({ ...base, currency: "" }).join("\n"), /currency/);
  assert.match(U.validateSubscription({ ...base, currency: "EUR" }).join("\n"), /currency/);
  assert.match(U.validateSubscription({ ...base, exchange_rate_jpy_per_usd: null }).join("\n"), /exchange_rate/);
  assert.match(U.validateSubscription({ ...base, exchange_rate_jpy_per_usd: -1 }).join("\n"), /exchange_rate/);
  assert.match(U.validateSubscription({ ...base, amount: 1.234 }).join("\n"), /小数第2位/);
  assert.match(U.validateSubscription({ ...base, amount: 1e15, exchange_rate_jpy_per_usd: 1e10 }).join("\n"), /円換算額/);
});

test("USD yearly and interval subscriptions retain JPY posting amounts only in due months", () => {
  const base = {
    subscription_id: "sub_usd_periodic",
    name: "USD Periodic",
    enabled: true,
    amount: 19.99,
    currency: "USD",
    exchange_rate_jpy_per_usd: 155.2,
    category: "サブスク",
    start: "2026-10",
  };
  const yearly = { ...base, cycle: "yearly", payment_month: 12 };
  assert.deepEqual(U.validateSubscription(yearly), []);
  assert.equal(U.isDueInMonth(yearly, "2026-10"), false);
  assert.equal(U.isDueInMonth(yearly, "2026-12"), true);
  assert.equal(U.isDueInMonth(yearly, "2027-12"), true);
  assert.equal(U.isDueInMonth(yearly, "2027-11"), false);
  assert.equal(U.yenExpenseAmount(yearly), 3103);

  const interval = { ...base, cycle: "interval", interval_months: 3 };
  assert.deepEqual(U.validateSubscription(interval), []);
  assert.equal(U.isDueInMonth(interval, "2026-09"), false);
  assert.equal(U.isDueInMonth(interval, "2026-10"), true);
  assert.equal(U.isDueInMonth(interval, "2026-11"), false);
  assert.equal(U.isDueInMonth(interval, "2027-01"), true);
  assert.equal(U.yenExpenseAmount(interval), 3103);
});

test("USD subscription display shows original dollars and JPY estimate", () => {
  const S = expression("98-System/05-lib/finance/subscription_view_utils.js");
  assert.equal(S.amountLabel({ amount: 1234 }), "¥1,234");
  assert.equal(S.amountLabel({ amount: 1234, currency: "JPY" }), "¥1,234");
  assert.equal(S.amountLabel({ amount: null, currency: "JPY" }), "金額不正");
  assert.equal(S.amountLabel({ amount: "", currency: "JPY" }), "金額不正");
  assert.equal(S.amountLabel({ amount: "1,234", currency: "JPY" }), "¥1,234");
  assert.equal(S.amountLabel({ amount: 1.234, currency: "USD", exchange_rate_jpy_per_usd: 155 }), "金額不正");
  assert.equal(
    S.amountLabel({ amount: 20, currency: "USD", exchange_rate_jpy_per_usd: 155 }),
    "$20.00（約¥3,100）",
  );
  assert.match(S.amountLabel({ amount: 20, currency: "USD" }), /円換算レート未設定/);
  assert.equal(S.amountLabel({ amount: 20, currency: "EUR" }), "通貨不正");
  assert.match(read("98-System/04-view/finance/subscription_table.js"), /S\.amountLabel\(page\)/);
  assert.match(read("98-System/02-embed/00-meta/subscription-meta.md"), /exchange_rate_jpy_per_usd/);
});

test("USD Subscription sync posts only converted JPY and preserves immutable monthly snapshot", async () => {
  const sync = commonJs("98-System/01-script/sync_subscriptions.js");
  const utility = { path: "98-System/05-lib/finance/subscription_runtime_utils.js", extension: "js" };
  const monthlyFile = { path: "01-MonthlyNote/2026/2026-10.md", extension: "md" };
  const usdFile = { path: "96-Global/00-subscription/CloudUSD.md", extension: "md", basename: "CloudUSD" };
  const jpyFile = { path: "96-Global/00-subscription/CloudJPY.md", extension: "md", basename: "CloudJPY" };
  let monthly = "# 2026-10\n\n# 今月の支出\n\n# 次\n";
  let writes = 0;

  const records = new Map([
    [usdFile.path, {
      type: "subscription", subscription_id: "sub_usd", name: "Cloud USD",
      enabled: true, amount: 19.99, currency: "USD",
      exchange_rate_jpy_per_usd: 155.2, category: "サブスク",
      cycle: "monthly", start: "2026-10",
    }],
    [jpyFile.path, {
      type: "subscription", subscription_id: "sub_jpy", name: "Cloud JPY",
      enabled: true, amount: 980, category: "サブスク",
      cycle: "monthly", start: "2026-10",
    }],
  ]);

  const app = {
    vault: {
      getAbstractFileByPath(p) { return p === utility.path ? utility : p === monthlyFile.path ? monthlyFile : null; },
      getFileByPath(p) { return p === monthlyFile.path ? monthlyFile : null; },
      async read(file) {
        if (file.path === utility.path) return read(utility.path);
        if (file.path === monthlyFile.path) return monthly;
        throw new Error("unexpected read");
      },
      getMarkdownFiles() { return [usdFile, jpyFile]; },
      async process(file, transform) {
        assert.equal(file.path, monthlyFile.path);
        writes += 1;
        monthly = transform(monthly);
      },
    },
    metadataCache: {
      getFileCache(file) { return { frontmatter: records.get(file.path) }; },
    },
    workspace: { getActiveFile() { return null; } },
  };
  const tp = { app, file: { title: "" } };
  const priorNotice = globalThis.Notice;
  globalThis.Notice = class Notice { constructor() {} };

  try {
    const first = await sync(tp, "2026-10", { silent: true });
    assert.equal(first.ok, true);
    assert.equal(first.added, 2);
    assert.equal(writes, 1);
    assert.match(monthly, /\[expense:: 3103\]/);
    assert.match(monthly, /\[expense:: 980\]/);
    assert.match(monthly, /\[original_amount:: 19\.99\]/);
    assert.match(monthly, /\[original_currency:: USD\]/);
    assert.match(monthly, /\[exchange_rate_jpy_per_usd:: 155\.2\]/);
    assert.match(monthly, /\[exchange_rate_basis:: manual_estimate\]/);
    assert.equal((monthly.match(/\[subscription_key:: sub_usd@2026-10\]/g) ?? []).length, 1);

    const snapshot = monthly;
    records.get(usdFile.path).exchange_rate_jpy_per_usd = 160;
    const second = await sync(tp, "2026-10", { silent: true });
    assert.equal(second.ok, true);
    assert.equal(second.added, 0);
    assert.equal(monthly, snapshot);
  } finally {
    if (priorNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = priorNotice;
  }
});

test("USD Subscription sync fails closed on missing exchange rate before modifying MonthlyNote", async () => {
  const sync = commonJs("98-System/01-script/sync_subscriptions.js");
  const utility = { path: "98-System/05-lib/finance/subscription_runtime_utils.js", extension: "js" };
  const monthlyFile = { path: "01-MonthlyNote/2026/2026-10.md", extension: "md" };
  const usdFile = { path: "96-Global/00-subscription/USD.md", extension: "md", basename: "USD" };
  let writes = 0;
  const app = {
    vault: {
      getAbstractFileByPath(p) { return p === utility.path ? utility : p === monthlyFile.path ? monthlyFile : null; },
      getFileByPath(p) { return p === monthlyFile.path ? monthlyFile : null; },
      async read(file) {
        if (file.path !== utility.path) throw new Error("unexpected read");
        return read(utility.path);
      },
      getMarkdownFiles() { return [usdFile]; },
      async process() { writes += 1; throw new Error("must not be called"); },
    },
    metadataCache: {
      getFileCache() {
        return { frontmatter: {
          type: "subscription", subscription_id: "sub_missing", name: "USD",
          enabled: true, amount: 20, currency: "USD",
          category: "サブスク", cycle: "monthly", start: "2026-10",
        } };
      },
    },
    workspace: { getActiveFile() { return null; } },
  };
  const priorNotice = globalThis.Notice;
  globalThis.Notice = class Notice { constructor() {} };
  try {
    const result = await sync({ app, file: { title: "" } }, "2026-10", { silent: true });
    assert.equal(result.ok, false);
    assert.match(result.message, /exchange_rate_jpy_per_usd/);
    assert.equal(writes, 0);
  } finally {
    if (priorNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = priorNotice;
  }
});


test("USD creation command persists currency and explicit estimate through existing entrypoint", async () => {
  const create = commonJs("98-System/01-script/create_subscription.js");
  const utility = {
    path: "98-System/05-lib/finance/subscription_runtime_utils.js",
    extension: "js",
  };
  const contents = new Map();
  const prompts = ["USD Cloud", "19.99", "155.2", "クラウド", "2026-10", "14"];
  const app = {
    vault: {
      getAbstractFileByPath(p) {
        if (p === utility.path) return utility;
        return contents.get(p) ?? null;
      },
      async read(file) {
        if (file.path !== utility.path) throw new Error("unexpected file read");
        return read(utility.path);
      },
      async createFolder() {},
      async create(p, content) {
        const file = { path: p, extension: "md", content };
        contents.set(p, file);
        return file;
      },
    },
    workspace: { getLeaf() { return { async openFile() {} }; } },
  };
  const tp = {
    app,
    system: {
      async prompt() { return prompts.shift(); },
      async suggester(_labels, values) {
        if (values.includes("USD")) return "USD";
        if (values.includes("manual")) return "manual";
        return values[0];
      },
    },
  };
  const priorNotice = globalThis.Notice;
  globalThis.Notice = class Notice { constructor() {} };
  try {
    const result = await create(tp);
    assert.equal(result.ok, true);
    assert.equal(prompts.length, 0);
    const content = contents.get(result.path).content;
    assert.match(content, /^currency: USD$/m);
    assert.match(content, /^amount: 19\.99$/m);
    assert.match(content, /^exchange_rate_jpy_per_usd: 155\.2$/m);
    assert.match(content, /^exchange_rate_mode: manual$/m);
    assert.match(content, /^billing_day: 14$/m);
    assert.match(content, /^cycle: monthly$/m);
    assert.match(content, /^start: "2026-10"$/m);
  } finally {
    if (priorNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = priorNotice;
  }
});
