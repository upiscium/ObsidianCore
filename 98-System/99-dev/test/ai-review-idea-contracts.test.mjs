import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const U = new Function(
  `"use strict"; return (${read("98-System/01-script/ai_review_idea_utils.js")});`
)();

const CASE = "a".repeat(64);
const PROPOSAL = "b".repeat(64);
const EVALUATION = "c".repeat(64);
const MUTATION = "d".repeat(64);

const candidate = `---
type: knowledge-note
status: active
category: summary
maturity: draft
source_type: self
---

\`\`\`meta-bind-embed
[[knowledge-meta]]
\`\`\`

# Candidate

Body.
`;

const review = `---
type: ai-pipeline-projection
ai_case_id: ${CASE}
ai_stage: review
proposal_sha256: ${PROPOSAL}
mutation_sha256: ${MUTATION}
evaluation_sha256: ${EVALUATION}
target_path: "11-Knowledge/候補.md"
review_request:
---

# Human Review

## Candidate

\`\`\`\`markdown
${candidate.trimEnd()}
\`\`\`\`

## Decision
`;

test("AI Review Idea utility extracts deterministic Candidate bytes", () => {
  const extracted = U.extractCandidateMarkdown(review);
  assert.equal(extracted, candidate.trimEnd());
  assert.equal(U.ideaTitleFromTarget("11-Knowledge/候補.md"), "候補");
  assert.throws(() => U.ideaTitleFromTarget("05-Idea/x.md"));
  assert.throws(() => U.ideaTitleFromTarget("11-Knowledge/a/b.md"));
});

test("Knowledge envelope becomes Idea body without Knowledge metadata editor", () => {
  const body = U.stripKnowledgeEnvelope(candidate);
  assert.equal(body, "# Candidate\n\nBody.\n");
  assert.doesNotMatch(body, /knowledge-meta/);
  assert.doesNotMatch(body, /^---/);
});

test("AI Idea content binds context and provenance", () => {
  const content = U.buildIdeaContent({
    title: "候補",
    created: "2026-09-27",
    workspace: "[[03-Workspace/Research|Research]]",
    project: "[[10-Project/Terreate|Terreate]]",
    caseId: CASE,
    proposalSha256: PROPOSAL,
    evaluationSha256: EVALUATION,
    mutationSha256: MUTATION,
    body: "# Candidate\n\nBody.\n",
  });

  assert.match(content, /^---\ntype: idea$/m);
  assert.ok(content.includes('workspace: "[[03-Workspace/Research|Research]]"'));
  assert.ok(content.includes('project: "[[10-Project/Terreate|Terreate]]"'));
  assert.match(content, /^origin: ai-pipeline$/m);
  assert.match(content, new RegExp(`^ai_case_id: ${CASE}$`, "m"));
  assert.match(content, new RegExp(`^ai_source_proposal_sha256: ${PROPOSAL}$`, "m"));
  assert.match(content, /\[\[idea-meta\]\]/);
  assert.match(content, /# Candidate\n\nBody\./);
});

test("Keep as Idea runtime is fail-closed and updates Review only after Idea creation", () => {
  const source = read("98-System/01-script/keep_ai_candidate_as_idea.js");
  assert.match(source, /frontmatter\.type !== "ai-pipeline-projection"/);
  assert.match(source, /frontmatter\.ai_stage !== "review"/);
  assert.match(source, /activeFile\.path\.startsWith\("04-AI\/50-Review\/"\)/);
  assert.match(source, /folder: "03-Workspace"/);
  assert.doesNotMatch(source, /Workspaceを設定しない/);
  assert.match(source, /app\.vault\.create\(ideaPath, content\)/);
  assert.match(source, /fm\.review_request = "keep_as_idea"/);
  assert.ok(
    source.indexOf("app.vault.create(ideaPath, content)")
      < source.indexOf('fm.review_request = "keep_as_idea"')
  );
  assert.match(source, /ai_source_proposal_sha256/);
  assert.match(source, /app\.vault\.delete\(ideaFile\)/);
});

test("Approve and Reject use direct persistent metadata actions", () => {
  const button = read("98-System/02-embed/01-button/ai-review-buttons.md");

  const approve = button.match(
    /```meta-bind-button\nid: approve-ai-candidate[\s\S]*?```/
  )?.[0];
  const reject = button.match(
    /```meta-bind-button\nid: reject-ai-candidate[\s\S]*?```/
  )?.[0];

  assert.ok(approve);
  assert.ok(reject);

  for (const [block, value] of [
    [approve, "approve"],
    [reject, "reject"],
  ]) {
    assert.match(block, /type: updateMetadata/);
    assert.match(block, /bindTarget: review_request/);
    assert.match(block, /evaluate: false/);
    assert.match(block, new RegExp(`value: ${value}`));
    assert.doesNotMatch(block, /runTemplaterFile|inlineJS|type: js/);
  }
});

test("Keep as Idea public surfaces are registered", () => {
  const registry = JSON.parse(read("98-System/99-dev/setup/system-interfaces.json"));
  const paths = new Set(registry.groups.flatMap(group => group.paths ?? []));
  for (const expected of [
    "98-System/00-command/keep_ai_candidate_as_idea.md",
    "98-System/01-script/keep_ai_candidate_as_idea.js",
    "98-System/02-embed/01-button/ai-review-buttons.md",
  ]) {
    assert.equal(paths.has(expected), true, expected);
  }

  const button = read("98-System/02-embed/01-button/ai-review-buttons.md");
  assert.match(button, /id: approve-ai-candidate/);
  assert.match(button, /id: reject-ai-candidate/);
  assert.match(button, /id: keep-ai-candidate-as-idea/);
  assert.doesNotMatch(button, /approve_ai_candidate\.md|reject_ai_candidate\.md/);
  assert.match(button, /keep_ai_candidate_as_idea\.md/);
});
