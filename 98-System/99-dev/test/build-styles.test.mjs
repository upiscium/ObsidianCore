import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  SOURCES,
  OUTPUT,
  OUTPUTS,
  DISTRIBUTION_OUTPUT,
  LEGACY_SNIPPETS,
  buildCss,
  checkActivation,
  checkBundle,
  writeBundle,
  readSource,
  renderPreview,
  main,
} from "../tools/build-styles.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oc-styles-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [i, relative] of SOURCES.entries()) {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `.source-${i} { --value: ${i}; }\r\n`);
  }
  for (const relative of OUTPUTS) fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, ".obsidian/appearance.json"), JSON.stringify({ enabledCssSnippets: ["obsidian-core"] }));
  return root;
}

test("explicit input order and two generated delivery outputs are fixed", () => {
  assert.equal(LEGACY_SNIPPETS.length, 8); assert.equal(SOURCES.length, 11);
  assert.equal(new Set(SOURCES).size, 11);
  assert.ok(SOURCES.at(-1).endsWith("adapters.css"));
  assert.deepEqual(OUTPUTS, [OUTPUT, DISTRIBUTION_OUTPUT]);
  assert.equal(new Set(OUTPUTS).size, 2);
  for (const output of OUTPUTS) assert.ok(!SOURCES.includes(output));
});
test("bundle is deterministic, LF-only and includes each source exactly once", t => {
  const root = fixture(t); const css = buildCss(root);
  assert.equal(css, buildCss(root)); assert.ok(!css.includes("\r"));
  for (const [i, source] of SOURCES.entries()) {
    assert.equal(css.split(`/* SOURCE: ${source} */`).length - 1, 1);
    assert.ok(css.indexOf(`.source-${i}`) > (i ? css.indexOf(`.source-${i - 1}`) : 0));
  }
});
test("check does not create either missing delivery output", t => {
  const root = fixture(t); assert.equal(checkBundle(root), false);
  for (const output of OUTPUTS) assert.equal(fs.existsSync(path.join(root, output)), false);
});
test("write creates byte-identical reproducible outputs without modifying inputs", t => {
  const root = fixture(t); const before = SOURCES.map(s => fs.readFileSync(path.join(root, s)));
  writeBundle(root); assert.equal(checkBundle(root), true);
  const first = fs.readFileSync(path.join(root, OUTPUT));
  assert.deepEqual(fs.readFileSync(path.join(root, DISTRIBUTION_OUTPUT)), first);
  writeBundle(root);
  for (const output of OUTPUTS) assert.deepEqual(fs.readFileSync(path.join(root, output)), first);
  SOURCES.forEach((s, i) => assert.deepEqual(fs.readFileSync(path.join(root, s)), before[i]));
});
test("stale bytes in either delivery output and changed sources fail the read-only check", t => {
  const root = fixture(t); writeBundle(root);
  for (const output of OUTPUTS) {
    writeBundle(root);
    const target = path.join(root, output);
    fs.appendFileSync(target, "\n/* stale */"); const bytes = fs.readFileSync(target);
    assert.equal(checkBundle(root), false); assert.deepEqual(fs.readFileSync(target), bytes);
  }
  writeBundle(root); fs.appendFileSync(path.join(root, SOURCES[0]), "\n.a {}"); assert.equal(checkBundle(root), false);
});
test("single activation permits unrelated private snippets without accepting legacy double loading", t => {
  const root = fixture(t); const file = path.join(root, ".obsidian/appearance.json");
  for (const names of [["obsidian-core"], ["custom-local", "obsidian-core"]]) {
    fs.writeFileSync(file, JSON.stringify({ enabledCssSnippets: names })); assert.doesNotThrow(() => checkActivation(root));
  }
  for (const names of [[], ["obsidian-core", "work-time"], ["obsidian-core", "obsidian-core"], null]) {
    fs.writeFileSync(file, JSON.stringify({ enabledCssSnippets: names })); assert.throws(() => checkActivation(root));
  }
});
for (const value of ["", " \n", "@import 'remote.css';", "a { background: url(https://example.invalid/a); }", "\u0000"]) {
  test(`unsafe/empty CSS fails: ${JSON.stringify(value)}`, t => {
    const root = fixture(t); fs.writeFileSync(path.join(root, SOURCES[0]), value); assert.throws(() => buildCss(root));
  });
}
test("missing input fails instead of silently dropping a legacy layout", t => {
  const root = fixture(t); fs.unlinkSync(path.join(root, SOURCES[0])); assert.throws(() => buildCss(root));
});
test("invalid UTF-8 and oversized source are refused", t => {
  const root = fixture(t); const file = path.join(root, SOURCES[0]);
  fs.writeFileSync(file, Buffer.from([0xff])); assert.throws(() => buildCss(root));
  fs.writeFileSync(file, "x".repeat(512 * 1024 + 1)); assert.throws(() => buildCss(root));
});
test("symlink source is not followed", t => {
  const root = fixture(t); const file = path.join(root, SOURCES[0]); const real = path.join(root, "real.css");
  fs.renameSync(file, real); fs.symlinkSync(real, file); assert.throws(() => buildCss(root));
});
for (const output of OUTPUTS) {
  test(`symlink delivery output is not followed: ${output}`, t => {
    const root = fixture(t); const target = path.join(root, output); const real = `${target}.real`;
    fs.writeFileSync(real, "old"); fs.symlinkSync(real, target); assert.throws(() => writeBundle(root));
  });
}
test("symlink source parent is refused", t => {
  const root = fixture(t); const original = path.join(root, "98-System/99-dev/styles"); const moved = `${original}-real`;
  fs.renameSync(original, moved); fs.symlinkSync(moved, original); assert.throws(() => buildCss(root));
});
test("readSource refuses path traversal", t => {
  const root = fixture(t); assert.throws(() => readSource(root, "../anything.css"));
});
test("preview is static, offline, data-free and explicit about its limitations", t => {
  const root = fixture(t);
  for (const theme of ["dark", "light"]) {
    const html = renderPreview(buildCss(root), theme);
    assert.ok(html.includes(`class="theme-${theme}"`)); assert.match(html, /default-src 'none'/);
    assert.doesNotMatch(html, /<script\b|<link\b|https?:\/\/|on(?:click|load)=/i);
    assert.match(html, /架空のデータ/); assert.match(html, /実描画を保証するものではありません/);
    assert.match(html, /<button type="button"/); assert.match(html, / disabled>/);
  }
  assert.throws(() => renderPreview("", "unknown"));
});
test("CLI check has a nonzero stale result and never fixes it automatically", t => {
  const root = fixture(t); assert.equal(main(["--check"], root), 1);
  for (const output of OUTPUTS) assert.equal(fs.existsSync(path.join(root, output)), false);
  assert.equal(main(["--write"], root), 0); assert.equal(main(["--check"], root), 0);
  assert.equal(main(["--unknown"], root), 1);
});
test("preview refuses an existing destination", t => {
  const root = fixture(t); const output = path.join(root, "preview");
  assert.equal(main(["--preview", output], root), 0);
  const original = fs.readFileSync(path.join(output, "dark.html"));
  assert.equal(main(["--preview", output], root), 1); assert.deepEqual(fs.readFileSync(path.join(output, "dark.html")), original);
});
