import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const expression = name => new Function('"use strict"; return (' + read(name) + ');')();
function commonJs(name) {
  const module = { exports: {} };
  new Function("module", "exports", read(name))(module, module.exports);
  return module.exports;
}
const utilPath = "98-System/05-lib/finance/subscription_runtime_utils.js";
const fxPath = "98-System/05-lib/finance/subscription_fx_utils.js";
const U = expression(utilPath);
const FX = expression(fxPath);
const sync = commonJs("98-System/01-script/sync_subscriptions.js");

function makeSubscription(fields) {
  return {
    type: "subscription",
    subscription_id: "sub_default",
    name: "Example",
    enabled: true,
    amount: 19.99,
    currency: "USD",
    exchange_rate_mode: "auto",
    cycle: "monthly",
    start: "2026-10",
    category: "サブスク",
    billing_day: 10,
    ...fields,
  };
}

function fixture(subscriptions, { month = "2026-10", content } = {}) {
  const utilityFiles = [utilPath, fxPath].map(p => ({ path: p, extension: "js" }));
  const monthlyFile = { path: "01-MonthlyNote/" + month.slice(0, 4) + "/" + month + ".md", extension: "md" };
  const entries = subscriptions.map((record, i) => ({
    file: {
      path: "96-Global/00-subscription/" + String(i) + ".md",
      basename: String(i),
      extension: "md",
    },
    record,
  }));
  let monthly = content ?? ("# " + month + "\n\n# 今月の支出\n\n# Next\n");
  let writes = 0;

  const app = {
    vault: {
      getAbstractFileByPath(p) {
        return p === monthlyFile.path ? monthlyFile : utilityFiles.find(f => f.path === p) ?? null;
      },
      getFileByPath(p) {
        return p === monthlyFile.path ? monthlyFile : null;
      },
      getMarkdownFiles() {
        return entries.map(e => e.file);
      },
      async read(file) {
        if (file.path === monthlyFile.path) return monthly;
        if ([utilPath, fxPath].includes(file.path)) return read(file.path);
        throw new Error("Unrecognized read path: " + file.path);
      },
      async process(file, update) {
        assert.equal(file.path, monthlyFile.path);
        writes++;
        monthly = update(monthly);
      },
    },
    metadataCache: {
      getFileCache(file) {
        return { frontmatter: entries.find(e => e.file.path === file.path)?.record };
      },
    },
    workspace: { getActiveFile() { return null; } },
  };
  return {
    app,
    tp: { app, file: { title: "" } },
    monthly: () => monthly,
    writes: () => writes,
  };
}

test("billing day defaults to 1 and clamps 29–31 to month end", () => {
  const s = makeSubscription({ billing_day: undefined });
  assert.equal(U.normalizeSubscription(s).billing_day, 1);
  assert.equal(U.billingDateInMonth(s, "2026-10"), "2026-10-01");
  assert.equal(U.billingDateInMonth({ ...s, billing_day: 31 }, "2026-02"), "2026-02-28");
  assert.equal(U.billingDateInMonth({ ...s, billing_day: 31 }, "2028-02"), "2028-02-29");
  assert.equal(U.billingDateInMonth({ ...s, billing_day: 30 }, "2026-04"), "2026-04-30");
  for (const bad of [0, 32, null, "", 1.5, "unknown"]) {
    assert.match(U.validateSubscription({ ...s, billing_day: bad }).join("\n"), /billing_day/);
  }
  assert.match(U.buildSubscriptionContent(makeSubscription({ billing_day: 28 })), /^billing_day: 28$/m);
  assert.match(U.buildSubscriptionContent(makeSubscription({ billing_day: 28 })), /^exchange_rate_mode: auto$/m);
});

test("USD FX mode preserves old manual notes and validates auto without stored rate", () => {
  const manual = makeSubscription({ exchange_rate_mode: undefined, exchange_rate_jpy_per_usd: 150 });
  const automatic = makeSubscription({});
  assert.deepEqual(U.validateSubscription(manual), []);
  assert.equal(U.normalizeSubscription(manual).exchange_rate_mode, "manual");
  assert.equal(U.yenExpenseAmount(manual), 2999);
  assert.deepEqual(U.validateSubscription(automatic), []);
  assert.equal(U.yenExpenseAmount(automatic), null);
  assert.equal(U.yenExpenseAmount(automatic, 155.2), 3103);
  assert.match(U.validateSubscription({ ...manual, exchange_rate_jpy_per_usd: null }).join("\n"), /exchange_rate/);
  assert.match(U.validateSubscription({ ...automatic, exchange_rate_mode: "invalid" }).join("\n"), /exchange_rate_mode/);
  assert.match(U.validateSubscription({ ...automatic, currency: "JPY", exchange_rate_mode: "auto" }).join("\n"), /JPY/);
});

test("USD to JPY always rounds upward and table estimate matches both FX modes", () => {
  const S = expression("98-System/05-lib/finance/subscription_view_utils.js");
  const vectors = [
    [19.99, 155.2, 3103], // 3102.448 -> ceil 3103 (not half-up 3102)
    [19.99, 150, 2999],   // exact half yen
    [0.01, 0.1, 1],       // tiny positive fraction
    [0.01, 100, 1],       // exact integer, no extra yen
    [0.07, 100, 7],       // binary float yields 7.000000000000001
    [20, 155, 3100],     // exact integer
    [0, 155.2, 0],       // zero is preserved
  ];
  for (const [amount, rate, expectedYen] of vectors) {
    const manual = makeSubscription({
      amount, exchange_rate_mode: "manual", exchange_rate_jpy_per_usd: rate,
    });
    const automatic = makeSubscription({
      amount, exchange_rate_mode: "auto", exchange_rate_jpy_per_usd: null,
    });
    assert.equal(U.yenExpenseAmount(manual), expectedYen, `manual ${amount} × ${rate}`);
    assert.equal(U.yenExpenseAmount(automatic, rate), expectedYen, `auto ${amount} × ${rate}`);
    const dollars = amount.toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    assert.equal(
      S.amountLabel(manual),
      `${dollars}（約¥${expectedYen.toLocaleString("ja-JP")}）`,
      `table preview must match posted JPY for ${amount} × ${rate}`,
    );
  }
  assert.equal(
    U.yenExpenseAmount(makeSubscription({
      currency: "JPY", exchange_rate_mode: "manual", amount: 1200,
    })),
    1200,
    "legacy JPY amounts remain unchanged",
  );
  assert.equal(
    U.yenExpenseAmount(makeSubscription({
      currency: "USD", exchange_rate_mode: "manual", amount: 1e15,
      exchange_rate_jpy_per_usd: 150,
    })),
    null,
    "oversized conversion must fail closed",
  );
});

test("already-posted older rounded USD rows are not silently recomputed", async () => {
  const oldLine = "- [date:: 2026-10-12] [expense:: 3102] " +
    "[subscription_key:: sub_usd@2026-10] [exchange_rate_jpy_per_usd:: 155.2]";
  const initial = "# 2026-10\n\n# 今月の支出\n" + oldLine + "\n# Next\n";
  const env = fixture([
    makeSubscription({ subscription_id: "sub_usd", billing_day: 12 }),
  ], { content: initial });
  const done = await sync(env.tp, null, {
    automatic: true, today: "2026-10-14", silent: true,
    requestUrl: async () => { throw new Error("must not fetch for existing entry"); },
  });
  assert.equal(done.ok, true);
  assert.equal(done.added, 0);
  assert.equal(env.writes(), 0);
  assert.equal(env.monthly(), initial);
});

test("FX quote validation binds exact pair, finite rate and reference date", async () => {
  const today = "2026-10-11";
  const ok = { date: "2026-10-09", base: "USD", quote: "JPY", rate: 154.123 };
  assert.deepEqual(FX.parseQuote(ok, today), {
    rate: 154.123, date: "2026-10-09", source: "frankfurter-v2",
    basis: "frankfurter_daily_reference",
  });
  for (const bad of [
    { ...ok, base: "EUR" }, { ...ok, quote: "EUR" }, { ...ok, rate: null },
    { ...ok, rate: "154" }, { ...ok, rate: 0 }, { ...ok, rate: Infinity },
    { ...ok, date: "2026-10-12" }, { ...ok, date: "2026-09-29" },
    { ...ok, date: "2026-02-31" },
  ]) assert.throws(() => FX.parseQuote(bad, today));

  let calls = 0;
  const quote = await FX.loadLatestUsdJpy(async args => {
    calls++;
    assert.deepEqual(args, { url: "https://api.frankfurter.dev/v2/rate/usd/jpy", method: "GET", throw: false });
    return { status: 200, json: ok };
  }, today);
  assert.equal(calls, 1);
  assert.equal(quote.rate, 154.123);
  await assert.rejects(() => FX.loadLatestUsdJpy(async () => ({ status: 503 }), today));
});

test("startup waits for billing day, catches up within month, snapshots FX once, and skips existing keys", async () => {
  const env = fixture([
    makeSubscription({ subscription_id: "sub_jpy", name: "JPY", currency: "JPY",
      exchange_rate_mode: "manual", amount: 900, billing_day: 5 }),
    makeSubscription({ subscription_id: "sub_usd", name: "USD", billing_day: 12 }),
  ]);
  let fetched = 0;
  const requestUrl = async () => {
    fetched++;
    return { status: 200, json: { date: "2026-10-09", base: "USD", quote: "JPY", rate: 155.2 } };
  };
  let r = await sync(env.tp, null, { automatic: true, today: "2026-10-04", requestUrl, silent: true });
  assert.equal(r.added, 0);
  assert.equal(env.writes(), 0);
  assert.equal(fetched, 0);

  r = await sync(env.tp, null, { automatic: true, today: "2026-10-10", requestUrl, silent: true });
  assert.equal(r.added, 1);
  assert.match(env.monthly(), /\[date:: 2026-10-05\] \[expense:: 900\]/);
  assert.equal(fetched, 0);

  r = await sync(env.tp, null, { automatic: true, today: "2026-10-12", requestUrl, silent: true });
  assert.equal(r.added, 1);
  assert.match(env.monthly(), /\[date:: 2026-10-12\] \[expense:: 3103\]/);
  assert.match(env.monthly(), /\[exchange_rate_basis:: frankfurter_daily_reference\]/);
  assert.match(env.monthly(), /\[exchange_rate_source:: frankfurter-v2\]/);
  assert.match(env.monthly(), /\[exchange_rate_date:: 2026-10-09\]/);
  assert.equal(fetched, 1);

  const snapshot = env.monthly();
  r = await sync(env.tp, null, { automatic: true, today: "2026-10-13", requestUrl, silent: true });
  assert.equal(r.added, 0);
  assert.equal(fetched, 1, "no network access for already posted subscriptions");
  assert.equal(env.writes(), 2);
  assert.equal(env.monthly(), snapshot, "first applied FX rate must remain immutable");
  assert.equal((snapshot.match(/\[subscription_key:: sub_usd@2026-10\]/g) ?? []).length, 1);
});

test("FX outage fails the entire startup batch without partially posting JPY", async () => {
  const env = fixture([
    makeSubscription({ subscription_id: "sub_jpy", currency: "JPY", amount: 1200,
      exchange_rate_mode: "manual", billing_day: 5 }),
    makeSubscription({ subscription_id: "sub_usd", billing_day: 5 }),
  ]);
  const snapshot = env.monthly();
  const failure = await sync(env.tp, null, {
    automatic: true, today: "2026-10-11", silent: true,
    requestUrl: async () => { throw new Error("offline"); },
  });
  assert.equal(failure.ok, false);
  assert.match(failure.message, /USDJPY/);
  assert.equal(env.monthly(), snapshot);
  assert.equal(env.writes(), 0);
});

test("automatic cycle respects yearly and N-month eligibility; only current month is automatic", async () => {
  const yearly = makeSubscription({
    subscription_id: "sub_year", currency: "JPY", exchange_rate_mode: "manual",
    amount: 5000, billing_day: 31, cycle: "yearly", payment_month: 2, start: "2026-01",
  });
  const interval = makeSubscription({
    subscription_id: "sub_interval", currency: "JPY", exchange_rate_mode: "manual",
    amount: 300, billing_day: 28, cycle: "interval", interval_months: 3, start: "2026-01",
  });
  const env = fixture([yearly, interval], { month: "2026-02" });
  const r = await sync(env.tp, null, { automatic: true, today: "2026-02-27", silent: true });
  assert.equal(r.added, 0);
  const done = await sync(env.tp, null, { automatic: true, today: "2026-02-28", silent: true });
  assert.equal(done.added, 1);
  assert.match(env.monthly(), /\[date:: 2026-02-28\] \[expense:: 5000\]/);
  assert.doesNotMatch(env.monthly(), /\[expense:: 300\]/);
  const guarded = await sync(env.tp, "2026-03", { automatic: true, today: "2026-02-28", silent: true });
  assert.equal(guarded.ok, false);
  assert.equal(env.writes(), 1);
});
