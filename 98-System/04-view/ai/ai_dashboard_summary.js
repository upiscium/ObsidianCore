async function loadLib(path) {
  const source = await dv.io.load(path);
  if (!source) throw new Error(`Dataview library not found: ${path}`);
  return new Function("dv", `"use strict"; return (${source});`)(dv);
}

const U = await loadLib("98-System/05-lib/ai/projection_utils.js");
const reviewCount = U.latestByCase(U.projectionPages(dv), dv)
  .filter(page => U.stateOf(page) === "review").length;

// A human action inbox, not a readout of the pipeline's operational health.
// The Automation management Dashboard owns service errors and health.
const panel = document.createElement("section");
panel.className = "oc-panel";
panel.style.padding = "0.75rem";
panel.style.margin = "0.5rem 0 1rem";

const caption = document.createElement("div");
caption.className = "oc-caption";
caption.textContent = "Review";

const number = document.createElement("div");
number.className = "oc-number";
number.style.fontSize = "1.35rem";
number.style.fontWeight = "700";
number.textContent = String(reviewCount);

const detail = document.createElement("div");
detail.className = "oc-caption";
detail.textContent = reviewCount === 0
  ? "Review待ちはありません。"
  : "判断待ちのAI成果物があります。";

panel.append(caption, number, detail);
dv.container.append(panel);
