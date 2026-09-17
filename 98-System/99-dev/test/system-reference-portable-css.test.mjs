import assert from "node:assert/strict";
import test from "node:test";
import { extractReferences, inScope, resolveReference } from "../tools/system-reference-audit.mjs";

const CSS = "98-System/90-config/styles/obsidian-core.css";

test("portable CSS payload is inside the public runtime inventory scope", () => {
  assert.equal(inScope(CSS), true);
  assert.equal(inScope("98-System/90-config/styles/private.bin"), false);
});

test("script and manifest references to the portable CSS resolve to the tracked file", () => {
  const files = new Map([
    [CSS, "/* generated fixture */"],
    ["98-System/01-script/sync_core_style.js", `const SOURCE_PATH = \"${CSS}\";`],
    ["98-System/99-dev/setup/automation-manifest.json", JSON.stringify({ style_distribution: { source: CSS } })],
  ]);
  const refs = [
    ...extractReferences("98-System/01-script/sync_core_style.js", files.get("98-System/01-script/sync_core_style.js")),
    ...extractReferences("98-System/99-dev/setup/automation-manifest.json", files.get("98-System/99-dev/setup/automation-manifest.json")),
  ].filter(ref => ref.target === CSS);
  assert.equal(refs.length, 2);
  for (const ref of refs) {
    const resolved = resolveReference(ref, files);
    assert.equal(resolved.resolution, "resolved_file");
    assert.deepEqual(resolved.candidates, [CSS]);
  }
});
