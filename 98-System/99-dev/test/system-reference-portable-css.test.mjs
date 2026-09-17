import assert from "node:assert/strict";
import test from "node:test";
import { extractReferences, inScope, resolveReference } from "../tools/system-reference-audit.mjs";

const BASE = "98-System/90-config/styles/obsidian-core.css";
const MOBILE = "98-System/90-config/styles/obsidian-core-mobile.css";

test("portable Core CSS payloads are inside the public runtime inventory scope", () => {
  assert.equal(inScope(BASE), true);
  assert.equal(inScope(MOBILE), true);
  assert.equal(inScope("98-System/90-config/styles/private.bin"), false);
});

test("script and manifest references to both portable CSS files resolve to tracked files", () => {
  const files = new Map([
    [BASE, "/* generated fixture */"],
    [MOBILE, "/* mobile fixture */"],
    ["98-System/01-script/sync_core_style.js", `const SOURCE_PATH = \"${BASE}\"; const MOBILE_SOURCE_PATH = \"${MOBILE}\";`],
    ["98-System/99-dev/setup/automation-manifest.json", JSON.stringify({
      style_distribution: { source: BASE, responsive_source: MOBILE },
    })],
  ]);

  for (const target of [BASE, MOBILE]) {
    const refs = [
      ...extractReferences("98-System/01-script/sync_core_style.js", files.get("98-System/01-script/sync_core_style.js")),
      ...extractReferences("98-System/99-dev/setup/automation-manifest.json", files.get("98-System/99-dev/setup/automation-manifest.json")),
    ].filter(ref => ref.target === target);
    assert.equal(refs.length, 2, target);
    for (const ref of refs) {
      const resolved = resolveReference(ref, files);
      assert.equal(resolved.resolution, "resolved_file");
      assert.deepEqual(resolved.candidates, [target]);
    }
  }
});
