async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/05-lib/ai/projection_utils.js");
const pages = Array.from(dv.pages('"03-AI"'));
const current = U.latestByCase(pages, dv);

const counts = {
  processing: 0,
  review: 0,
  delivery: 0,
  failed: 0,
  completed: 0,
};

for (const page of current) {
  const state = U.stateOf(page);
  if (Object.prototype.hasOwnProperty.call(counts, state)) counts[state] += 1;
}

const STALE_AFTER_MS = 10 * 60 * 1000;

function millisOf(value) {
  if (value == null) return null;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.ts === "number") return value.ts;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(value) {
  if (value == null) return "—";
  if (typeof value?.toFormat === "function") return value.toFormat("yyyy-LL-dd HH:mm");
  const millis = millisOf(value);
  if (millis == null) return "—";
  return new Date(millis).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAge(milliseconds) {
  if (milliseconds == null) return "—";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間${minutes % 60}分前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

const visiblePages = pages.filter(page => {
  const id = String(page?.ai_case_id ?? "").trim();
  const stage = String(page?.ai_stage ?? "").trim();
  return /^[0-9a-f]{64}$/.test(id) && U.stageOrder(stage) >= 0;
});

let latestPage = null;
let latestMillis = null;
for (const page of visiblePages) {
  const candidate = millisOf(page?.file?.mtime);
  if (candidate == null) continue;
  if (latestMillis == null || candidate > latestMillis) {
    latestMillis = candidate;
    latestPage = page;
  }
}

const now = Date.now();
const latestAgeMs = latestMillis == null ? null : Math.max(0, now - latestMillis);
const stale = latestAgeMs == null || latestAgeMs >= STALE_AFTER_MS;

let observation;
if (counts.failed > 0) {
  observation = {
    label: "要確認",
    badgeClass: "oc-badge--danger",
    detail: "Failed状態のcaseがあります。",
  };
} else if (counts.review > 0) {
  observation = {
    label: "Review待ち",
    badgeClass: "oc-badge--warning",
    detail: "Human Review待ちのcaseがあります。",
  };
} else if (counts.delivery > 0) {
  observation = {
    label: "反映中",
    badgeClass: "oc-badge--success",
    detail: "Approve済みcaseの実行・反映を観測しています。",
  };
} else if (counts.processing > 0 && !stale) {
  observation = {
    label: "処理中",
    badgeClass: "oc-badge--success",
    detail: "最近のpipeline projectionを観測しています。",
  };
} else if (current.length === 0) {
  observation = {
    label: "観測データなし",
    badgeClass: "oc-badge--warning",
    detail: "03-AIに現在caseがありません。timerの実状態はVaultからは判断できません。",
  };
} else if (stale) {
  observation = {
    label: "更新なし",
    badgeClass: "oc-badge--warning",
    detail: "10分以上新しいprojectionを観測していません。必要ならproduction timer/serviceを確認してください。",
  };
} else {
  observation = {
    label: "稼働観測あり",
    badgeClass: "oc-badge--success",
    detail: "最近のpipeline projectionを観測しています。",
  };
}

const root = document.createElement("div");
root.style.display = "grid";
root.style.gap = "0.75rem";
root.style.margin = "0.5rem 0 1rem";

const statusPanel = document.createElement("section");
statusPanel.className = "oc-panel";

const statusTitle = document.createElement("div");
statusTitle.style.display = "flex";
statusTitle.style.alignItems = "center";
statusTitle.style.justifyContent = "space-between";
statusTitle.style.gap = "0.75rem";
statusTitle.style.flexWrap = "wrap";

const heading = document.createElement("strong");
heading.textContent = "Pipeline observation";

const badge = document.createElement("span");
badge.className = `oc-badge ${observation.badgeClass}`;
badge.textContent = observation.label;

statusTitle.append(heading, badge);
statusPanel.append(statusTitle);

const detail = document.createElement("p");
detail.className = "oc-caption";
detail.style.marginBottom = "0";
detail.textContent = observation.detail;
statusPanel.append(detail);

const activity = document.createElement("p");
activity.className = "oc-caption";
activity.style.marginBottom = "0";
activity.textContent = latestPage
  ? `最終projection: ${formatTimestamp(latestPage.file.mtime)}（${formatAge(latestAgeMs)}） / ${U.stateLabel(latestPage)}`
  : "最終projection: なし";
statusPanel.append(activity);

const boundary = document.createElement("p");
boundary.className = "oc-caption";
boundary.style.marginBottom = "0";
boundary.textContent = "※ これは03-AI projectionから見える状態です。systemd timer/serviceのenabled・active状態そのものは表示していません。";
statusPanel.append(boundary);

root.append(statusPanel);

const stats = document.createElement("div");
stats.style.display = "grid";
stats.style.gridTemplateColumns = "repeat(auto-fit, minmax(8.5rem, 1fr))";
stats.style.gap = "0.6rem";

const statItems = [
  ["Visible cases", current.length],
  ["Processing", counts.processing],
  ["Review", counts.review],
  ["Delivery", counts.delivery],
  ["Failed", counts.failed],
  ["Completed", counts.completed],
];

for (const [label, value] of statItems) {
  const panel = document.createElement("section");
  panel.className = "oc-panel";
  panel.style.padding = "0.75rem";

  const caption = document.createElement("div");
  caption.className = "oc-caption";
  caption.textContent = label;

  const number = document.createElement("div");
  number.className = "oc-number";
  number.style.fontSize = "1.35rem";
  number.style.fontWeight = "700";
  number.textContent = String(value);

  panel.append(caption, number);
  stats.append(panel);
}

root.append(stats);
dv.container.append(root);
