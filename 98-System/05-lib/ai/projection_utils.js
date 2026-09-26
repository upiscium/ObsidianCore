(() => {
  const PROJECTION_ROOTS = Object.freeze(["04-AI", "03-AI"]);

  const STAGE_ORDER = {
    input: 10,
    context: 20,
    generation: 30,
    validation: 40,
    evaluation: 50,
    review: 60,
    execution: 70,
    transport: 80,
    completed: 90,
    failed: 100,
  };

  const PROCESSING = new Set(["input", "context", "generation", "validation", "evaluation"]);
  const DELIVERY = new Set(["execution", "transport"]);

  function stageOrder(value) {
    const key = String(value ?? "").trim();
    return Object.prototype.hasOwnProperty.call(STAGE_ORDER, key)
      ? STAGE_ORDER[key]
      : -1;
  }

  function validCase(page) {
    const id = String(page?.ai_case_id ?? "").trim();
    const stage = String(page?.ai_stage ?? "").trim();
    return /^[0-9a-f]{64}$/.test(id) && stageOrder(stage) >= 0;
  }

  function compareProjection(a, b, dv) {
    const stage = stageOrder(a?.ai_stage) - stageOrder(b?.ai_stage);
    if (stage !== 0) return stage;
    const time = dv.compare(a?.file?.mtime ?? null, b?.file?.mtime ?? null);
    if (time !== 0) return time;
    return dv.compare(a?.file?.path ?? "", b?.file?.path ?? "");
  }

  function projectionPages(dv) {
    return PROJECTION_ROOTS.flatMap(root => Array.from(dv.pages(`"${root}"`)));
  }

  function latestByCase(pages, dv) {
    const latest = new Map();
    for (const page of pages) {
      if (!validCase(page)) continue;
      const id = String(page.ai_case_id);
      const previous = latest.get(id);
      if (!previous || compareProjection(previous, page, dv) < 0) latest.set(id, page);
    }
    return Array.from(latest.values());
  }

  function stateOf(page) {
    if (!validCase(page)) return "unknown";
    const stage = String(page.ai_stage);
    if (stage === "failed" || page?.validation_result === "rejected") return "failed";
    if (stage === "completed") return "completed";
    if (stage === "review") return "review";
    if (DELIVERY.has(stage)) return "delivery";
    if (PROCESSING.has(stage)) return "processing";
    return "unknown";
  }

  function stateLabel(page) {
    const stage = String(page?.ai_stage ?? "");
    if (page?.validation_result === "rejected") return "Validation rejected";
    return {
      input: "Input",
      context: "Context",
      generation: "Generation",
      validation: "Validation",
      evaluation: "Evaluation",
      review: "Review",
      execution: "Execution",
      transport: "Transport",
      completed: "Completed",
      failed: "Failed",
    }[stage] ?? stage ?? "▫️";
  }

  return { PROJECTION_ROOTS, stageOrder, projectionPages, latestByCase, stateOf, stateLabel };
})()
