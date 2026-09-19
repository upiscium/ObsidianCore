const TASK_ROOT = "02-Task/";
const CANONICAL_META_TARGET = "98-System/02-embed/00-meta/task-note-meta|task-note-meta";
const CANONICAL_META_EMBED = [
  "```meta-bind-embed",
  `[[${CANONICAL_META_TARGET}]]`,
  "```"
].join("\n");

const LEGACY_TOKENS = Object.freeze([
  "[[status-dropdown]]",
  "[[priority-dropdown]]",
  "[[task-status-dropdown]]"
]);

const LEGACY_BLOCKS = Object.freeze([
  [
    "> [!info] 管理",
    "> ```meta-bind-embed",
    "> [[status-dropdown]]",
    "> ```",
    "> ```meta-bind-embed",
    "> [[priority-dropdown]]",
    "> ```",
    "> **Start:** `INPUT[datePicker:start]`",
    "> **Scheduled:** `INPUT[datePicker:scheduled]`",
    "> **Due:** `INPUT[datePicker:due]`",
    "> **Workspace:** `INPUT[text:workspace]`",
    "> **Project:** `INPUT[text:project]`"
  ].join("\n"),
  [
    "> [!info] メタデータ管理",
    "> ```meta-bind-embed",
    "> [[task-status-dropdown]]",
    "> ```",
    "> ```meta-bind-embed",
    "> [[priority-dropdown]]",
    "> ```",
    "> **Start:** `INPUT[datePicker:start]`",
    "> **Scheduled:** `INPUT[datePicker:scheduled]`",
    "> **Due:** `INPUT[datePicker:due]`",
    "> **Workspace:** `INPUT[text:workspace]`",
    "> **Project:** `INPUT[text:project]`"
  ].join("\n"),
  [
    "> [!info] 管理",
    "> ```meta-bind-embed",
    "> [[task-status-dropdown]]",
    "> ```",
    "> ```meta-bind-embed",
    "> [[priority-dropdown]]",
    "> ```",
    "> **Start:** `INPUT[datePicker:start]`",
    "> **Scheduled:** `INPUT[datePicker:scheduled]`",
    "> **Due:** `INPUT[datePicker:due]`",
    "> **Workspace:** `INPUT[text:workspace]`",
    "> **Project:** `INPUT[text:project]`"
  ].join("\n")
]);

function normalize(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function hasLegacyReference(content) {
  const source = normalize(content);
  return LEGACY_TOKENS.some(token => source.includes(token));
}

function isTaskFile(file, frontmatter) {
  return Boolean(
    file?.extension === "md" &&
    String(file.path ?? "").startsWith(TASK_ROOT) &&
    ["task", "task-pack"].includes(String(frontmatter?.type ?? ""))
  );
}

function splitLegacyCallouts(content) {
  const source = normalize(content);
  const lines = source.split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^> \[!info\]-? (?:管理|メタデータ管理)\s*$/.test(lines[index])) continue;

    let end = index + 1;
    while (end < lines.length && /^>/.test(lines[end])) end += 1;

    const block = lines.slice(index, end).join("\n").trimEnd();
    if (!LEGACY_TOKENS.some(token => block.includes(token))) continue;
    blocks.push({ start: index, end, block });
    index = end - 1;
  }

  return { source, lines, blocks };
}

function isKnownLegacyBlock(block) {
  const normalized = normalize(block).trimEnd();
  return LEGACY_BLOCKS.some(candidate => normalize(candidate).trimEnd() === normalized);
}

function ensureCanonicalMeta(content) {
  const source = normalize(content);
  if (
    source.includes(`[[${CANONICAL_META_TARGET}]]`) ||
    source.includes("[[task-note-meta]]")
  ) {
    return source;
  }

  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n?/);
  if (frontmatter) {
    const end = frontmatter[0].length;
    const prefix = source.slice(0, end).replace(/\n?$/, "\n");
    const rest = source.slice(end).replace(/^\n*/, "");
    return `${prefix}${CANONICAL_META_EMBED}\n${rest ? "\n" + rest : ""}`;
  }

  return `${CANONICAL_META_EMBED}\n\n${source}`;
}

function migrateContent(content) {
  const { lines, blocks } = splitLegacyCallouts(content);
  if (blocks.length === 0) {
    return {
      changed: false,
      content: normalize(content),
      legacyBlocks: 0,
      unknownBlocks: [],
      residualLegacy: hasLegacyReference(content)
    };
  }

  const unknownBlocks = blocks.filter(({ block }) => !isKnownLegacyBlock(block));
  if (unknownBlocks.length > 0) {
    return {
      changed: false,
      content: normalize(content),
      legacyBlocks: blocks.length,
      unknownBlocks,
      residualLegacy: true
    };
  }

  const remove = new Set();
  for (const { start, end } of blocks) {
    for (let index = start; index < end; index += 1) remove.add(index);
  }

  let next = lines.filter((_line, index) => !remove.has(index)).join("\n");
  next = next.replace(/^\n+/, "");
  next = ensureCanonicalMeta(next);

  const residualLegacy = hasLegacyReference(next);
  return {
    changed: normalize(next) !== normalize(content),
    content: next,
    legacyBlocks: blocks.length,
    unknownBlocks: [],
    residualLegacy
  };
}

async function migrateTaskMetadataUiCurrent(tp, context = {}) {
  const runtimeApp = context.app ?? globalThis.app;
  const NoticeCtor = context.Notice ?? globalThis.Notice;

  if (!runtimeApp?.vault?.getMarkdownFiles
      || typeof runtimeApp.vault.read !== "function"
      || typeof runtimeApp.vault.modify !== "function"
      || !runtimeApp?.metadataCache?.getFileCache) {
    throw new Error("Task metadata UI migration requires Vault read/modify and metadata cache");
  }

  const candidates = [];
  const refused = [];

  for (const file of runtimeApp.vault.getMarkdownFiles()) {
    if (!String(file.path ?? "").startsWith(TASK_ROOT)) continue;

    const current = await runtimeApp.vault.read(file);
    if (!hasLegacyReference(current)) continue;

    const frontmatter = runtimeApp.metadataCache.getFileCache(file)?.frontmatter ?? {};
    if (!isTaskFile(file, frontmatter)) {
      refused.push({ path: file.path, reason: "legacy-reference-in-non-task" });
      continue;
    }

    const result = migrateContent(current);
    if (result.unknownBlocks.length > 0) {
      refused.push({ path: file.path, reason: "unknown-legacy-callout" });
      continue;
    }
    if (result.residualLegacy) {
      refused.push({ path: file.path, reason: "residual-legacy-reference" });
      continue;
    }
    if (result.changed) {
      candidates.push({ file, current, next: result.content, legacyBlocks: result.legacyBlocks });
    }
  }

  if (refused.length > 0) {
    if (NoticeCtor) {
      new NoticeCtor(
        `Task metadata UI移行を中止: 未知形式 ${refused.length}件。変更は行っていません。`
      );
    }
    console.warn("Task metadata UI migration refused files:", refused);
    return {
      updated: 0,
      matched: candidates.length,
      legacyBlocks: 0,
      refused,
      cancelled: false,
      failures: []
    };
  }

  if (candidates.length === 0) {
    if (NoticeCtor) new NoticeCtor("Task metadata UI移行: 対象なし。");
    return {
      updated: 0,
      matched: 0,
      legacyBlocks: 0,
      refused: [],
      cancelled: false,
      failures: []
    };
  }

  const confirm = context.confirm ?? (async paths => {
    if (typeof tp?.system?.suggester !== "function") {
      throw new Error("Task metadata UI migration requires Templater suggester confirmation");
    }
    return await tp.system.suggester(
      ["既知のlegacy Task metadata UIを現行UIへ移行", "キャンセル"],
      [true, false],
      false,
      `対象Task: ${paths.length}件`
    );
  });

  const approved = await confirm(candidates.map(item => item.file.path));
  if (approved !== true) {
    if (NoticeCtor) new NoticeCtor("Task metadata UI移行をキャンセルしました。");
    return {
      updated: 0,
      matched: candidates.length,
      legacyBlocks: candidates.reduce((sum, item) => sum + item.legacyBlocks, 0),
      refused: [],
      cancelled: true,
      failures: []
    };
  }

  let updated = 0;
  let legacyBlocks = 0;
  const failures = [];

  for (const item of candidates) {
    try {
      await runtimeApp.vault.modify(item.file, item.next);
      updated += 1;
      legacyBlocks += item.legacyBlocks;
    } catch (error) {
      console.error(`Task metadata UI migration failed: ${item.file.path}`, error);
      failures.push(item.file.path);
    }
  }

  if (NoticeCtor) {
    new NoticeCtor(
      `Task metadata UI移行: 更新 ${updated} / legacy callout ${legacyBlocks} / 失敗 ${failures.length}`
    );
  }

  return {
    updated,
    matched: candidates.length,
    legacyBlocks,
    refused: [],
    cancelled: false,
    failures
  };
}

module.exports = migrateTaskMetadataUiCurrent;
module.exports.LEGACY_BLOCKS = LEGACY_BLOCKS;
module.exports.LEGACY_TOKENS = LEGACY_TOKENS;
module.exports.CANONICAL_META_EMBED = CANONICAL_META_EMBED;
module.exports.hasLegacyReference = hasLegacyReference;
module.exports.migrateContent = migrateContent;
module.exports.isTaskFile = isTaskFile;
