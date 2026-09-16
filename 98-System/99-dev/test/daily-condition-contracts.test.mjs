import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Daily Note schema includes mood", () => {
  const template = read("98-System/03-template/01-note/daily-note-template.md");
  const frontmatter = template.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";

  assert.match(frontmatter, /^type: daily-review$/m);
  assert.match(frontmatter, /^condition:\s*$/m);
  assert.match(frontmatter, /^mood:\s*$/m);
  assert.match(template, /\[\[daily-meta\]\]/);
});

test("Morning condition embed exposes a five-level mood selector", () => {
  const meta = read("98-System/02-embed/00-meta/daily-meta.md");
  const mood = meta.match(/\*\*気分:\*\* `INPUT\[inlineSelect\(([\s\S]*?)\):mood\]`/);

  assert.ok(mood, "mood selector must exist");
  assert.match(mood[1], /option\(null, "未入力"\)/);
  assert.match(mood[1], /option\(1, "非常に悪い"\)/);
  assert.match(mood[1], /option\(2, "悪い"\)/);
  assert.match(mood[1], /option\(3, "普通"\)/);
  assert.match(mood[1], /option\(4, "良い"\)/);
  assert.match(mood[1], /option\(5, "非常に良い"\)/);
});
