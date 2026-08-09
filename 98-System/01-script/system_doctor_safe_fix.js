module.exports = async function systemDoctorSafeFix(tp) {
  if (!tp?.system?.suggester) throw new Error("Templater suggester is required");

  const G = await loadExpression("98-System/01-script/reference_utils.js");
  const safeFixFactory = await loadExpression("98-System/01-script/system_doctor_safe_fix_utils.js");
  const F = safeFixFactory(G);
  const validateVault = await loadCommonJs("98-System/01-script/validate_vault.js");

  const before = await validateVault(tp);
  const records = app.vault.getMarkdownFiles()
    .map(file => ({
      file,
      parentPath: file.parent?.path ?? null,
      fm: app.metadataCache.getFileCache(file)?.frontmatter ?? {}
    }))
    .filter(record => ["workspace", "project", "workspace-note", "project-note", "task"].includes(record.fm.type));

  const fixes = F.planSafeFixes({
    records,
    doctorIssues: before.issues,
    makeLink: (target, sourcePath) => app.fileManager.generateMarkdownLink(
      target.file,
      sourcePath,
      undefined,
      String(target.fm.title ?? target.file.basename)
    )
  });

  if (fixes.length === 0) {
    new Notice("System Doctor: 安全に自動修正できる候補はありません。");
    return { planned: 0, applied: 0, stale: 0, errors: [], before: before.summary, after: before.summary };
  }

  const allChoice = { mode: "all" };
  const choices = [allChoice, ...fixes.map(fix => ({ mode: "one", fix }))];
  const labels = [
    `✅ 安全候補を全件適用 (${fixes.length}件)`,
    ...fixes.map(previewLabel)
  ];

  const selected = await tp.system.suggester(labels, choices, false, "System Doctor Safe Fix — before / afterを確認");
  if (!selected) return { planned: fixes.length, applied: 0, stale: 0, errors: [], cancelled: true, before: before.summary };

  const selectedFixes = selected.mode === "all" ? fixes : [selected.fix];
  const confirmed = await tp.system.suggester(
    ["適用する", "キャンセル"],
    [true, false],
    false,
    `${selectedFixes.length}件の安全修正をFrontMatterへ適用しますか？`
  );
  if (!confirmed) return { planned: fixes.length, applied: 0, stale: 0, errors: [], cancelled: true, before: before.summary };

  let applied = 0;
  let stale = 0;
  const errors = [];

  for (const fix of selectedFixes) {
    const file = app.vault.getAbstractFileByPath(fix.path);
    if (!file || file.extension !== "md") {
      errors.push(`${fix.path}: ファイルが見つかりません`);
      continue;
    }

    try {
      let changed = false;
      await app.fileManager.processFrontMatter(file, frontmatter => {
        changed = F.applySafeFixToFrontmatter(frontmatter, fix);
      });
      if (changed) applied += 1;
      else stale += 1;
    } catch (error) {
      errors.push(`${fix.path} ${fix.field}: ${error.message}`);
    }
  }

  const after = await validateVault(tp);
  console.log("System Doctor Safe Fix", { planned: fixes, selected: selectedFixes, applied, stale, errors, before: before.summary, after: after.summary });
  if (errors.length) console.table(errors.map(message => ({ message })));

  new Notice(
    `Safe Fix: ${applied}件適用 / ${stale}件競合skip / ${errors.length}件エラー。` +
    ` Doctor: error ${before.summary.errors}→${after.summary.errors}, warning ${before.summary.warnings}→${after.summary.warnings}`
  );

  return {
    planned: fixes.length,
    selected: selectedFixes.length,
    applied,
    stale,
    errors,
    before: before.summary,
    after: after.summary
  };

  function previewLabel(fix) {
    return `${fix.path} | ${fix.field} | ${displayValue(fix.before)} → ${displayValue(fix.after)} | ${fix.reason}`;
  }

  function displayValue(value) {
    if (value === null || value === undefined || value === "") return "(未設定)";
    return String(value);
  }
};

async function loadExpression(path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Utilityが見つかりません: ${path}`);
  return new Function(`"use strict"; return (${await app.vault.read(file)});`)();
}

async function loadCommonJs(path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || file.extension !== "js") throw new Error(`Scriptが見つかりません: ${path}`);
  const source = await app.vault.read(file);
  const module = { exports: {} };
  new Function("module", "exports", source)(module, module.exports);
  if (typeof module.exports !== "function") throw new Error(`CommonJS scriptではありません: ${path}`);
  return module.exports;
}
