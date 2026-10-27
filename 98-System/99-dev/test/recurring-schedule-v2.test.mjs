import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
function expression(relative) {
  return new Function('"use strict"; return (' + read(relative) + ');')();
}

const S = expression("98-System/01-script/task_schedule_utils.js");
const R = expression("98-System/01-script/recurring_task_utils.js")(S);
const makeEditor = expression("98-System/01-script/recurring_schedule_ui.js");

const base = {
  type: "recurring-task", uid: "rct_contract-123", title: "Weekly task",
  enabled: true, frequency: "weekly", interval: 1, anchor: "2026-08-05",
  lookahead_days: 30, start_offset_days: null, due_offset_days: 0,
  priority: null, workspace: null, project: null
};

test("weekly day selection accepts multiple ISO weekdays and excludes dates before anchor", () => {
  const weekly = { ...base, weekdays: [5, 3, 1] };
  assert.deepEqual(R.normalizeDefinition(weekly).weekdays, [1, 3, 5]);
  assert.deepEqual(R.occurrencesInWindow(weekly, "2026-08-03"), [
    "2026-08-05", "2026-08-07", "2026-08-10", "2026-08-12", "2026-08-14",
    "2026-08-17", "2026-08-19", "2026-08-21", "2026-08-24", "2026-08-26",
    "2026-08-28", "2026-08-31", "2026-09-02"
  ]);
  assert.equal(R.isOccurrence(weekly, "2026-08-03"), false);
  assert.equal(R.weekday("2026-08-10"), 1);
  assert.equal(R.weekday("2026-08-16"), 7);
});

test("interval 2 weekly tracks anchored Monday-week and retains multiple weekdays", () => {
  const interval2 = { ...base, interval: 2, weekdays: [1, 3, 5], lookahead_days: 26 };
  assert.deepEqual(R.occurrencesInWindow(interval2, "2026-08-05"), [
    "2026-08-05", "2026-08-07", "2026-08-17", "2026-08-19", "2026-08-21", "2026-08-31"
  ]);
  const old = { ...base, interval: 2, anchor: "2026-08-03", lookahead_days: 30 };
  assert.deepEqual(R.occurrencesInWindow(old, "2026-08-09"), [
    "2026-08-17", "2026-08-31"
  ]);
});

test("monthly second Tuesday and final Friday use the nth weekday, not calendar week overlap", () => {
  const monthly = { ...base, frequency: "monthly", anchor: "2026-01-01",
    month_week: 2, month_weekday: 2, lookahead_days: 90 };
  assert.deepEqual(R.occurrencesInWindow(monthly, "2026-01-01"), [
    "2026-01-13", "2026-02-10", "2026-03-10"
  ]);
  const last = { ...monthly, month_week: "last", month_weekday: 5 };
  assert.deepEqual(R.occurrencesInWindow(last, "2026-01-01"), [
    "2026-01-30", "2026-02-27", "2026-03-27"
  ]);
  assert.equal(R.isOccurrence(last,"2028-02-25"),true);
  assert.equal(R.isOccurrence(last,"2028-02-18"),false);
});

test("fifth weekday skips absent months; interval months respect anchor month", () => {
  const fifth = { ...base, frequency: "monthly", anchor: "2026-01-01",
    month_week: 5, month_weekday: 1, lookahead_days: 90 };
  assert.deepEqual(R.occurrencesInWindow(fifth,"2026-01-01"),["2026-03-30"]);
  assert.equal(R.isOccurrence(fifth,"2026-02-23"),false);
  assert.equal(R.isOccurrence(fifth,"2026-06-29"),true);
  const twoMonths={ ...fifth, interval: 2, month_week: 2, month_weekday: 2, anchor: "2026-01-15" };
  assert.equal(R.isOccurrence(twoMonths, "2026-01-13"),false);
  assert.equal(R.isOccurrence(twoMonths, "2026-03-10"),true);
  assert.equal(R.isOccurrence(twoMonths, "2026-02-10"),false);
  assert.equal(R.isOccurrence(twoMonths, "2026-05-12"),true);
});

test("invalid combinations, empty/duplicate weekdays, and partial nth fields fail closed", () => {
  for (const weekdays of [[], [1,1], [0], [8], "1,2", [1,2,3,4,5,6,7,7]]) {
    assert.throws(()=>R.normalizeDefinition({...base, weekdays}), /weekdays/);
  }
  for (const bad of [
    {frequency:"daily", weekdays:[1]},
    {frequency:"monthly", weekdays:[2]},
    {frequency:"weekly", month_week: 1, month_weekday: 2},
    {frequency:"monthly",month_week:2},
    {frequency:"monthly",month_weekday:3},
    {frequency:"monthly",month_week:0,month_weekday:1},
    {frequency:"monthly",month_week:"random",month_weekday:3},
    {frequency:"monthly",month_week:"last",month_weekday:8}
  ]) assert.throws(()=>R.normalizeDefinition({...base,...bad}), /weekdays|month_week/);
  assert.equal(R.isOccurrence({...base,weekdays:[1]}, "invalid"),false);
});

test("preview is bounded and never creates a Task or edits lookahead", () => {
  const next = R.nextOccurrences({...base, frequency:"monthly", anchor:"2026-01-01",
    month_week:2,month_weekday:2,lookahead_days:7},"2026-01-01",3,400);
  assert.deepEqual(next,["2026-01-13","2026-02-10","2026-03-10"]);
  assert.throws(()=>R.nextOccurrences(base,"2026-08-05",6,365),/preview/);
  assert.deepEqual(R.nextOccurrences({...base,enabled:false},"2026-08-05"),[]);
  assert.equal(R.occurrenceTaskPath(base,"2026-08-05"),"02-Task/2026/08/20260805-R-rct_contract-123.md");
});

class Node {
  constructor(tag){
    this.tagName=tag;this.children=[];this.listeners={};this.attrs={};this.dataset={};
    this.className="";this.textContent="";this.value="";this.disabled=false;this.hidden=false;
    this.checked=false;
    this.classList={
      add: cls => {if(!this.className.split(" ").includes(cls)) this.className+=" "+cls;},
      remove: cls => {this.className=this.className.split(" ").filter(s=>s!==cls).join(" ");}
    };
  }
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this.attrs[name]=String(value);}
  addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);}
  async trigger(name){for(const f of this.listeners[name]??[])await f({preventDefault(){}});}
}
function gather(root){return [root,...root.children.flatMap(gather)];}
const first = (root,cls) => gather(root).find(x=>x.className.split(" ").includes(cls));
const all = (root,cls) => gather(root).filter(x=>x.className.split(" ").includes(cls));

function setupEditor(initial=base) {
  const target={...initial};
  const file={path:"02-Task/Recurring/Weekly task.md",extension:"md"};
  const app={
    vault:{getAbstractFileByPath:p=>p===file.path?file:null},
    workspace:{openLinkText(){}},
    fileManager:{async processFrontMatter(f,fn){assert.equal(f,file);fn(target);}}
  };
  const editor=makeEditor({
    app,document:{createElement:tag=>new Node(tag)},
    recurrence:R,today:()=>"2026-08-05"
  });
  const root=new Node("div");
  const card=editor.render(root,{...initial,file});
  return {root,card,target,app};
}

test("editor starts unchanged, saves selected weekdays and only edited frontmatter", async () => {
  const {card,target}=setupEditor();
  const save=first(card,"oc-recurring-save");
  assert.equal(save.disabled,true,"legacy schedule is not dirty on first render");
  const mon=all(card,"oc-recurring-day")[0];
  assert.equal(mon.attrs["aria-pressed"],"false");
  await mon.trigger("click");
  assert.equal(mon.attrs["aria-pressed"],"true");
  assert.equal(save.disabled,false);
  await first(card,"oc-recurring-form").trigger("submit");
  assert.deepEqual(target.weekdays,[1,3]);
  assert.equal(target.frequency,"weekly");
  assert.equal(target.anchor,base.anchor);
  assert.equal(save.disabled,true);
  assert.match(first(card,"oc-recurring-message").textContent,/保存しました/);
});

test("editor can change to last Friday then back to weekly without stale properties", async () => {
  const {card,target}=setupEditor();
  const frequency=first(card,"oc-recurring-select");
  frequency.value="monthly";
  await frequency.trigger("change");
  const selects=all(card,"oc-recurring-select");
  selects[1].value="weekday";
  await selects[1].trigger("change");
  selects[2].value="last";selects[3].value="5";
  await first(card,"oc-recurring-form").trigger("submit");
  assert.equal(target.frequency,"monthly");
  assert.equal(target.month_week,"last");
  assert.equal(target.month_weekday,5);
  assert.ok(!("weekdays" in target));
  frequency.value="weekly";await frequency.trigger("change");
  await first(card,"oc-recurring-form").trigger("submit");
  assert.equal(target.frequency,"weekly");
  assert.deepEqual(target.weekdays,[3]);
  assert.ok(!("month_week" in target));
  assert.ok(!("month_weekday" in target));
});

test("editor refuses concurrent edits instead of overwriting another device", async () => {
  const {card,target}=setupEditor();
  await all(card,"oc-recurring-day")[0].trigger("click");
  target.anchor="2026-08-07"; // Another pane changed this after rendering.
  await first(card,"oc-recurring-form").trigger("submit");
  assert.ok(!("weekdays" in target));
  assert.equal(target.anchor,"2026-08-07");
  assert.match(first(card,"oc-recurring-message").textContent,/保存できませんでした/);
});

test("empty weekday selection cannot be saved and shows accessible error", async () => {
  const {card,target}=setupEditor({...base,weekdays:[3]});
  await all(card,"oc-recurring-day")[2].trigger("click");
  assert.equal(first(card,"oc-recurring-save").disabled,true);
  assert.match(first(card,"oc-recurring-preview").textContent,/設定を確認/);
  assert.ok(!("weekdays" in target) || target.weekdays.length===1);
});

test("Task HUB routes editor to reusable scripts and canonical CSS bundle", () => {
  const view=read("98-System/04-view/tasks/recurring_tasks.js");
  assert.match(view,/recurring_schedule_ui/);
  assert.match(view,/dv\.el\("div".*"oc-recurring-list"/);
  assert.match(view,/input\?\.only/);
  assert.doesNotThrow(()=>new Function("dv","input","app","document","window",
      "return async function view() {\n"+view+"\n}"));
  const css=read("98-System/99-dev/styles/recurring.css");
  assert.match(css,/\.oc-recurring-card/);
  assert.match(css,/\[aria-pressed="true"\]/);
  assert.match(css,/@media \(max-width: 570px\)/);
  assert.doesNotMatch(css,/@import|url\(|@font-face|position:\s*fixed/);
  const bundled=read("98-System/90-config/styles/obsidian-core.css");
  assert.ok(bundled.includes("SOURCE: 98-System/99-dev/styles/recurring.css"));
  assert.ok(bundled.includes(css.trim()));
});


test("explicit malformed new schedule fields cannot silently use legacy fallback", () => {
  for (const value of [null, "", true, [true, 3], [null, 3], [1, ""], [1, "3"], [1, 1.5]]) {
    assert.throws(() => R.normalizeDefinition({ ...base, weekdays: value }), /weekdays/);
  }
  for (const value of [null, "", true, [2], "2", 0, 6]) {
    assert.throws(() => R.normalizeDefinition({
      ...base, frequency: "monthly", month_week: value, month_weekday: 2
    }), /month_week/);
  }
  for (const value of [null, "", true, [2], "2", 0, 8]) {
    assert.throws(() => R.normalizeDefinition({
      ...base, frequency: "monthly", month_week: 2, month_weekday: value
    }), /month_weekday/);
  }
  const dataArray = { array: () => [1, 5] };
  assert.deepEqual(R.normalizeDefinition({ ...base, weekdays: dataArray }).weekdays, [1, 5]);
});

test("unchanged legacy weekly permits enabled and interval edits without writing weekdays", async () => {
  const { card, target } = setupEditor();
  const enabled = first(card, "oc-recurring-enabled");
  enabled.checked = false;
  await enabled.trigger("change");
  const interval = first(card, "oc-recurring-number");
  interval.value = "2";
  await interval.trigger("input");
  await first(card, "oc-recurring-form").trigger("submit");
  assert.equal(target.enabled, false);
  assert.equal(target.interval, 2);
  assert.ok(!("weekdays" in target));
  assert.match(first(card, "oc-recurring-message").textContent, /保存しました/);
});

test("empty interval, anchor and lookahead inputs cannot trigger implicit defaults", async () => {
  const { card, target } = setupEditor();
  const requiredControls = [
    ...all(card, "oc-recurring-number"),
    first(card, "oc-recurring-date")
  ];
  for (const input of requiredControls) {
    assert.equal(input.required, true);
    const previous = input.value;
    input.value = "";
    await input.trigger("input");
    assert.equal(first(card, "oc-recurring-save").disabled, true);
    assert.match(first(card, "oc-recurring-preview").textContent, /空欄/);
    input.value = previous;
    await input.trigger("input");
  }
  assert.equal(target.interval, 1);
  assert.equal(target.lookahead_days, 30);
  assert.equal(target.anchor, base.anchor);
});

test("Task HUB DataviewJS executes and renders actual editor without Notice global", async () => {
  const { app } = setupEditor();
  const root = new Node("div");
  const page = { ...base, file: { path: "02-Task/Recurring/Weekly task.md", name: "Weekly task" } };
  const dv = {
    io: { load: async filename => read(filename) },
    pages: () => ({ where: predicate => [page].filter(predicate) }),
    el: () => root,
    paragraph: () => { throw Error("unexpected empty Definition"); }
  };
  const oldNotice = globalThis.Notice;
  try {
    delete globalThis.Notice;
    const view = read("98-System/04-view/tasks/recurring_tasks.js");
    const execute = new Function("dv", "input", "app", "document", "window",
      "return (async function () {\n" + view + "\n})();");
    await execute(dv, {}, app, { createElement: tag => new Node(tag) },
      { moment: () => ({ format: () => "2026-08-05" }) });
    assert.equal(root.children.length, 1);
    assert.ok(first(root, "oc-recurring-form"));
    assert.ok(first(root, "oc-recurring-weekdays"));
  } finally {
    if (oldNotice === undefined) delete globalThis.Notice;
    else globalThis.Notice = oldNotice;
  }
});

test("switching daily to weekly preserves saved weekdays through later anchor edits", async () => {
  const { card, target } = setupEditor({ ...base, frequency: "daily" });
  const frequency = first(card, "oc-recurring-select");
  frequency.value = "weekly";
  await frequency.trigger("change");
  assert.equal(first(card, "oc-recurring-save").disabled, false);
  await first(card, "oc-recurring-form").trigger("submit");
  assert.equal(target.frequency, "weekly");
  assert.deepEqual(target.weekdays, [3]);
  assert.equal(first(card, "oc-recurring-save").disabled, true);

  const anchor = first(card, "oc-recurring-date");
  anchor.value = "2026-08-06";
  await anchor.trigger("change");
  assert.equal(first(card, "oc-recurring-save").disabled, false);
  await first(card, "oc-recurring-form").trigger("submit");
  assert.equal(target.anchor, "2026-08-06");
  assert.deepEqual(target.weekdays, [3]);
  assert.equal(first(card, "oc-recurring-save").disabled, true);
});

test("switching monthly to weekly with no weekday-chip click is stable after save", async () => {
  const initial = { ...base, frequency: "monthly" };
  const { card, target } = setupEditor(initial);
  const frequency = first(card, "oc-recurring-select");
  frequency.value = "weekly";
  await frequency.trigger("change");
  await first(card, "oc-recurring-form").trigger("submit");
  assert.equal(target.frequency, "weekly");
  assert.deepEqual(target.weekdays, [3]);
  assert.equal(first(card, "oc-recurring-save").disabled, true);
  assert.match(first(card, "oc-recurring-message").textContent, /保存しました/);
});

test("legacy weekly Anchor edit updates weekday chips and keeps the new weekday when customized later", async () => {
  const { card, target } = setupEditor();
  const chips = all(card, "oc-recurring-day");
  assert.equal(chips[2].attrs["aria-pressed"], "true");  // original Wednesday

  const anchor = first(card, "oc-recurring-date");
  anchor.value = "2026-08-06";  // Thursday
  await anchor.trigger("input");
  assert.equal(chips[2].attrs["aria-pressed"], "false");
  assert.equal(chips[3].attrs["aria-pressed"], "true");
  await first(card, "oc-recurring-form").trigger("submit");
  assert.equal(target.anchor, "2026-08-06");
  assert.ok(!("weekdays" in target), "legacy schedule stays legacy");
  assert.equal(first(card, "oc-recurring-save").disabled, true);

  await chips[0].trigger("click"); // Add Monday to currently effective Thursday.
  assert.equal(chips[0].attrs["aria-pressed"], "true");
  assert.equal(chips[3].attrs["aria-pressed"], "true");
  assert.equal(chips[2].attrs["aria-pressed"], "false");
  await first(card, "oc-recurring-form").trigger("submit");
  assert.deepEqual(target.weekdays, [1, 4]);
  assert.equal(first(card, "oc-recurring-save").disabled, true);
});

test("explicit weekly weekday selection does not drift when Anchor changes", async () => {
  const { card, target } = setupEditor({ ...base, weekdays: [1, 3, 5] });
  const chips = all(card, "oc-recurring-day");
  const anchor = first(card, "oc-recurring-date");
  anchor.value = "2026-08-06";
  await anchor.trigger("change");
  assert.equal(chips[0].attrs["aria-pressed"], "true");
  assert.equal(chips[2].attrs["aria-pressed"], "true");
  assert.equal(chips[3].attrs["aria-pressed"], "false");
  assert.equal(chips[4].attrs["aria-pressed"], "true");
  await first(card, "oc-recurring-form").trigger("submit");
  assert.deepEqual(target.weekdays, [1, 3, 5]);
  assert.equal(target.anchor, "2026-08-06");
});
