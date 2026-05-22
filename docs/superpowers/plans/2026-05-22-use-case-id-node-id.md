# Use Case ID → Node ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the default `xProxy-UseCase-ID` expression in `n8n-nodes-payi` from `provider/model/executionId` to `$nodeId` so each canvas node aggregates as a single Pay-i use case across runs.

**Architecture:** Single-line default change in `nodes/Payi/descriptions/trackingFields.ts`. Six consuming node files (`Payi.node.ts`, `PayiChatModel*.node.ts`) need no edits — they read `useCaseId` via `getNodeParameter` and the default resolves at execution time via n8n's expression engine. The `providerName` and `modelParam` parameters of `createTrackingFields()` stay in place for future per-provider customization. Patch version bump (`1.0.1 → 1.0.2`). Three docs reference the old default and need updating.

**Tech Stack:** TypeScript ~5.5, n8n-workflow API, eslint 10 (flat config), prettier 3.3, npm pack for local install verification.

**Spec:** `docs/superpowers/specs/2026-05-22-use-case-id-node-id-design.md`

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `nodes/Payi/descriptions/trackingFields.ts` | Modify | Change default expression + description for `useCaseId` |
| `package.json` | Modify | Bump `version` to `1.0.2` |
| `CHANGELOG.md` | Modify | Add user-facing entry under `[Unreleased] → Changed` |
| `README.md` | Modify | Update Use Case ID default in tracking-headers table (line ~94) |
| `docs/deployment-guide.md` | Modify | Update Use Case ID row description (line ~305) |
| `docs/providers/openai.md` | Modify | Update default in headers table (line ~69) |

No new files. No tests (repo has no test runner; verification is via `npm run build`, `npm run lint`, and manual `npm pack` install into local n8n).

---

## Task 1: Update the default expression in `trackingFields.ts`

**Files:**
- Modify: `nodes/Payi/descriptions/trackingFields.ts:32-38`

- [ ] **Step 1: Open the file and locate the `useCaseId` field**

The `useCaseId` field is the third entry returned by `createTrackingFields()`. Current shape:

```ts
{
    displayName: 'Use Case ID',
    name: 'useCaseId',
    type: 'string',
    default: `={{ '${providerName}/' + $parameter.${modelParam} + '/' + $execution.id }}`,
    description:
        'Unique identifier for this use case instance. Defaults to provider/model/executionId.',
},
```

- [ ] **Step 2: Replace the default and description**

```ts
{
    displayName: 'Use Case ID',
    name: 'useCaseId',
    type: 'string',
    default: `={{ $nodeId }}`,
    description:
        'Unique identifier for this use case instance. Defaults to the n8n node ID — all runs of the same node aggregate under one Pay-i use case.',
},
```

Notes:
- The template literal stays a template literal so the surrounding `createTrackingFields(providerName, modelParam)` parameters keep compiling without TypeScript "unused parameter" warnings (they remain referenced via the function signature). If your linter still flags them, leave the function signature alone — Option A from the spec keeps them reserved for future use.
- `$nodeId` is the n8n top-level expression variable that resolves to the currently-executing node's UUID (verified in `n8n-workflow/dist/cjs/workflow-data-proxy.js:1263`).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: exits with status `0`, no errors.

If lint complains about `providerName` / `modelParam` being unused (`@typescript-eslint/no-unused-vars`): they're still referenced in the JSDoc comment block above the function and the function signature is part of the public shape consumed by 6 callers. Add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` only if the lint is genuinely failing — do not change the signature.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: exits with status `0`, `dist/nodes/Payi/descriptions/trackingFields.js` updated.

- [ ] **Step 5: Verify the compiled output contains the new default**

Run: `grep -n "nodeId" dist/nodes/Payi/descriptions/trackingFields.js`
Expected: at least one match showing `$nodeId` in the compiled JS.

- [ ] **Step 6: Commit**

```bash
git add nodes/Payi/descriptions/trackingFields.ts
git commit -m "feat: default Use Case ID to \$nodeId for per-node aggregation"
```

---

## Task 2: Bump version to 1.0.2

**Files:**
- Modify: `package.json:3`

- [ ] **Step 1: Edit `package.json`**

Change:
```json
"version": "1.0.1",
```
to:
```json
"version": "1.0.2",
```

- [ ] **Step 2: Verify**

Run: `grep '"version"' package.json`
Expected output: `"version": "1.0.2",`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump to 1.0.2"
```

---

## Task 3: Add CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md:7` (under `## [Unreleased]`)

- [ ] **Step 1: Insert a `### Changed` block under `## [Unreleased]`**

Replace:

```markdown
## [Unreleased]

## [0.3.1] - 2026-05-12
```

with:

```markdown
## [Unreleased]

### Changed
- **Use Case ID default is now the n8n node ID.** New Pay-i nodes added to a workflow default `xProxy-UseCase-ID` to `={{ $nodeId }}` (a stable UUID per canvas node) instead of `provider/model/executionId`. This makes a single canvas node behave as one Pay-i use case across all of its executions, so cost and KPI data aggregate cleanly per logical step. Existing nodes in saved workflows keep their old expression and are unaffected — clear the Use Case ID field on a node to pick up the new default. Use Case Name (workflow name) and Use Case Step (node name) are unchanged.

## [0.3.1] - 2026-05-12
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for node-id Use Case ID default"
```

---

## Task 4: Update README tracking-headers table

**Files:**
- Modify: `README.md:94`

- [ ] **Step 1: Locate the `xProxy-UseCase-ID` row in the tracking-headers table**

Current line:
```markdown
| **xProxy-UseCase-ID** | `{provider}/{model}/{executionId}` | Unique instance ID for grouping requests |
```

- [ ] **Step 2: Replace with the new default**

```markdown
| **xProxy-UseCase-ID** | `{nodeId}` (UUID) | Stable per-node ID — all runs of one canvas node aggregate under one use case |
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): reflect new Use Case ID default"
```

---

## Task 5: Update deployment guide

**Files:**
- Modify: `docs/deployment-guide.md:305`

- [ ] **Step 1: Locate the Use Case ID row in the tracking-fields table**

Current line:
```markdown
| Use Case ID | `useCaseId` | Tags a specific execution instance | Defaults to the n8n execution ID — override only when you need a correlation ID from an external system |
```

- [ ] **Step 2: Replace**

```markdown
| Use Case ID | `useCaseId` | Identifies the logical use case (one canvas node = one use case) | Defaults to `{{ $nodeId }}` — the node's stable UUID. Override only when you need a correlation ID from an external system |
```

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs(deployment): reflect new Use Case ID default"
```

---

## Task 6: Update OpenAI provider doc

**Files:**
- Modify: `docs/providers/openai.md:69`

- [ ] **Step 1: Locate the Use Case ID row**

Current line:
```markdown
| `xProxy-UseCase-ID` | Use Case ID | `openai/{model}/{executionId}` |
```

- [ ] **Step 2: Replace**

```markdown
| `xProxy-UseCase-ID` | Use Case ID | `{nodeId}` (UUID, stable per canvas node) |
```

- [ ] **Step 3: Check the other provider docs for the same pattern**

Run: `grep -n "executionId" docs/providers/*.md`
Expected: only `docs/providers/openai.md` should have referenced the executionId default in the table form. The other provider docs use generic `{useCaseId}` placeholders that remain valid. If any other provider doc shows the old format, update with the same replacement pattern.

- [ ] **Step 4: Commit**

```bash
git add docs/providers/
git commit -m "docs(providers): reflect new Use Case ID default"
```

---

## Task 7: Final build + lint sanity check

- [ ] **Step 1: Clean rebuild**

Run: `rm -rf dist && npm run build`
Expected: exits `0`. `dist/` is regenerated.

- [ ] **Step 2: Run lint across the whole project**

Run: `npm run lint`
Expected: exits `0`.

- [ ] **Step 3: Confirm `package.json` and compiled JS agree on the new default**

Run:
```bash
grep '"version"' package.json
grep "nodeId" dist/nodes/Payi/descriptions/trackingFields.js
```
Expected: version reads `1.0.2`. The grep for `nodeId` returns at least one line.

If either check fails, do not proceed to packaging. Stop and investigate.

---

## Task 8: Local install + manual verification

This task validates the change against a running n8n instance. It cannot be automated and is intentionally a manual smoke test.

- [ ] **Step 1: Pack**

Run: `npm pack`
Expected: produces `n8n-nodes-payi-1.0.2.tgz` in the project root.

- [ ] **Step 2: Install into local n8n**

Run:
```bash
cd ~/.n8n/nodes && npm install /Users/swharr/src/pay-i-instrumentation/n8n-nodes-payi/n8n-nodes-payi-1.0.2.tgz
rm -rf ~/.n8n/.cache
```

Restart n8n.

- [ ] **Step 3: Visual verification — new node**

In the n8n editor, add a fresh **Pay-i Chat Model** node to a new or existing workflow. Open its parameters. Confirm:
- The "Use Case ID" field shows `={{ $nodeId }}` as the placeholder/default
- The "Use Case Name" field still shows `={{ $workflow.name.replaceAll(' ', '-') }}`
- The "Use Case Step" field still shows `={{ $node.name }}`

If any of those three are wrong, stop and investigate.

- [ ] **Step 4: Execution verification**

Run a workflow that exercises the Pay-i Chat Model node. Confirm via Pay-i dashboard or proxy logs that the outgoing request includes `xProxy-UseCase-ID: <a UUID>` matching the n8n node ID for that node.

How to read the node ID from n8n: in the editor, with the node selected, the URL contains the node ID, or use the workflow JSON export.

- [ ] **Step 5: Backwards-compat verification**

Open an existing workflow saved with v1.0.1 or earlier that has Pay-i nodes. Confirm those nodes still show the old `{{ 'provider/' + $parameter.model + '/' + $execution.id }}` default in the Use Case ID field — they should be untouched. This proves the change is non-disruptive for existing user workflows.

- [ ] **Step 6: Report back**

Document the verification results in `notes/` (per project convention — see [feedback_commits_and_notes]). The changelog already covers user-facing communication; `notes/` captures the verification evidence (UUID seen in proxy log, screenshot of new node defaults, etc.) for the team's records.

---

## Out of scope (deferred)

- Removing unused `providerName` / `modelParam` parameters from `createTrackingFields()` — separate cleanup, separate version.
- Updating other tracking-field defaults.
- Pay-i platform changes — none required (UUIDs already accepted, well within 1024-char limit).
