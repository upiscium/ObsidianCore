import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_SNIPPETS, checkBundle } from "./build-styles.mjs";

export const MARKER = "98-System/99-dev/design/core-promotion-convergence.json";
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function readRegular(root, relative) {
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${relative} must be a regular file`);
  return fs.readFileSync(absolute);
}

export function readMarker(root) {
  const marker = JSON.parse(readRegular(root, MARKER).toString("utf8"));
  const expectedKeys = [
    "schema_version",
    "mode",
    "checkpoint_core_commit",
    "conflicting_core_head",
    "observed_live_sha256",
    "next_phase",
  ];
  assertSameKeys(marker, expectedKeys, "convergence marker");
  if (marker.schema_version !== 1 || marker.mode !== "live-vault-promotion-convergence") {
    throw new Error("unsupported convergence marker contract");
  }
  for (const [label, value] of [
    ["checkpoint_core_commit", marker.checkpoint_core_commit],
    ["conflicting_core_head", marker.conflicting_core_head],
  ]) {
    if (typeof value !== "string" || !COMMIT_RE.test(value)) throw new Error(`${label} must be a full lowercase commit SHA`);
  }
  if (!marker.observed_live_sha256 || typeof marker.observed_live_sha256 !== "object" || Array.isArray(marker.observed_live_sha256)) {
    throw new Error("observed_live_sha256 must be an object");
  }
  const paths = Object.keys(marker.observed_live_sha256);
  if (paths.length < 1 || paths.length > 32) throw new Error("convergence marker path count is outside bounds");
  for (const relative of paths) {
    if (relative.startsWith("/") || relative.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error(`unsafe convergence path: ${relative}`);
    }
    const digest = marker.observed_live_sha256[relative];
    if (typeof digest !== "string" || !SHA256_RE.test(digest)) throw new Error(`invalid live SHA-256 for ${relative}`);
  }
  if (typeof marker.next_phase !== "string" || !marker.next_phase.trim()) throw new Error("next_phase must explain marker removal");
  return marker;
}

function assertSameKeys(object, keys, label) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} properties do not match contract`);
}

export function verifyConvergence(root) {
  const marker = readMarker(root);
  const checked = [];
  for (const [relative, expected] of Object.entries(marker.observed_live_sha256)) {
    const bytes = readRegular(root, relative);
    const actual = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) throw new Error(`Core file no longer matches observed Live bytes: ${relative}`);
    checked.push(relative);
  }

  if (!(".obsidian/appearance.json" in marker.observed_live_sha256)) {
    throw new Error("convergence marker must bind .obsidian/appearance.json");
  }
  const appearance = JSON.parse(readRegular(root, ".obsidian/appearance.json").toString("utf8"));
  if (JSON.stringify(appearance.enabledCssSnippets) !== JSON.stringify(LEGACY_SNIPPETS)) {
    throw new Error("phase-1 convergence requires the exact observed legacy snippet activation");
  }
  if (!checkBundle(root)) throw new Error("obsidian-core.css must remain reproducible during convergence");
  return { checked: checked.sort(), checkpoint_core_commit: marker.checkpoint_core_commit };
}

export function main(root = process.cwd()) {
  try {
    const result = verifyConvergence(root);
    console.log(JSON.stringify({ result: "promotion_convergence_phase1", ...result }));
    return 0;
  } catch (error) {
    console.error(`Promotion convergence check failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
