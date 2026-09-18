import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ACTIVATION_CONVERGENCE_MARKER, LEGACY_SNIPPETS } from "../tools/build-styles.mjs";

const root = process.cwd();
const cssPath = ".obsidian/snippets/obsidian-core-mobile.css";
const portablePath = "98-System/90-config/styles/obsidian-core-mobile.css";
const css = fs.readFileSync(path.join(root, cssPath), "utf8");
const portableCss = fs.readFileSync(path.join(root, portablePath), "utf8");
const appearance = JSON.parse(fs.readFileSync(path.join(root, ".obsidian/appearance.json"), "utf8"));
const convergence = fs.existsSync(path.join(root, ACTIVATION_CONVERGENCE_MARKER))
  ? JSON.parse(fs.readFileSync(path.join(root, ACTIVATION_CONVERGENCE_MARKER), "utf8"))
  : null;

const metadataClasses = [
  "note-lifecycle-button",
  "workspace-lifecycle-button",
  "task-status-button",
  "task-priority-button",
  "entity-priority-button",
  "project-status-button",
  "knowledge-status-button",
  "knowledge-maturity-button",
];

test("mobile override is mirrored byte-for-byte to the normal Vault-sync path", () => {
  assert.equal(css, portableCss);
});

test("mobile override activation is canonical outside explicit appearance convergence", () => {
  if (convergence) {
    assert.deepEqual(convergence.observed_managed_snippets, LEGACY_SNIPPETS);
    assert.deepEqual(appearance.enabledCssSnippets, convergence.observed_managed_snippets);
    assert.equal(appearance.enabledCssSnippets.includes("obsidian-core"), false);
    assert.equal(appearance.enabledCssSnippets.includes("obsidian-core-mobile"), false);
    return;
  }

  assert.deepEqual(appearance.enabledCssSnippets, ["obsidian-core", "obsidian-core-mobile"]);
  for (const legacy of LEGACY_SNIPPETS) {
    assert.equal(appearance.enabledCssSnippets.includes(legacy), false);
  }
});

test("Dashboard action groups remain one horizontal row and scroll instead of wrapping", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /\.mb-button-group:has\(> \.mb-button\.oc-action\)[\s\S]*?flex-wrap:\s*nowrap\s*!important/);
  assert.match(css, /\.mb-button-group:has\(> \.mb-button\.oc-action\)[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /> \.mb-button\.oc-action[\s\S]*?flex:\s*0 0 auto/);
  assert.match(css, /\.mb-button\.oc-action > button[\s\S]*?white-space:\s*nowrap/);
});

test("Mobile Home HUB links remain one row without changing their destinations", () => {
  for (const target of ["11-Knowledge/hub", "02-Memo/hub", "10-Project/hub"]) {
    assert.ok(css.includes(`data-href="${target}"`));
  }
  assert.match(css, /\.markdown-preview-view\.mobile-home p:has[\s\S]*?flex-wrap:\s*nowrap/);
  assert.match(css, /\.markdown-preview-view\.mobile-home p:has[\s\S]*?overflow-x:\s*auto/);
});

test("fixed metadata control grids keep compact single-line labels on phone widths", () => {
  for (const className of metadataClasses) assert.ok(css.includes(`.${className}`));
  assert.match(css, /font-size:\s*clamp\(0\.62rem, 2\.7vw, 0\.78rem\)/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(css, /grid-template-columns/);
});

test("mobile override is presentation-only and offline", () => {
  assert.doesNotMatch(css, /@import|url\s*\(|@font-face|position:\s*fixed/i);
  assert.doesNotMatch(css, /display:\s*(?:grid|block)\s*!important\s*;\s*\/\*\s*replace data/i);
});
