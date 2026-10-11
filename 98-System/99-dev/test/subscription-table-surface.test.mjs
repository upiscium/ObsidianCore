import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const tableEmbed = "98-System/02-embed/03-table/subscription-table.md";
const tableView = "98-System/04-view/finance/subscription_table.js";
const tableHelper = "98-System/05-lib/finance/subscription_view_utils.js";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function dvjsSource(markdown) {
  const match = markdown.match(/^```dvjs\r?\n([\s\S]*?)\r?\n```\s*$/);
  assert.ok(match, "stable Subscription table must be an executable DataviewJS embed");
  return match[1];
}

test("Subscription renders inline on Dashboard and in new Monthly Notes", () => {
  const dashboard = read("98-System/02-embed/dashboard/work-finance.md");
  const monthly = read("98-System/03-template/01-note/monthly-note-template.md");

  assert.match(dashboard, /\[\[dashboard-subscription-buttons\]\]/);
  const tableDirective = "```meta-bind-embed\n[[subscription-table]]\n```";
  assert.equal(dashboard.split(tableDirective).length - 1, 1,
    "Dashboard must render the public Subscription table exactly once");
  assert.ok(dashboard.indexOf("[[dashboard-subscription-buttons]]") < dashboard.indexOf(tableDirective),
    "Subscription table should follow the Sync/Add controls");
  assert.ok(fs.existsSync(path.join(root, tableEmbed)), "Dashboard table embed must resolve");
  assert.doesNotMatch(dashboard, /\[\[98-System\/02-embed\/03-table\/subscription-table\|/,
    "Dashboard must not fall back to a navigation link");

  const financeIndex = monthly.indexOf("# 💰 今月の家計簿");
  const tableIndex = monthly.indexOf("## サブスクリプション（登録一覧）");
  const workIndex = monthly.indexOf("# 🕒 勤務時間");
  assert.ok(financeIndex >= 0 && financeIndex < tableIndex && tableIndex < workIndex);
  assert.match(monthly, /## サブスクリプション（登録一覧）\r?\n```meta-bind-embed\r?\n\[\[subscription-table\]\]\r?\n```/);
  assert.equal((monthly.match(/\[\[subscription-table\]\]/g) ?? []).length, 1);
  assert.doesNotMatch(monthly, /```meta-bind-embed\r?\n\s*\r?\n```/, "do not leave an empty Meta Bind embed");
});

test("stable Subscription Dataview embed executes and renders mixed JPY/USD rows", async () => {
  const notes = [
    {
      type: "subscription", name: "Inactive", enabled: false, amount: 300,
      currency: "JPY", cycle: "monthly", start: "2026-09", category: "Misc",
      file: { path: "96-Global/00-subscription/Inactive.md", name: "Inactive" },
    },
    {
      type: "subscription", name: "USD Cloud", enabled: true, amount: 19.99,
      currency: "USD", exchange_rate_jpy_per_usd: 155.2,
      cycle: "interval", interval_months: 3, start: "2026-10", category: "Cloud",
      file: { path: "96-Global/00-subscription/Cloud.md", name: "Cloud" },
    },
    {
      type: "subscription", name: "JPY Legacy", enabled: true, amount: 980,
      cycle: "monthly", start: "2026-10", category: "Utilities",
      file: { path: "96-Global/00-subscription/Legacy.md", name: "Legacy" },
    },
    {
      type: "other", name: "Excluded", enabled: true, amount: 1,
      file: { path: "96-Global/00-subscription/Other.md", name: "Other" },
    },
  ];

  let invocationCount = 0;
  const rendered = [];
  const dv = {
    io: {
      async load(source) {
        assert.equal(source, tableHelper);
        return read(source);
      },
    },
    pages(source) {
      assert.equal(source, '"96-Global/00-subscription"');
      return notes;
    },
    compare(a, b) {
      if (Object.is(a, b)) return 0;
      if (a == null) return -1;
      if (b == null) return 1;
      return a < b ? -1 : 1;
    },
    fileLink(filePath, embed, display) {
      assert.equal(embed, false);
      return { filePath, display };
    },
    table(headers, rows) {
      rendered.push({ headers, rows });
    },
    async view(viewPath) {
      assert.equal(viewPath, tableView.replace(/\.js$/, ""));
      invocationCount += 1;
      return new AsyncFunction("dv", read(tableView))(dv);
    },
  };

  // Execute the public markdown entrypoint, not just its internal JS view.
  await new AsyncFunction("dv", dvjsSource(read(tableEmbed)))(dv);

  assert.equal(invocationCount, 1);
  assert.equal(rendered.length, 1);
  const { headers, rows } = rendered[0];
  assert.deepEqual(headers, ["サブスク", "状態", "金額", "周期", "開始", "カテゴリ"]);
  assert.equal(rows.length, 3, "non-subscription entries must not appear");
  assert.deepEqual(rows.map(row => row[0].display), ["JPY Legacy", "USD Cloud", "Inactive"]);
  assert.deepEqual(rows.map(row => row[2]), [
    "¥980",
    "$19.99（約¥3,103）",
    "¥300",
  ]);
  assert.equal(rows[1][3], "3か月ごと");
});
