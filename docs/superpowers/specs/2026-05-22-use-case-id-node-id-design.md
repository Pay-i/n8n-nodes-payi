# Design: Use Case ID defaults to n8n Node ID

**Date:** 2026-05-22
**Status:** Draft (awaiting user approval)
**Scope:** `n8n-nodes-payi`

## Problem

The current default for `xProxy-UseCase-ID` is:

```
={{ '<provider>/' + $parameter.<modelParam> + '/' + $execution.id }}
```

Because `$execution.id` changes on every workflow run, every execution produces a unique Use Case ID. That defeats Pay-i's aggregation model — a "use case" is meant to be a stable logical grouping that accumulates events across runs for KPI scoring and cost roll-up.

The pre-Databricks default (`{{ $execution.id }}`) had the same problem.

## Goal

Make a node on the n8n canvas behave as a single Pay-i use case across all of its executions, so cost and KPI data aggregate cleanly per logical step.

## Proposal

Change the default expression for `useCaseId` in `nodes/Payi/descriptions/trackingFields.ts` from the provider/model/execution.id string to `={{ $nodeId }}`.

Final defaults sent on every Pay-i request:

| Header | Default expression | Resolved example |
|---|---|---|
| `xProxy-UseCase-Name` | `{{ $workflow.name.replaceAll(' ', '-') }}` *(unchanged)* | `pay-i-multi-provider-demo` |
| `xProxy-UseCase-ID` | `{{ $nodeId }}` *(new)* | `a1b2c3d4-9876-4abc-9def-0123456789ab` |
| `xProxy-UseCase-Step` | `{{ $node.name }}` *(unchanged)* | `Pay-i Chat Model — OpenAI` |

Aggregation semantics:
- Workflow name groups all events from one workflow
- Node ID groups all runs of a specific node on the canvas (one use case per node, stable across runs)
- Node name is the human-readable step label inside the use case

## Why `$nodeId`

- Verified in `n8n-workflow/dist/cjs/workflow-data-proxy.js:1263`:
  ```js
  $nodeId: that.workflow.getNode(that.activeNodeName)?.id
  ```
  It is a first-class top-level expression variable. No `$node.X.id` traversal needed.
- n8n generates node IDs as UUIDs at node creation, globally unique within a workflow file (and effectively unique across an n8n instance — collisions would be cosmic).
- Stable across runs: the ID is part of the workflow JSON and only changes if the node is deleted/re-added.
- UUID format (36 chars, `[a-f0-9-]`) fits comfortably inside Pay-i's 1024-char Use Case ID limit and matches Pay-i's accepted GUID/UUID format.

## Implementation

Single file, single field default change.

**File:** `nodes/Payi/descriptions/trackingFields.ts`

```diff
- default: `={{ '${providerName}/' + $parameter.${modelParam} + '/' + $execution.id }}`,
+ default: `={{ $nodeId }}`,
  description:
-   'Unique identifier for this use case instance. Defaults to provider/model/executionId.',
+   'Unique identifier for this use case instance. Defaults to the n8n node ID — all runs of the same node aggregate under one Pay-i use case.',
```

Because `providerName` and `modelParam` are no longer used in the expression, the `createTrackingFields(providerName, modelParam)` signature parameters become unused. Two options:

- **Option A (preferred):** keep the parameters in the signature for now. They're harmless, all 6 call sites already pass them, and removing them is a separate cleanup that touches every node file. Leave a one-line comment noting they're reserved for future per-provider customization.
- **Option B:** remove the parameters. Touches all 6 call sites (`Payi.node.ts`, `PayiChatModel.node.ts`, `PayiChatModelAnthropic.node.ts`, `PayiChatModelAzure.node.ts`, `PayiChatModelBedrock.node.ts`, `PayiChatModelDatabricks.node.ts`). Cleaner, slightly larger blast radius.

Recommendation: **Option A**. Smallest incremental change. Parameter cleanup is easy to do later if it stays unused.

## Scope and ripple

| Area | Impact |
|---|---|
| `nodes/Payi/descriptions/trackingFields.ts` | 1 default change + 1 description change |
| 6 node files (`Payi.node.ts`, `PayiChatModel*.node.ts`) | No code changes; they read `useCaseId` via `getNodeParameter` |
| Existing user workflows | Unaffected. The old default expression is baked into saved workflow JSON. Existing nodes keep using `provider/model/executionId` until the user clears the field |
| New nodes added after upgrade | Pick up new `$nodeId` default |
| Pay-i platform | Receives UUIDs in `xProxy-UseCase-ID`. Within the documented 1024-char limit and accepted GUID/UUID format |
| Tests | Repo has no test runner; nothing to update |
| Docs | `README.md` and `docs/providers/*` may reference the old format; spot-check and update during implementation |
| `CHANGELOG.md` | New entry under `[Unreleased] Changed` |

## Backwards compatibility

- Existing workflows continue to work without modification.
- Users on the old default who upgrade and want the new behavior can clear the Use Case ID field on each affected node and let it re-default. Documenting this in the changelog and provider docs.
- Users who prefer the old behavior can paste the old expression back manually.

## Version bump

Patch: `1.0.1` → `1.0.2`.

Rationale: behavior change applies only to newly-added nodes. Existing workflow JSON keeps the old expression. No breaking change for existing users. A minor bump (`1.1.0`) would be defensible, but patch reflects the actual impact.

## Risks

1. **User confusion when comparing old and new nodes side by side.** A workflow with both pre- and post-upgrade nodes will show two different Use Case ID formats. Mitigation: changelog note.
2. **Copy/paste of nodes.** n8n assigns a fresh UUID to a pasted node, so duplicates in the editor get distinct Use Case IDs — desirable behavior, no mitigation needed.
3. **Node deletion + re-add.** Re-adding a deleted node creates a new UUID and starts a fresh use case. Acceptable; matches user intent (a different node).
4. **Pay-i dashboard readability.** Use Case IDs become opaque UUIDs. Counter-context lives in `xProxy-UseCase-Name` (workflow) and `xProxy-UseCase-Step` (node name). Acceptable trade-off.

## Out of scope

- Removing the now-unused `providerName` / `modelParam` parameters from `createTrackingFields()` (deferred — separate cleanup).
- Changes to non-default tracking fields (User ID, Use Case Version, Properties, Limit IDs).
- Pay-i platform-side changes (none required).
- Migration tool for existing workflows (none planned; users edit nodes manually if desired).

## Acceptance criteria

- [ ] `default` for `useCaseId` in `trackingFields.ts` is `={{ $nodeId }}`
- [ ] Field description updated to reflect new default
- [ ] `CHANGELOG.md` updated under `[Unreleased] Changed` with user-facing note
- [ ] `package.json` version bumped to `1.0.2`
- [ ] `npm run build` succeeds
- [ ] `npm run lint` succeeds
- [ ] `npm pack` produces a tarball that, when installed into local n8n, shows `$nodeId` in the Use Case ID field of any newly-added Pay-i node
- [ ] Test workflow execution against Pay-i sandbox confirms UUID lands in `xProxy-UseCase-ID` header
