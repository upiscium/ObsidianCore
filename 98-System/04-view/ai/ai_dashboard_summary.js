const roots = {
  processing: [
    "03-AI/00-Input",
    "03-AI/10-Context",
    "03-AI/20-Generation",
    "03-AI/30-Validation",
    "03-AI/40-Evaluation",
  ],
  review: ["03-AI/50-Review"],
  failed: ["03-AI/90-Failed"],
  completed: ["03-AI/80-Completed"],
};

function pagesBelow(path) {
  return Array.from(dv.pages(`"${path}"`));
}

function uniquePages(paths) {
  const seen = new Map();
  for (const path of paths) {
    for (const page of pagesBelow(path)) {
      if (page?.file?.path) seen.set(page.file.path, page);
    }
  }
  return Array.from(seen.values());
}

const counts = Object.fromEntries(
  Object.entries(roots).map(([key, paths]) => [key, uniquePages(paths).length])
);

dv.table(
  ["Processing", "Review", "Failed", "Completed"],
  [[counts.processing, counts.review, counts.failed, counts.completed]]
);
