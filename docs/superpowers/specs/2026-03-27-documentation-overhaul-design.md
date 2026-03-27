# Documentation Overhaul — Design Spec

**Date:** 2026-03-27
**Branch:** `remediation-dev`
**Goal:** Create deployment-focused documentation for an ITOps team running Pay-i nodes on self-hosted n8n, and bring all provider docs up to a consistent depth.

---

## Audience

Primary: An enterprise ITOps engineering team deploying and configuring n8n-nodes-payi on their private, self-hosted n8n instance.

**Assumptions:**
- Strong n8n experience, new to Pay-i
- May be a mixed team: workflow builders (n8n experts) and infra engineers (doing the install)
- Pay-i account is provisioned via white-glove onboarding (not self-service)
- They connect to a dedicated/private Pay-i instance (custom Base URL, not `api.pay-i.com`)
- All five providers (OpenAI, Anthropic, Azure, Bedrock, Databricks) should be documented

---

## Deliverables

### 1. New: Deployment & Configuration Guide

**Location:** `docs/deployment-guide.md`

A single end-to-end document the customer's team reads to go from zero to working Pay-i integration. Structured for sequential reading but with clear section headers for reference use.

#### 1.1 Prerequisites

What they need before touching n8n:

- Pay-i account provisioned by Pay-i team (link to support contact, reference onboarding process)
- Pay-i Base URL for their dedicated instance — explicitly call out that this is NOT `api.pay-i.com` and is provided during onboarding
- Pay-i API key (from their Pay-i dashboard)
- Provider API keys/credentials for each provider they plan to use (OpenAI, Anthropic, Azure, AWS, Databricks)
- Self-hosted n8n instance running (note minimum version if applicable, otherwise "latest stable recommended")

#### 1.2 Installation

Two paths, clearly separated with headers:

**UI Path (for workflow builders):**
- Settings > Community Nodes > Install > `n8n-nodes-payi`
- Step-by-step with expected UI confirmations

**Docker Path (for infra/DevOps):**
- Dockerfile snippet showing how to bake the node into a custom n8n image
- Pattern: `FROM n8nio/n8n:latest` → `npm install n8n-nodes-payi` in the image
- Cache clearing step (`rm -rf /home/node/.n8n/.cache`)
- docker-compose example if relevant

Both paths end with: restart n8n, verify node appears in the node palette.

#### 1.3 Environment Configuration

n8n environment variables that must be set:

| Variable | Required | Value | Purpose |
|----------|----------|-------|---------|
| `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` | Yes (for AI Agent workflows) | `true` | Allows community node LangChain models to be used as AI Agent tools |

Note any other relevant env vars if they exist. Keep this section tight — only what's needed, not a dump of all n8n config options.

#### 1.4 Credential Setup

Step-by-step for each credential type, ordered by dependency:

1. **Pay-i API** — API key + Base URL. Emphasize: the Base URL is their dedicated instance URL provided during onboarding. Common mistake: leaving the default `api.pay-i.com`.
2. **OpenAI API** — API key. Note: if they already have this configured for native OpenAI nodes, they can reuse it.
3. **Anthropic API** — API key. Same reuse note.
4. **Azure OpenAI API** — Resource name (or endpoint URL) + API key + API version. Call out the endpoint resolution logic (credential endpoint vs. constructed from resource name).
5. **AWS** — Access Key ID + Secret Access Key + optional Session Token + Region. Note SigV4 signing is handled automatically.
6. **Databricks** — Workspace URL (host) + Personal Access Token. Note: requires the `n8n-nodes-databricks` community node to be installed for the credential type.

Each credential section: 3-5 sentences max. They know how to fill in credential forms. Focus on what's different or easy to get wrong.

#### 1.5 Verification

A concrete "smoke test" workflow:

1. Create a new workflow
2. Add a Manual Chat Trigger
3. Add an AI Agent node
4. Add the Pay-i OpenAI (Proxy) node (or whichever provider they're starting with)
5. Connect: Chat Trigger → AI Agent → Pay-i node as Chat Model input
6. Set model to a known-good model ID
7. Enable Debug Logging (in Advanced Tracking)
8. Execute and send a test message
9. **Check n8n logs:** Look for `[Pay-i OpenAI] ──── DEBUG` lines confirming the request was built correctly
10. **Check Pay-i dashboard:** Confirm the request appears with correct user/use-case attribution

Include what a successful log output looks like (sanitized example) and what common failure modes look like.

#### 1.6 Tracking & Attribution

How to configure tracking headers for their organization:

- **User ID** — Recommended patterns: n8n execution user, upstream ticket ID, or API caller identity. This drives per-user cost reporting in Pay-i.
- **Use Case Name** — Their naming convention for workflow categories (e.g., "ticket-triage", "doc-summarization"). Maps to Pay-i use case dashboards.
- **Use Case ID** — Unique per-execution identifier. Default auto-generates from `{provider}/{model}/{executionId}`.
- **Use Case Step** — Defaults to the node name on the canvas. Useful in multi-step pipelines to see cost breakdown per step.
- **Advanced fields** (under collapsed "Advanced Tracking"):
  - Use Case Version — version your use case definitions for A/B testing
  - Use Case Properties — JSON key-value pairs for custom dimensions
  - Limit IDs — comma-separated Pay-i limit IDs for budget enforcement
  - Debug Logging — toggle for n8n server console output

Frame this section around "how does your org want to slice cost data?" rather than just listing fields.

#### 1.7 Troubleshooting

Common failure modes with symptoms and fixes:

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Node doesn't appear in palette after install | n8n cache not cleared | `rm -rf ~/.n8n/.cache` and restart n8n |
| Node appears but can't be used as AI Agent model input | Missing env var | Set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` and restart |
| "Invalid API Key" from Pay-i | Wrong API key or wrong Base URL | Verify Base URL is the dedicated instance URL (not `api.pay-i.com`), verify API key in Pay-i dashboard |
| "401 Unauthorized" from provider | Provider credential issue | Check provider API key is valid and has access to the requested model |
| Request succeeds but no data in Pay-i dashboard | Base URL pointing to wrong instance | Verify Base URL matches the provisioned Pay-i instance |
| Azure deployment not found | Endpoint resolution mismatch | Check credential has correct resource name or explicit endpoint URL; verify deployment name matches Azure portal |
| Bedrock "signature mismatch" | Region or credential mismatch | Verify AWS region matches where the model is deployed; check Access Key/Secret Key |
| Databricks "endpoint not found" | Workspace URL format | Verify workspace URL format matches `https://{id}.cloud.databricks.com` or `https://{id}.azuredatabricks.net` |
| Network timeout | Firewall blocking | n8n instance must be able to reach the Pay-i instance URL on port 443 |

Add a note about Debug Logging as the first diagnostic step for any issue.

---

### 2. Provider Doc Upgrades

**Template:** `docs/providers/databricks.md` (current state is the target quality bar)

**Databricks stays as-is.** The following four docs get upgraded:

#### 2.1 OpenAI (`docs/providers/openai.md`)

Current state: Thin reference. Needs the most work.

Add:
- **How It Works — expanded:** Full request flow diagram (already has a basic one, flesh it out with all headers). Explain that `ChatOpenAI` is configured with `baseURL` pointed at Pay-i and `defaultHeaders` carrying the Pay-i API key plus tracking headers. The provider API key is passed in the standard `Authorization: Bearer` header.
- **Provider-specific notes:** Model ID format (`gpt-4o`, `gpt-5.2`, `o3-mini`). Note that OpenAI is the simplest routing — no endpoint derivation, no special auth. Organization ID is not currently passed (if relevant, note it as a known limitation or future feature).
- **Pricing context:** OpenAI charges per-token (input/output separately). Pay-i tracks both and reports dollar cost in the dashboard. Exact rates vary by model — refer to OpenAI's pricing page for current rates. Pay-i's value: you see the actual cost per request, not an estimate.

#### 2.2 Anthropic (`docs/providers/anthropic.md`)

Current state: Decent. Needs pricing context and extended thinking polish.

Add:
- **Pricing context:** Anthropic charges per-token (input/output). Extended thinking tokens are billed as output tokens. Pay-i tracks all token types. Refer to Anthropic's pricing page for current rates.
- **Extended Thinking — expanded:** Currently mentions the feature but could be clearer about the practical implications: when thinking is enabled, temperature/top_k/top_p are forced off (Anthropic API requirement). The thinking budget is separate from max_tokens. Cost impact: thinking tokens can significantly increase output token count — Pay-i tracks this so there are no surprises.

#### 2.3 Azure (`docs/providers/azure.md`)

Current state: Decent. Needs pricing context and stronger emphasis on endpoint resolution.

Add:
- **Pricing context:** Azure OpenAI pricing varies by deployment type (standard, provisioned throughput, global/data zone). Pay-i uses the `xProxy-PriceAs-Resource` header (set to deployment name) to map costs. Refer to Azure's pricing page for current rates.
- **Endpoint Resolution — promoted:** Move the endpoint resolution logic higher and make it more prominent. This is the #1 Azure-specific gotcha. Add a concrete example showing credential with explicit endpoint vs. constructed from resource name.
- **API Version notes:** Explain the fallback chain: node parameter > credential value > default `2024-08-01-preview`. Note that some Azure features require specific API versions.

#### 2.4 Bedrock (`docs/providers/bedrock.md`)

Current state: Decent. Needs pricing context and clearer proxy routing explanation.

Add:
- **Pricing context:** Bedrock pricing is per-token, varies by model and region. Some models have on-demand vs. provisioned throughput pricing. Pay-i tracks per-request costs. Refer to AWS Bedrock pricing page for current rates.
- **Proxy Routing — expanded:** The `endpointHost` pattern is architecturally different from all other providers. Add a clearer before/after comparison showing how a normal Bedrock request URL maps to the proxied version. Explain why `endpointHost` (host-only, no protocol) is used instead of `baseURL`.
- **SigV4 signing note:** Clarify that AWS SigV4 signing happens in the LangChain client using the provided credentials. Pay-i receives the signed request and forwards it. The signing target host is the proxy, not the actual Bedrock endpoint. *(Verify with Pay-i team during implementation: confirm the exact proxy behavior for SigV4-signed requests — does Pay-i re-sign, strip-and-forward, or pass through?)*

---

### 3. README Updates

**Location:** `README.md`

Minimal changes — the README stays as the public-facing overview:

- Add a link to the new deployment guide in the Setup section: "For detailed deployment instructions (including Docker installation and self-hosted Pay-i configuration), see the [Deployment Guide](docs/deployment-guide.md)."
- No structural changes. The README is already solid.

---

## Out of Scope

- New workflow examples (existing examples are adequate for the customer)
- Doc site infrastructure (mkdocs, docusaurus) — deferred to marketplace milestone
- Generic proxy node (`Payi.node.ts`) documentation upgrades — already clean and well-documented
- n8n Cloud verification documentation — deferred per earlier decision
- Pay-i platform documentation (dashboard usage, limit configuration, etc.) — that's Pay-i's docs, not ours

---

## File Inventory

| Action | File |
|--------|------|
| **Create** | `docs/deployment-guide.md` |
| **Update** | `docs/providers/openai.md` |
| **Update** | `docs/providers/anthropic.md` |
| **Update** | `docs/providers/azure.md` |
| **Update** | `docs/providers/bedrock.md` |
| **Update** | `README.md` (add deployment guide link) |
| **No change** | `docs/providers/databricks.md` |

---

## Success Criteria

1. A new team member on the ITOps customer's team can go from "we have n8n and a Pay-i account" to "Pay-i node is installed and routing requests" by following the deployment guide without external help.
2. All five provider docs have consistent depth covering: node details, credentials, parameters, how it works (with request flow), provider-specific quirks, pricing context, and migration.
3. The troubleshooting section covers the failure modes that would otherwise generate a support ticket.
