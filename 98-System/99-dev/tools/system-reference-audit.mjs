/** Read-only, bounded static inventory of the public Core checkout.
 * No Obsidian code is evaluated. General findings are candidates for review;
 * --check-interfaces gates only the explicitly registered public entrypoints.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REGISTRY = "98-System/99-dev/setup/system-interfaces.json";
const MANIFEST = "98-System/99-dev/setup/automation-manifest.json";
const ROOTS = ["00-command", "01-script", "02-embed", "03-template", "04-view", "05-lib", "90-config"]
  .map(name => `98-System/${name}/`);
const CONFIGS = new Set([MANIFEST, ".obsidian/appearance.json", ".obsidian/daily-notes.json", ".obsidian/app.json"]);
const MAX_FILES = 4096;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL = 32 * 1024 * 1024;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const safePath = value => typeof value === "string" && value.length > 0 &&
  !/[\\\x00-\x1f\x7f]/.test(value) && !value.startsWith("/") &&
  value.split("/").every(part => part && part !== "." && part !== "..");
export const inScope = value => value === "Dashboard.md" || CONFIGS.has(value) ||
  (ROOTS.some(root => value.startsWith(root)) && /\.(?:md|js|json|css)$/.test(value)) ||
  /^\.obsidian\/snippets\/[^/]+\.css$/.test(value);

export function readChecked(root, relativePath) {
  if (!safePath(relativePath)) throw new Error("unsafe_source_path");
  let current = path.resolve(root);
  if (!fs.lstatSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink()) {
    throw new Error("unsafe_source_root");
  }
  const parts = relativePath.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) {
      throw new Error("unsafe_source_path");
    }
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error("source_size_or_type");
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > MAX_BYTES) throw new Error("source_size_or_type");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
  } finally { fs.closeSync(fd); }
}

export function loadTracked(root) {
  const result = spawnSync("git", ["ls-files", "--cached", "-z", "--",
    "Dashboard.md", ...ROOTS, ".obsidian/snippets", ...CONFIGS, REGISTRY],
  { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  if (result.error || result.status !== 0) throw new Error("git_inventory_failed");
  const names = [...new Set(result.stdout.split("\0").filter(Boolean))].sort(compare);
  if (names.length > MAX_FILES || !names.includes(REGISTRY)) throw new Error("missing_registry_or_inventory_limit");
  const files = new Map();
  let total = 0;
  for (const name of names) {
    if (!inScope(name) && name !== REGISTRY) continue;
    const text = readChecked(root, name);
    total += Buffer.byteLength(text);
    if (total > MAX_TOTAL) throw new Error("inventory_size_limit");
    files.set(name, text);
  }
  const registry = JSON.parse(files.get(REGISTRY));
  files.delete(REGISTRY);
  return { files, registry };
}

// A deliberately small lexical scanner, NOT a JS parser/data-flow analyser.
// Strings/comments are masked before recognising literal tp.user calls. Escaped
// strings and template interpolation are reported as dynamic, never evaluated.
export function codeReferences(source, text, startLine = 1) {
  const refs = [];
  const lineAt = index => startLine + text.slice(0, index).split("\n").length - 1;
  const tokens = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
  const literals = new Map();
  const masked = text.replace(tokens, (token, index) => {
    if (!token.startsWith("/")) {
      const value = token.slice(1, -1);
      literals.set(index, { length: token.length, value, dynamic: value.includes("${") || value.includes("\\") });
    }
    return token.replace(/[^\n]/g, " ");
  });
  const consumed = new Set();
  for (const match of masked.matchAll(/\bdv\.(view|io\.load)\s*\(/g)) {
    const rest = text.slice(match.index + match[0].length);
    const offset = match.index + match[0].length + (rest.match(/^\s*/)?.[0].length ?? 0);
    const literal = literals.get(offset);
    consumed.add(offset);
    const end = literal?.length ?? 0;
    const closed = literal && /^\s*[,)]/.test(text.slice(offset + end));
    refs.push({ source, line: lineAt(match.index), kind: match[1] === "view" ? "dataview_view" : "dataview_load",
      target: literal && !literal.dynamic && closed ? literal.value : null });
  }
  for (const match of masked.matchAll(/\btp\.user\.([A-Za-z_$][\w$]*)\b/g)) {
    refs.push({ source, line: lineAt(match.index), kind: "templater_user",
      target: `98-System/01-script/${match[1]}.js` });
  }
  for (const [index, literal] of literals) {
    if (consumed.has(index)) continue;
    if (literal.value.startsWith("98-System/")) {
      refs.push({ source, line: lineAt(index), kind: "code_path_candidate", target: literal.dynamic ? null : literal.value });
    }
  }
  return refs;
}

export function extractReferences(source, text) {
  if (source.endsWith(".js")) return codeReferences(source, text);
  const refs = [];
  if (source.endsWith(".json")) {
    const data = JSON.parse(text);
    function visit(value, pointer = "") {
      if (typeof value === "string" && value.startsWith("98-System/")) {
        refs.push({ source, line: null, pointer, kind: "config_path", target: value });
      } else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${pointer}/${i}`));
      else if (value && typeof value === "object") {
        for (const key of Object.keys(value).sort(compare)) visit(value[key], `${pointer}/${key}`);
      }
    }
    visit(data);
    if (source === ".obsidian/appearance.json") {
      for (const name of data.enabledCssSnippets ?? []) {
        refs.push({ source, line: null, kind: "css_snippet", target: `.obsidian/snippets/${name}.css` });
      }
    }
    if (source === ".obsidian/app.json" && data.openBehavior?.startsWith("file:")) {
      refs.push({ source, line: null, kind: "startup_note", target: data.openBehavior.slice(5) });
    }
    return refs;
  }
  if (!source.endsWith(".md")) return refs;
  let fence = null;
  let code = [];
  const addLinks = (line, number, kind) => {
    for (const match of line.matchAll(/!?\[\[([^\]\n]+)\]\]/g)) {
      refs.push({ source, line: number, kind, target: /<%|\$\{|\{\{/.test(match[1]) ? null : match[1] });
    }
  };
  const flushCode = () => {
    if (code.length) refs.push(...codeReferences(source, code.map(item => item.text).join("\n"), code[0].line));
    code = [];
  };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.replace(/^(?:\s*>\s?)+/, "");
    const marker = line.match(/^\s*(`{3,}|~{3,})([^`~]*)$/);
    if (marker && (!fence || (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()))) {
      flushCode();
      fence = fence ? null : { char: marker[1][0], length: marker[1].length, language: marker[2].trim() };
      continue;
    }
    const language = fence?.language;
    if (language === "meta-bind-embed") addLinks(line, index + 1, "meta_bind_embed");
    else if (language === "meta-bind-button") {
      const field = line.match(/^\s*(templateFile|link):\s*(.*?)\s*$/);
      if (field) {
        const value = field[2].replace(/^(["'])(.*)\1$/, "$2");
        refs.push({ source, line: index + 1, kind: field[1] === "templateFile" ? "meta_bind_template" : "meta_bind_open",
          target: /<%|\$\{|\{\{|\s#/.test(value) ? null : value });
      }
    } else if (["dataviewjs", "dvjs"].includes(language)) code.push({ line: index + 1, text: line });
    else if (!fence) {
      addLinks(line, index + 1, "wikilink_candidate");
      // Templater blocks in .md files can span multiple lines.
      code.push({ line: index + 1, text: line });
    }
  }
  flushCode();
  return refs;
}

export function resolveReference(ref, files) {
  if (ref.target === null) return { ...ref, resolution: "dynamic_unchecked", candidates: [] };
  let target = ref.target.trim();
  if (target.startsWith("[[") && target.endsWith("]]")) target = target.slice(2, -2);
  target = target.split("|")[0];
  const anchor = target.includes("#");
  target = target.split("#")[0];
  const base = { ...ref, anchor_unchecked: anchor, candidates: [] };
  if (!target && anchor) return { ...base, resolution: "same_file_anchor_unchecked" };
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) return { ...base, resolution: "external_url" };
  if (["code_path_candidate", "config_path"].includes(ref.kind)) target = target.replace(/\/$/, "");
  if (!safePath(target)) return { ...base, resolution: "unsafe_or_unsupported_path" };
  const explicit = target.startsWith("98-System/") || target.startsWith(".obsidian/") || target === "Dashboard" || target === "Dashboard.md";
  let options = [target];
  if (ref.kind === "dataview_view") options = [target + ".js", target + "/view.js"];
  else if (!path.posix.extname(target)) {
    options.push(target + ".md");
    if (ref.kind === "code_path_candidate") options.push(target + ".js", target + "/view.js");
  }
  let candidates = options.filter(option => files.has(option));
  if (!explicit && ["meta_bind_embed", "wikilink_candidate", "startup_note", "meta_bind_open"].includes(ref.kind)) {
    candidates = [...files.keys()].filter(name => name.endsWith(".md") &&
      (name === target || name === target + ".md" || name.endsWith("/" + target) || name.endsWith("/" + target + ".md")));
  }
  candidates.sort(compare);
  if (candidates.length > 1) return { ...base, resolution: "ambiguous", candidates };
  if (candidates.length === 1) return { ...base, resolution: "resolved_file", candidates };
  if (["config_path", "code_path_candidate"].includes(ref.kind) &&
      [...files.keys()].some(name => name.startsWith(target.replace(/\/$/, "") + "/"))) {
    return { ...base, resolution: "directory_candidate" };
  }
  return { ...base, resolution: explicit ? "missing_system" : "external_vault_unchecked" };
}

export function checkInterfaces(files, registry) {
  if (!registry || registry.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(registry.baseline_revision ?? "") || !Array.isArray(registry.groups) || !registry.groups.length ||
      Object.keys(registry).some(key => !["schema_version", "baseline_revision", "groups"].includes(key))) {
    throw new Error("invalid_interface_registry");
  }
  const errors = [], notices = [], seen = new Set();
  let count = 0;
  for (const group of registry.groups) {
    if (!group || !["exact", "basename", "user_function"].includes(group.resolution) ||
        !Array.isArray(group.paths) || !group.paths.length || typeof group.consumer !== "string" || !group.consumer.trim() ||
        Object.keys(group).some(key => !["resolution", "consumer", "paths", "known_empty"].includes(key)) ||
        (group.known_empty !== undefined && (!Array.isArray(group.known_empty) ||
          group.known_empty.some(name => !group.paths.includes(name))))) throw new Error("invalid_interface_group");
    for (const name of group.paths) {
      if (!safePath(name) || !inScope(name) || seen.has(name)) throw new Error("invalid_interface_path");
      seen.add(name); count += 1;
      if (!files.has(name)) { errors.push({ path: name, code: "public_interface_missing" }); continue; }
      if (!files.get(name).trim()) {
        (group.known_empty?.includes(name) ? notices : errors).push({ path: name,
          code: group.known_empty?.includes(name) ? "known_empty_command" : "public_interface_empty" });
      }
      if (group.resolution !== "exact") {
        if (group.resolution === "user_function" && (!name.startsWith("98-System/01-script/") || !name.endsWith(".js"))) {
          throw new Error("invalid_user_function_path");
        }
        const matches = [...files.keys()].filter(item =>
          (group.resolution !== "user_function" || item.startsWith("98-System/01-script/")) &&
          path.posix.basename(item).toLowerCase() === path.posix.basename(name).toLowerCase());
        if (matches.length !== 1) errors.push({ path: name, code: "public_interface_name_collision", candidates: matches.sort(compare) });
      }
    }
  }
  return { count, errors, notices };
}

export function audit(files, registry) {
  const interfaces = checkInterfaces(files, registry);
  const names = [...files.keys()].sort(compare);
  const references = names.flatMap(name => extractReferences(name, files.get(name)))
    .map(ref => resolveReference(ref, files));
  const resolutions = {};
  for (const ref of references) resolutions[ref.resolution] = (resolutions[ref.resolution] ?? 0) + 1;
  const incoming = new Set(references.filter(ref => ref.resolution === "resolved_file").flatMap(ref => ref.candidates));
  return { record_version: 1, inspection_only: true, scope: "public_core_tracked_runtime_subset",
    complete_dependency_graph: false, safe_to_delete_unreferenced: false,
    private_vault_checked: false, runtime_resolution_checked: false,
    summary: { files: names.length, references: references.length, resolutions,
      public_interfaces: interfaces.count, interface_errors: interfaces.errors.length },
    interfaces, references,
    files: names.map(name => ({ path: name, bytes: Buffer.byteLength(files.get(name)),
      incoming_static_reference_observed: incoming.has(name) })) };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) {
    console.log("Usage: node 98-System/99-dev/tools/system-reference-audit.mjs [--json] [--check-interfaces]\nRun in a public ObsidianCore checkout. Read-only; no file moves or rewrites.");
    return 0;
  }
  if (argv.some(arg => !["--json", "--check-interfaces"].includes(arg))) {
    console.error("system-reference-audit: invalid_arguments"); return 2;
  }
  try {
    const { files, registry } = loadTracked(process.cwd());
    const report = audit(files, registry);
    if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(JSON.stringify({ ...report.summary, gate: "registered_interfaces_only",
        interface_errors: report.interfaces.errors, interface_notices: report.interfaces.notices }, null, 2));
      for (const ref of report.references.filter(ref => ["missing_system", "ambiguous", "unsafe_or_unsupported_path"].includes(ref.resolution))) {
        console.log(`REVIEW ${ref.source}:${ref.line ?? ref.pointer ?? "config"} ${ref.kind} -> ${ref.target} (${ref.resolution})`);
      }
      console.log("Static candidates only. Private/device/dynamic references and anchor targets are not verified. No deletion advice.");
    }
    return argv.includes("--check-interfaces") && report.interfaces.errors.length ? 1 : 0;
  } catch {
    console.error("system-reference-audit: inventory_failed (check tracked inputs and registry; no source executed)");
    return 2;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
