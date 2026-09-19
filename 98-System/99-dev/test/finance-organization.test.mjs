import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const expression = relativePath =>
  new Function(`"use strict"; return (${read(relativePath)});`)();

function compileDvjs(relativePath) {
  const source = read(relativePath);
  const match = source.match(/^\`\`\`dvjs\r?\n([\s\S]*?)\r?\n\`\`\`\s*$/);
  assert.ok(match, `${relativePath} must contain one dvjs block`);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(
    "dv", "input", "app", "moment", "document", "Notice",
    match[1],
  ));
}

function compileView(relativePath) {
  const source = read(relativePath);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(
    "dv", "input", "app", "moment", "document", "Notice",
    source,
  ));
}

test("stable Finance embeds delegate to organized Finance views", () => {
  const delegates = new Map([
    ["98-System/02-embed/04-viz/budget-visualiser.md", "98-System/04-view/finance/budget_visualiser"],
    ["98-System/02-embed/04-viz/daily-budget.md", "98-System/04-view/finance/daily_budget"],
    ["98-System/02-embed/04-viz/per-day-budget.md", "98-System/04-view/finance/per_day_budget"],
    ["98-System/02-embed/04-viz/categorized-expense-visualiser.md", "98-System/04-view/finance/categorized_expense_visualiser"],
    ["98-System/02-embed/04-viz/categorized-income-visualiser.md", "98-System/04-view/finance/categorized_income_visualiser"],
    ["98-System/02-embed/03-table/subscription-table.md", "98-System/04-view/finance/subscription_table"],
  ]);

  for (const [embed, view] of delegates) {
    assert.equal(
      read(embed),
      `\`\`\`dvjs\nawait dv.view("${view}");\n\`\`\`\n`,
    );
    compileDvjs(embed);
  }
});

test("organized Finance views compile and external views use dv.container", () => {
  const views = [
    "98-System/04-view/finance/budget_visualiser.js",
    "98-System/04-view/finance/daily_budget.js",
    "98-System/04-view/finance/per_day_budget.js",
    "98-System/04-view/finance/categorized_expense_visualiser.js",
    "98-System/04-view/finance/categorized_income_visualiser.js",
    "98-System/04-view/finance/subscription_table.js",
  ];

  for (const view of views) compileView(view);

  for (const view of views.slice(0, 3)) {
    const source = read(view);
    assert.doesNotMatch(source, /this\.container/);
    assert.match(source, /dv\.container/);
    assert.match(source, /98-System\/05-lib\/shared\/view_utils\.js/);
    assert.match(source, /98-System\/05-lib\/finance\/finance_view_utils\.js/);
    assert.doesNotMatch(source, /function\s+(?:formatYen|normalizeAmount|normalizeDate|addCategoryTotal|toRows)\b/);
  }
});

test("moved Finance views preserve storage, budget, and CSS contracts", () => {
  const budget = read("98-System/04-view/finance/budget_visualiser.js");
  const daily = read("98-System/04-view/finance/daily_budget.js");
  const perDay = read("98-System/04-view/finance/per_day_budget.js");

  assert.match(budget, /const budgetLimit = 30000 \+ 1600 \* 20;/);
  assert.match(budget, /const dangerMargin = 5000;/);
  assert.match(budget, /const initialBalance = 0;/);
  assert.match(budget, /const monthlyFolder = "01-MonthlyNote";/);
  assert.match(budget, /household-dashboard-lite/);
  assert.match(budget, /household-stacked-segment/);

  assert.match(daily, /const monthlyFolder = "01-MonthlyNote";/);
  assert.match(daily, /daily-expense-summary-lite/);
  assert.match(daily, /household-expense/);

  assert.match(perDay, /const monthlyFolder = "01-MonthlyNote";/);
  assert.match(perDay, /household-per-day-list/);
  assert.match(perDay, /household-stacked-segment/);
});

test("Finance view utilities preserve legacy amount, date, and category aggregation semantics", () => {
  const V = expression("98-System/05-lib/shared/view_utils.js");
  const factory = expression("98-System/05-lib/finance/finance_view_utils.js");
  const F = factory(V);

  assert.equal(F.formatYen(1234), "¥1,234");
  assert.equal(F.formatYen(-1234), "-¥1,234");
  assert.equal(F.normalizeAmount("1,234 円"), 1234);
  assert.equal(F.normalizeAmount("¥ 500"), 500);
  assert.equal(F.normalizeAmount(""), null);
  assert.equal(F.normalizeAmount("not-a-number"), null);
  assert.equal(F.normalizeDate("2026-09-18"), "2026-09-18");
  assert.equal(F.normalizeDate({ toFormat: pattern => pattern === "yyyy-MM-dd" ? "2026-09-18" : "x" }), "2026-09-18");

  const totals = Object.create(null);
  F.addCategoryTotal(totals, "食費", 1200);
  F.addCategoryTotal(totals, "食費", 300);
  F.addCategoryTotal(totals, null, 500);
  assert.deepEqual({ ...totals }, { "食費": 1500, "未分類": 500 });
  assert.deepEqual(F.toRows(totals, 2000), [
    { cat: "食費", sum: 1500, ratio: 0.75 },
    { cat: "未分類", sum: 500, ratio: 0.25 },
  ]);
});

test("Subscription view-model preserves type, labels, and DQL-equivalent ordering", () => {
  const S = expression("98-System/05-lib/finance/subscription_view_utils.js");

  assert.equal(S.isSubscription({ type: "subscription" }), true);
  assert.equal(S.isSubscription({ type: "other" }), false);
  assert.equal(S.displayName({ name: "Service", file: { name: "fallback" } }), "Service");
  assert.equal(S.displayName({ name: null, file: { name: "fallback" } }), "fallback");
  assert.equal(S.stateLabel(true), "🟢 有効");
  assert.equal(S.stateLabel(false), "⚪ 終了");
  assert.equal(S.cycleLabel({ cycle: "monthly" }), "毎月");
  assert.equal(S.cycleLabel({ cycle: "yearly", payment_month: 9 }), "年1回（9月）");
  assert.equal(S.cycleLabel({ cycle: "interval", interval_months: 3 }), "3か月ごと");
  assert.equal(S.cycleLabel({ cycle: "legacy" }), "legacy");

  const compare = (a, b) => {
    if (Object.is(a, b)) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a < b ? -1 : 1;
  };
  const rows = [
    { enabled: false, name: "A" },
    { enabled: true, name: "B" },
    { enabled: true, name: "A" },
  ].sort((a, b) => S.compareSubscriptions(a, b, compare));

  assert.deepEqual(rows.map(row => [row.enabled, row.name]), [
    [true, "A"],
    [true, "B"],
    [false, "A"],
  ]);
});

test("organized Subscription table preserves source, columns and Finance helper boundary", () => {
  const source = read("98-System/04-view/finance/subscription_table.js");

  assert.match(source, /98-System\/05-lib\/finance\/subscription_view_utils\.js/);
  assert.ok(source.includes("dv.pages('\"96-Global/00-subscription\"')"));
  assert.match(source, /S\.isSubscription/);
  assert.match(source, /S\.compareSubscriptions\(a, b, dv\.compare\)/);
  assert.match(source, /dv\.fileLink\(page\.file\.path, false, S\.displayName\(page\)\)/);
  assert.match(source, /\["サブスク", "状態", "金額", "周期", "開始", "カテゴリ"\]/);
});

test("Finance/Subscription public interfaces are explicitly protected", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const basename = new Set(
    registry.groups
      .filter(group => group.resolution === "basename")
      .flatMap(group => group.paths ?? []),
  );

  for (const publicPath of [
    "98-System/02-embed/03-table/subscription-table.md",
    "98-System/02-embed/04-viz/budget-visualiser.md",
    "98-System/02-embed/04-viz/categorized-expense-visualiser.md",
    "98-System/02-embed/04-viz/categorized-income-visualiser.md",
    "98-System/02-embed/04-viz/daily-budget.md",
    "98-System/02-embed/04-viz/per-day-budget.md",
    "98-System/02-embed/01-button/dashboard-subscription-buttons.md",
    "98-System/02-embed/00-meta/subscription-meta.md",
  ]) {
    assert.equal(basename.has(publicPath), true, `${publicPath} must remain a basename interface`);
  }

  const exactCommandGroup = registry.groups.find(group =>
    group.resolution === "exact" &&
    (group.paths ?? []).includes("98-System/00-command/create_subscription.md")
  );
  assert.ok(exactCommandGroup);
  assert.equal((exactCommandGroup.known_empty ?? []).includes("98-System/00-command/create_subscription.md"), false);

  const userFunctions = new Set(
    registry.groups
      .filter(group => group.resolution === "user_function")
      .flatMap(group => group.paths ?? []),
  );
  assert.equal(userFunctions.has("98-System/01-script/create_subscription.js"), true);
  assert.equal(userFunctions.has("98-System/01-script/sync_subscriptions.js"), true);
  assert.equal(userFunctions.has("98-System/01-script/sync_subscription.js"), false);
  assert.equal(
    fs.existsSync(path.join(root, "98-System/01-script/sync_subscription.js")),
    false,
    "legacy singular sync implementation must remain retired"
  );
});

test("Subscription actions delegate to canonical user functions and runtime schema", () => {
  const buttons = read("98-System/02-embed/01-button/dashboard-subscription-buttons.md");
  const syncCommand = read("98-System/00-command/sync_subscriptions.md");
  const createCommand = read("98-System/00-command/create_subscription.md");
  const syncScript = read("98-System/01-script/sync_subscriptions.js");
  const createScript = read("98-System/01-script/create_subscription.js");
  const runtime = read("98-System/05-lib/finance/subscription_runtime_utils.js");

  assert.match(buttons, /id: "sync-subscriptions"/);
  assert.match(buttons, /templateFile: 98-System\/00-command\/sync_subscriptions\.md/);
  assert.match(buttons, /id: "create-subscription"/);
  assert.match(buttons, /templateFile: 98-System\/00-command\/create_subscription\.md/);

  assert.equal(syncCommand, "<%* await tp.user.sync_subscriptions(tp); %>\n");
  assert.equal(createCommand, "<%* await tp.user.create_subscription(tp); %>\n");

  assert.match(syncScript, /subscription_runtime_utils\.js/);
  assert.match(createScript, /subscription_runtime_utils\.js/);
  assert.match(runtime, /registryFolder: "96-Global\/00-subscription"/);
  assert.match(runtime, /monthlyFolder: "01-MonthlyNote"/);
  assert.match(runtime, /expenseHeading: "# 今月の支出"/);
});

test("Dashboard keeps Finance summaries/actions while detail views remain on Daily and Monthly", () => {
  const dashboardFinance = read("98-System/02-embed/dashboard/work-finance.md");
  const daily = read("98-System/03-template/01-note/daily-note-template.md");
  const monthly = read("98-System/03-template/01-note/monthly-note-template.md");

  const expectedDashboard = [
    "[[work-summary]]",
    "[[budget-visualiser]]",
    "[[dashboard-subscription-buttons]]",
  ];
  let previous = -1;
  for (const embed of expectedDashboard) {
    const index = dashboardFinance.indexOf(embed);
    assert.ok(index > previous, `${embed} must keep Dashboard ordering`);
    previous = index;
  }
  assert.doesNotMatch(dashboardFinance, /\[\[subscription-table\]\]/);

  assert.match(daily, /\[\[daily-budget\]\]/);
  assert.match(monthly, /\[\[budget-visualiser\]\]/);
  assert.match(monthly, /\[\[per-day-budget\]\]/);
  assert.match(monthly, /\[\[categorized-expense-visualiser\]\]/);
  assert.match(monthly, /\[\[categorized-income-visualiser\]\]/);
});
