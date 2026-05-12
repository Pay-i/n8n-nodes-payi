# Documentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a deployment-focused guide for an ITOps team on self-hosted n8n, and bring all provider docs to consistent depth using the Databricks doc as the quality bar.

**Architecture:** Six files — one new deployment guide, four provider doc upgrades, one README link addition. No code changes. The deployment guide is the backbone document; provider docs are deep reference linked from it.

**Tech Stack:** Markdown. That's it.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `docs/deployment-guide.md` | End-to-end deployment and configuration for self-hosted n8n |
| **Update** | `docs/providers/openai.md` | Upgrade to Databricks-level depth |
| **Update** | `docs/providers/anthropic.md` | Add pricing context, expand extended thinking |
| **Update** | `docs/providers/azure.md` | Add pricing context, promote endpoint resolution |
| **Update** | `docs/providers/bedrock.md` | Add pricing context, expand proxy routing |
| **Update** | `README.md` | Add deployment guide link |
| **Reference** | `docs/providers/databricks.md` | Quality template — no changes |

---

### Task 1: Create Deployment Guide — Prerequisites & Installation

**Files:**
- Create: `docs/deployment-guide.md`

- [ ] **Step 1: Write the deployment guide with Prerequisites and Installation sections**

Create `docs/deployment-guide.md` with the following content:

```markdown
# Deployment & Configuration Guide

This guide walks through installing and configuring the Pay-i community node on a self-hosted n8n instance. It covers both UI-based and Docker-based installation, credential setup for all supported providers, verification, and troubleshooting.

---

## 1. Prerequisites

Before installing the Pay-i node, confirm you have the following:

- **Pay-i account** — Provisioned by the Pay-i team during onboarding. If you don't have credentials yet, contact [Pay-i Support](https://www.pay-i.com/support).
- **Pay-i Base URL** — The URL for your dedicated Pay-i instance (e.g., `https://api.yourcompany.pay-i.com`). This is provided during onboarding. **Do not use `https://api.pay-i.com`** — that is the public multi-tenant endpoint, not your dedicated instance.
- **Pay-i API key** — Found in your Pay-i dashboard under API Keys.
- **Provider credentials** — API keys or access credentials for each LLM provider you plan to use:
  - **OpenAI:** API key from [platform.openai.com](https://platform.openai.com)
  - **Anthropic:** API key from [console.anthropic.com](https://console.anthropic.com)
  - **Azure OpenAI:** Resource name (or endpoint URL), API key, and API version from the Azure portal
  - **AWS Bedrock:** IAM Access Key ID, Secret Access Key, optional Session Token, and Region
  - **Databricks:** Workspace URL and Personal Access Token
- **Self-hosted n8n instance** — Running and accessible. Latest stable version recommended.

---

## 2. Installation

### Option A: Community Node UI (Recommended for Workflow Builders)

1. Open your n8n instance in a browser
2. Go to **Settings** → **Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-payi`
5. Check the confirmation box and click **Install**
6. Restart n8n (the node palette won't update until restart)

After restart, search the node palette for "Pay-i" — you should see the six Pay-i nodes listed.

### Option B: Docker Image (Recommended for Infrastructure Teams)

Bake the node into your n8n Docker image so it's available on every container start without manual installation.

**Dockerfile:**

```dockerfile
FROM n8nio/n8n:latest

# Install Pay-i community node
USER root
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install n8n-nodes-payi
USER node

# Clear cache to ensure node discovery on first boot
RUN rm -rf /home/node/.n8n/.cache
```

**docker-compose.yml** (relevant excerpt):

```yaml
services:
  n8n:
    build: .
    environment:
      - N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
```

Build and start:

```bash
docker compose build --no-cache
docker compose up -d
```

> **Note:** If you update the Pay-i node version, rebuild the image and clear the n8n cache volume: `docker compose exec n8n rm -rf /home/node/.n8n/.cache` then restart.
```

- [ ] **Step 2: Review the content**

Read through the written content. Verify:
- The Dockerfile install path matches how n8n expects community nodes
- The docker-compose snippet is syntactically valid
- Prerequisites are complete and match the spec

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: add deployment guide — prerequisites and installation"
```

---

### Task 2: Deployment Guide — Environment Config & Credential Setup

**Files:**
- Modify: `docs/deployment-guide.md`

- [ ] **Step 1: Append Environment Configuration and Credential Setup sections**

Append the following to `docs/deployment-guide.md`:

```markdown
---

## 3. Environment Configuration

Set these environment variables on your n8n instance before using the Pay-i nodes:

| Variable | Required | Value | Purpose |
|----------|----------|-------|---------|
| `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` | Yes (for AI Agent workflows) | `true` | Allows Pay-i LangChain chat model nodes to be connected as AI Agent model inputs |

**How to set it:**
- **Docker:** Add to your `docker-compose.yml` under `environment` (shown in the Docker installation example above)
- **Systemd / bare metal:** Add `export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` to your n8n startup script or environment file
- **n8n Cloud:** Not applicable — this guide is for self-hosted instances

Restart n8n after setting environment variables.

---

## 4. Credential Setup

Each Pay-i node requires two credentials: the Pay-i API credential (shared across all nodes) and a provider-specific credential. If you already have provider credentials configured for n8n's native LLM nodes, you can reuse them directly.

### 4.1 Pay-i API

1. In any workflow, add a Pay-i node and click **Create New Credential** under Pay-i API
2. **API Key** — Your Pay-i API key from the Pay-i dashboard
3. **Base URL** — Your dedicated Pay-i instance URL (e.g., `https://api.yourcompany.pay-i.com`)

> **Common mistake:** Leaving the Base URL as the default `https://api.pay-i.com`. This must be your dedicated instance URL provided during onboarding. Requests to the wrong URL will either fail authentication or route to the wrong Pay-i instance.

### 4.2 OpenAI API

Uses n8n's built-in `openAiApi` credential type.

- **API Key** — Your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

If you already use n8n's native OpenAI Chat Model node, the same credential works — no duplicate setup needed.

### 4.3 Anthropic API

Uses n8n's built-in `anthropicApi` credential type.

- **API Key** — Your Anthropic API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

Same reuse applies — existing Anthropic credentials work as-is.

### 4.4 Azure OpenAI API

Uses n8n's built-in `azureOpenAiApi` credential type.

- **Resource Name** — Your Azure OpenAI resource name (e.g., `my-openai-resource`), or set the **Endpoint** field directly (e.g., `https://my-openai-resource.openai.azure.com`)
- **API Key** — Found in the Azure portal under your resource's **Keys and Endpoint** section
- **API Version** — Optional. Defaults to `2024-08-01-preview` if not set in the credential or the node

> **Endpoint resolution:** The node will use the credential's `endpoint` field if set. Otherwise, it constructs the endpoint from `resourceName` as `https://{resourceName}.openai.azure.com`. If both are set, the explicit endpoint takes priority.

### 4.5 AWS (Bedrock)

Uses n8n's built-in `aws` credential type.

- **Access Key ID** — IAM user access key with Bedrock permissions
- **Secret Access Key** — Corresponding secret key
- **Session Token** — Optional. Required if using temporary STS credentials
- **Region** — AWS region where your Bedrock models are deployed (e.g., `us-east-1`)

AWS SigV4 request signing is handled automatically by the LangChain client — no additional auth configuration needed.

### 4.6 Databricks

Uses the `databricks` credential type from the `n8n-nodes-databricks` community node.

- **Host** — Your Databricks workspace URL (e.g., `https://1234567890.cloud.databricks.com`)
- **Token** — A Databricks Personal Access Token with Model Serving access

> **Prerequisite:** The `n8n-nodes-databricks` community node must be installed for the Databricks credential type to be available. Install it the same way you installed `n8n-nodes-payi` (UI or Docker).
```

- [ ] **Step 2: Review the content**

Verify:
- All six credential types are covered
- The gotchas match what the source code actually does (endpoint resolution, SigV4, etc.)
- No placeholder text

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: deployment guide — environment config and credential setup"
```

---

### Task 3: Deployment Guide — Verification & Tracking

**Files:**
- Modify: `docs/deployment-guide.md`

- [ ] **Step 1: Append Verification and Tracking & Attribution sections**

Append the following to `docs/deployment-guide.md`:

```markdown
---

## 5. Verification

Run this smoke test to confirm the node is installed, credentials are configured, and requests flow through Pay-i.

### Smoke Test Workflow

1. Create a new workflow
2. Add a **Manual Chat Trigger** node
3. Add an **AI Agent** node — connect Chat Trigger to AI Agent
4. Add the **Pay-i OpenAI (Proxy)** node (or whichever provider you're starting with)
5. Connect the Pay-i node to the AI Agent's **Chat Model** input
6. Configure the Pay-i node:
   - Select your Pay-i API and OpenAI API credentials
   - Set **Model** to `gpt-4o` (or another model you have access to)
   - Set **User ID** to `smoke-test`
   - Set **Use Case Name** to `verification`
   - Under **Advanced Tracking**, enable **Debug Logging**
7. Click **Chat** and send: `Hello, this is a test`

### What to Check

**n8n server logs** — Look for debug output like this:

```
[Pay-i OpenAI] ──── DEBUG (item 0) ────
[Pay-i OpenAI] model="gpt-4o" baseURL="https://api.yourcompany.pay-i.com/api/v1/proxy/openai/v1"
[Pay-i OpenAI] Headers: {
  "xProxy-Api-Key": "pi_live_****",
  "xProxy-User-ID": "smoke-test",
  "xProxy-UseCase-Name": "verification"
}
```

If you see this output and get a chat response, the node is working correctly.

**Pay-i dashboard** — Log in to your Pay-i instance and check:
- The request appears in the activity log
- The cost data shows the correct model and token counts
- The User ID shows `smoke-test` and Use Case Name shows `verification`

### Common Failures at This Stage

| What You See | What It Means |
|---|---|
| Node not in palette | n8n cache not cleared or restart needed (see [Troubleshooting](#7-troubleshooting)) |
| Can't connect node to AI Agent | `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` not set (see [Environment Configuration](#3-environment-configuration)) |
| "Invalid API Key" error | Pay-i Base URL or API key is wrong (see [Pay-i API credential](#41-pay-i-api)) |
| Chat response works but nothing in Pay-i dashboard | Base URL is pointing to the wrong Pay-i instance |

---

## 6. Tracking & Attribution

Pay-i uses custom HTTP headers to associate each LLM request with users, use cases, and budgets. Every Pay-i node exposes these fields in the n8n UI. All are optional — but the more you fill in, the more granular your cost visibility becomes.

### How Do You Want to Slice Your Cost Data?

Think about this before configuring tracking. The fields below map directly to dimensions in Pay-i's dashboards and reports.

**By person:** Use **User ID** to attribute costs to the person or system that triggered the workflow. Common patterns:
- The n8n execution user's email
- An upstream ticket ID or customer account ID
- An API caller's identity passed into the workflow via webhook

**By purpose:** Use **Use Case Name** to categorize what the workflow does. This maps to Pay-i's use case dashboards and KPI scoring. Examples: `ticket-triage`, `doc-summarization`, `code-review`, `customer-reply`.

**By execution:** Use **Use Case ID** to uniquely identify each run. The default auto-generates as `{provider}/{model}/{executionId}`, which is usually sufficient. Override this if you need to group multiple workflow executions under a single logical operation.

**By step:** Use **Use Case Step** to see cost breakdown within multi-step pipelines. Defaults to the node name on the canvas. In a summarize → translate pipeline, the two Pay-i nodes would automatically get step names like `Summarize` and `Translate`.

### Advanced Tracking Fields

These are collapsed under **Advanced Tracking** in the node UI. They're typically configured with guidance from Pay-i Support during onboarding.

| Field | Purpose | Example |
|-------|---------|---------|
| **Use Case Version** | Version your use case definitions for A/B testing cost comparisons | `v2.1` |
| **Use Case Properties** | JSON key-value pairs for custom dimensions your org needs | `{"department": "engineering", "priority": "high"}` |
| **Limit IDs** | Comma-separated Pay-i limit IDs that enforce budget caps on this request | `limit_team_monthly,limit_user_daily` |
| **Debug Logging** | Logs request URLs, headers, and routing details to the n8n server console | Toggle on/off |

> **Tip:** Enable **Debug Logging** as the first diagnostic step for any Pay-i issue. It shows you exactly what the node is sending — the URL, headers (with keys masked), and routing decisions.
```

- [ ] **Step 2: Review the content**

Verify:
- Smoke test steps are concrete and followable
- Log output example is realistic (matches what the source code actually logs)
- Tracking section is framed around "how to slice cost data" not just field definitions
- Internal anchor links (`#7-troubleshooting`, `#3-environment-configuration`, `#41-pay-i-api`) will resolve once the full doc is assembled

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: deployment guide — verification and tracking sections"
```

---

### Task 4: Deployment Guide — Troubleshooting

**Files:**
- Modify: `docs/deployment-guide.md`

- [ ] **Step 1: Append Troubleshooting section**

Append the following to `docs/deployment-guide.md`:

```markdown
---

## 7. Troubleshooting

### First Step: Enable Debug Logging

For any Pay-i node issue, the fastest path to a diagnosis is enabling **Debug Logging** in the node's Advanced Tracking section. This writes the full request details (URL, headers with keys masked, routing decisions) to the n8n server console.

Access logs depending on your setup:
- **Docker:** `docker compose logs -f n8n`
- **Systemd:** `journalctl -u n8n -f`
- **Bare metal:** Check the console output where n8n is running

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Node doesn't appear in palette after install | n8n cache stale | Clear the cache: `rm -rf ~/.n8n/.cache` (or `/home/node/.n8n/.cache` in Docker). Restart n8n. |
| Node appears but can't connect to AI Agent model input | Missing env var | Set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` and restart n8n. See [Environment Configuration](#3-environment-configuration). |
| "Invalid API Key" from Pay-i | Wrong API key or wrong Base URL | Open the Pay-i API credential and verify: (1) the API key matches your Pay-i dashboard, (2) the Base URL is your dedicated instance URL — not `https://api.pay-i.com`. |
| "401 Unauthorized" from provider | Provider credential issue | The provider API key is invalid, expired, or doesn't have access to the requested model. Test the key directly with the provider's API to confirm. |
| Chat response works but nothing in Pay-i dashboard | Base URL mismatch | The request is going to the right provider but through the wrong Pay-i instance (or none at all). Verify the Base URL in your Pay-i credential matches the instance your dashboard is on. |
| Azure: "DeploymentNotFound" | Endpoint resolution or deployment name | Check: (1) the deployment name exactly matches the Azure portal, (2) the credential has the correct resource name or explicit endpoint URL. See [Azure credential setup](#44-azure-openai-api). |
| Bedrock: "signature does not match" | Region or credential mismatch | Verify: (1) the region parameter matches where the Bedrock model is deployed, (2) the IAM Access Key and Secret Key are correct and have `bedrock:InvokeModel` permission. |
| Databricks: "RESOURCE_DOES_NOT_EXIST" | Workspace URL or endpoint name | Verify: (1) workspace URL matches `https://{id}.cloud.databricks.com` or `https://{id}.azuredatabricks.net`, (2) the endpoint name matches the Databricks Serving page. |
| Network timeout / connection refused | Firewall or network policy | Your n8n instance must be able to reach your Pay-i instance on port 443 (HTTPS). Check network policies, security groups, or proxy settings between n8n and Pay-i. |

### Getting Help

- **Pay-i Support:** [support@pay-i.com](mailto:support@pay-i.com) or [pay-i.com/support](https://www.pay-i.com/support)
- **GitHub Issues:** [github.com/pay-i/n8n-nodes-payi/issues](https://github.com/pay-i/n8n-nodes-payi/issues)

When reporting an issue, include:
1. The n8n server log output with Debug Logging enabled (mask any API keys)
2. The n8n version (`n8n --version`)
3. The Pay-i node version (from Settings → Community Nodes)
4. The provider and model you're using
```

- [ ] **Step 2: Review the full deployment guide end-to-end**

Read `docs/deployment-guide.md` from top to bottom. Check:
- Section numbering is sequential (1-7)
- Internal anchor links resolve correctly
- No placeholder text, no TODOs
- Tone is consistent throughout

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-guide.md
git commit -m "docs: deployment guide — troubleshooting section (guide complete)"
```

---

### Task 5: Upgrade OpenAI Provider Doc

**Files:**
- Modify: `docs/providers/openai.md`
- Reference: `docs/providers/databricks.md` (quality template)
- Reference: `nodes/Payi/PayiChatModel.node.ts` (source of truth for headers/routing)

- [ ] **Step 1: Rewrite openai.md to Databricks-level depth**

Replace the full contents of `docs/providers/openai.md` with:

```markdown
# Pay-i OpenAI (Proxy)

Routes OpenAI chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i OpenAI (Proxy) |
| Node Name | `lmChatPayi` |
| n8n Type | `n8n-nodes-payi.lmChatPayi` |
| LangChain Class | `ChatOpenAI` (`@langchain/openai`) |
| Proxy Path | `/api/v1/proxy/openai/v1` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| OpenAI API | `openAiApi` | Built-in n8n credential |

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `gpt-4o` | OpenAI model ID (e.g. `gpt-4o`, `gpt-5.2`, `o3-mini`) |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature (0-2) |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |
| Frequency Penalty | number | Penalize repeated tokens (-2 to 2) |
| Presence Penalty | number | Penalize tokens already in the conversation (-2 to 2) |
| Timeout | number | Request timeout in milliseconds |

## How It Works

```
n8n Workflow
  └─ Pay-i OpenAI (Proxy)
       ├─ Credentials: Pay-i API key + OpenAI API key
       └─ POST {payiBaseUrl}/api/v1/proxy/openai/v1/chat/completions
            Headers:
              xProxy-Api-Key:    {payi_key}
              xProxy-User-ID:    {user_id}        (if set)
              xProxy-UseCase-Name: {use_case}     (if set)
              xProxy-UseCase-ID: {use_case_id}    (if set)
            Auth:
              Authorization:     Bearer {openai_key}
```

The node uses `ChatOpenAI` from LangChain with `configuration.baseURL` pointed at the Pay-i proxy and `configuration.defaultHeaders` carrying the Pay-i API key plus any tracking headers. The OpenAI API key is passed through the standard `Authorization: Bearer` header — Pay-i forwards it transparently to OpenAI.

OpenAI is the simplest routing of all supported providers: no endpoint derivation, no special auth headers, no query parameters. The request goes to Pay-i, Pay-i forwards it to `https://api.openai.com/v1/chat/completions`, and returns the response with cost data attached.

### Model IDs

Use the same model IDs you would with OpenAI directly:

| Model | ID |
|-------|-----|
| GPT-4o | `gpt-4o` |
| GPT-4o mini | `gpt-4o-mini` |
| GPT-5.2 | `gpt-5.2` |
| o3-mini | `o3-mini` |

The full list of available models depends on your OpenAI account. The node does not validate the model ID — it passes it through to OpenAI.

### Known Limitations

- **Organization ID** is not currently passed through. If your OpenAI account requires an organization header (`OpenAI-Organization`), this is not yet supported. Contact Pay-i support if you need this.

## OpenAI Pricing

OpenAI charges per token, with separate rates for input and output tokens. Rates vary significantly by model — for example, `gpt-4o` is substantially cheaper per token than earlier GPT-4 variants.

Pay-i tracks both input and output tokens for every request and calculates the dollar cost in real time. You see the actual cost per request in your Pay-i dashboard, not an estimate based on token counts.

For current per-token rates, see [OpenAI's pricing page](https://openai.com/pricing).

## Migration

The n8n migration toolkit automatically detects the following native nodes and replaces them with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatOpenAi`
- `@n8n/n8n-nodes-langchain.lmChatOpenRouter`

Existing OpenAI credentials are passed through automatically.
```

- [ ] **Step 2: Review against Databricks doc for consistency**

Compare section order and depth with `docs/providers/databricks.md`. Verify:
- Same section structure: Node Details → Credentials → Parameters → How It Works → Pricing → Migration
- Header detail matches source code (`PayiChatModel.node.ts:93` for baseURL, `:94` for headers)
- No placeholder text

- [ ] **Step 3: Commit**

```bash
git add docs/providers/openai.md
git commit -m "docs: upgrade OpenAI provider doc to full depth"
```

---

### Task 6: Upgrade Anthropic Provider Doc

**Files:**
- Modify: `docs/providers/anthropic.md`
- Reference: `docs/providers/databricks.md` (quality template)
- Reference: `nodes/Payi/PayiChatModelAnthropic.node.ts` (source of truth)

- [ ] **Step 1: Rewrite anthropic.md with pricing context and expanded extended thinking**

Replace the full contents of `docs/providers/anthropic.md` with:

```markdown
# Pay-i Anthropic (Proxy)

Routes Anthropic Claude chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Anthropic (Proxy) |
| Node Name | `lmChatPayiAnthropic` |
| n8n Type | `n8n-nodes-payi.lmChatPayiAnthropic` |
| LangChain Class | `ChatAnthropic` (`@langchain/anthropic`) |
| Proxy Path | `/api/v1/proxy/anthropic` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| Anthropic API | `anthropicApi` | Built-in n8n credential |

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `claude-sonnet-4-20250514` | Anthropic model ID |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Max Tokens | number | Maximum tokens in the response |
| Temperature | number | Sampling temperature (0-1) |
| Top K | number | Top-k sampling |
| Top P | number | Nucleus sampling threshold |
| Extended Thinking | boolean | Enable Claude's extended thinking mode |
| Thinking Budget | number | Token budget for extended thinking (default: 10000) |

## How It Works

```
n8n Workflow
  └─ Pay-i Anthropic (Proxy)
       ├─ Credentials: Pay-i API key + Anthropic API key
       └─ POST {payiBaseUrl}/api/v1/proxy/anthropic/v1/messages
            Headers:
              xProxy-Api-Key:      {payi_key}
              xProxy-User-ID:      {user_id}        (if set)
              xProxy-UseCase-Name: {use_case}        (if set)
              xProxy-UseCase-ID:   {use_case_id}     (if set)
            Auth:
              x-api-key:           {anthropic_key}
              anthropic-version:   2023-06-01
```

The node uses `ChatAnthropic` from LangChain with `anthropicApiUrl` pointed at the Pay-i proxy. The Pay-i API key is sent in `defaultHeaders`, while the Anthropic API key is passed through the standard `x-api-key` header. Pay-i forwards the request transparently to Anthropic's Messages API.

### Extended Thinking

Extended thinking lets Claude reason through complex problems step-by-step before generating a response. When enabled, the node sends `thinking.type: "enabled"` with a configurable `budget_tokens` in the request.

**Important behavior when thinking is enabled:**
- **Temperature, Top K, and Top P are automatically unset.** The Anthropic API requires these to be absent when thinking mode is active. The node handles this automatically.
- **Thinking Budget vs. Max Tokens:** These are separate limits. The thinking budget caps how many tokens Claude uses for internal reasoning. Max Tokens caps the final response. Both count toward billing.
- **Cost impact:** Thinking tokens are billed as output tokens. A request with a 10,000-token thinking budget can produce significantly more output tokens than a standard request. Pay-i tracks all token types so this is visible in your cost dashboard — no surprises.

## Anthropic Pricing

Anthropic charges per token with separate rates for input and output tokens. Extended thinking tokens are billed at the output token rate.

Pay-i tracks input tokens, output tokens, and (when extended thinking is enabled) thinking tokens separately. The dollar cost per request is calculated in real time and visible in your Pay-i dashboard.

For current per-token rates, see [Anthropic's pricing page](https://www.anthropic.com/pricing).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAnthropic`

Existing Anthropic credentials are passed through automatically.
```

- [ ] **Step 2: Review against source code**

Verify:
- Extended thinking behavior matches `PayiChatModelAnthropic.node.ts:106-118` (invocationKwargs logic)
- Token parser matches `:93-103`
- Headers match `:121-124`

- [ ] **Step 3: Commit**

```bash
git add docs/providers/anthropic.md
git commit -m "docs: upgrade Anthropic provider doc — pricing and extended thinking"
```

---

### Task 7: Upgrade Azure Provider Doc

**Files:**
- Modify: `docs/providers/azure.md`
- Reference: `docs/providers/databricks.md` (quality template)
- Reference: `nodes/Payi/PayiChatModelAzure.node.ts` (source of truth)

- [ ] **Step 1: Rewrite azure.md with promoted endpoint resolution and pricing context**

Replace the full contents of `docs/providers/azure.md` with:

```markdown
# Pay-i Azure AI Foundry (Proxy)

Routes Azure OpenAI (Azure AI Foundry) chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Azure AI Foundry (Proxy) |
| Node Name | `lmChatPayiAzure` |
| n8n Type | `n8n-nodes-payi.lmChatPayiAzure` |
| LangChain Class | `ChatOpenAI` (`@langchain/openai`) |
| Proxy Path | `/api/v1/proxy/azure.openai` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| Azure OpenAI API | `azureOpenAiApi` | Built-in n8n credential |

The Azure OpenAI credential provides the resource name (or endpoint URL) and the API key.

## Endpoint Resolution

This is the most common source of configuration issues with the Azure node. Understand how it works before troubleshooting.

The node determines the upstream Azure endpoint from the credential using this logic:

1. If the credential has an explicit **endpoint** field set, that value is used directly
2. Otherwise, the endpoint is constructed as `https://{resourceName}.openai.azure.com`

This endpoint is sent to Pay-i in the `xProxy-Provider-BaseUri` header so Pay-i knows where to forward the request.

**Example — explicit endpoint:**
```
Credential endpoint: https://my-openai.openai.azure.com
→ xProxy-Provider-BaseUri: https://my-openai.openai.azure.com
```

**Example — constructed from resource name:**
```
Credential resourceName: my-openai
Credential endpoint: (empty)
→ xProxy-Provider-BaseUri: https://my-openai.openai.azure.com
```

If requests fail with "DeploymentNotFound" or similar, check the credential's resource name and endpoint values in the n8n credential editor.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Deployment Name | Yes | — | The Azure deployment name (e.g. `gpt-4o-deployment`) |
| API Version | No | `2024-08-01-preview` | Azure OpenAI API version |

### API Version Fallback Chain

The API version is resolved in this order:

1. **Node parameter** — if explicitly set in the node UI
2. **Credential value** — if the Azure OpenAI credential has an `apiVersion` field
3. **Default** — `2024-08-01-preview`

Some Azure features (like structured outputs or vision) require specific API versions. Check Azure's documentation if a feature isn't working as expected.

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature (0-2) |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |
| Frequency Penalty | number | Penalize repeated tokens (-2 to 2) |
| Presence Penalty | number | Penalize tokens already in the conversation (-2 to 2) |
| Timeout | number | Request timeout in milliseconds |

## How It Works

```
n8n Workflow
  └─ Pay-i Azure AI Foundry (Proxy)
       ├─ Credentials: Pay-i API key + Azure OpenAI API key
       └─ POST {payiBaseUrl}/api/v1/proxy/azure.openai/openai/deployments/{deployment}/chat/completions?api-version={v}
            Headers:
              xProxy-Api-Key:          {payi_key}
              xProxy-Provider-BaseUri: {azure_endpoint}
              xProxy-PriceAs-Resource: {deployment_name}
              xProxy-User-ID:          {user_id}        (if set)
              xProxy-UseCase-Name:     {use_case}        (if set)
              xProxy-UseCase-ID:       {use_case_id}     (if set)
            Auth:
              api-key:                 {azure_api_key}
```

The node uses `ChatOpenAI` (not `AzureChatOpenAI`) from LangChain because Azure OpenAI's wire format is identical to OpenAI's. `ChatOpenAI` allows direct control over `baseURL` and headers, which is needed for Pay-i's proxy auth flow. `AzureChatOpenAI`'s internal auth handling (double header injection, request-time overrides) conflicts with Pay-i's proxy routing.

The `xProxy-PriceAs-Resource` header tells Pay-i which deployment to map costs to, since Azure pricing depends on the deployment configuration rather than the model name alone.

## Azure OpenAI Pricing

Azure OpenAI pricing varies by deployment type:

- **Standard (pay-as-you-go)** — per-token pricing, similar to OpenAI direct but rates may differ
- **Provisioned Throughput** — per-unit hourly rate for reserved capacity
- **Global / Data Zone deployments** — different rate tiers based on geographic routing

Pay-i uses the `xProxy-PriceAs-Resource` header (set to your deployment name) to map costs accurately. The dollar cost per request is calculated in real time and visible in your Pay-i dashboard.

For current rates, see [Azure OpenAI pricing](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAzureOpenAi`

Existing Azure OpenAI credentials are passed through automatically.
```

- [ ] **Step 2: Review against source code**

Verify:
- Endpoint resolution logic matches `PayiChatModelAzure.node.ts:73-77`
- API version fallback matches `:81-83`
- Headers match `:117-123`
- `ChatOpenAI` usage comment matches `:57-62`

- [ ] **Step 3: Commit**

```bash
git add docs/providers/azure.md
git commit -m "docs: upgrade Azure provider doc — endpoint resolution and pricing"
```

---

### Task 8: Upgrade Bedrock Provider Doc

**Files:**
- Modify: `docs/providers/bedrock.md`
- Reference: `docs/providers/databricks.md` (quality template)
- Reference: `nodes/Payi/PayiChatModelBedrock.node.ts` (source of truth)

- [ ] **Step 1: Rewrite bedrock.md with expanded proxy routing and pricing context**

Replace the full contents of `docs/providers/bedrock.md` with:

```markdown
# Pay-i Amazon Bedrock (Proxy)

Routes Amazon Bedrock chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Amazon Bedrock (Proxy) |
| Node Name | `lmChatPayiBedrock` |
| n8n Type | `n8n-nodes-payi.lmChatPayiBedrock` |
| LangChain Class | `ChatBedrockConverse` (`@langchain/aws`) |
| Proxy Path | `/api/v1/proxy/aws.bedrock` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| AWS | `aws` | Built-in n8n credential |

The AWS credential provides Access Key ID, Secret Access Key, optional Session Token, and Region.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model ID |
| Region | No | From AWS credential | AWS region for the Bedrock endpoint |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |

## How It Works

```
n8n Workflow
  └─ Pay-i Amazon Bedrock (Proxy)
       ├─ Credentials: Pay-i API key + AWS credentials (SigV4)
       └─ POST via ChatBedrockConverse with endpointHost={payiProxy}
            Headers:
              xProxy-Api-Key:      {payi_key}
              xProxy-User-ID:      {user_id}        (if set)
              xProxy-UseCase-Name: {use_case}        (if set)
              xProxy-UseCase-ID:   {use_case_id}     (if set)
            Auth:
              AWS SigV4 signing (Access Key + Secret Key)
```

The node uses `ChatBedrockConverse` from LangChain with `endpointHost` pointed at the Pay-i proxy. AWS credentials are passed through for SigV4 request signing. Pay-i receives the signed request and forwards it to the Bedrock endpoint in the specified region.

### Proxy Routing — Why Bedrock Is Different

All other Pay-i provider nodes use `baseURL` (a full URL) to route requests through the proxy. Bedrock is different: `ChatBedrockConverse` uses `endpointHost` — a **hostname-only** parameter (no protocol prefix).

The node strips the protocol from the Pay-i proxy URL before passing it:

**Normal Bedrock request (without Pay-i):**
```
POST https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-5-sonnet-20241022-v2:0/converse
```

**Proxied through Pay-i:**
```
endpointHost: api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock
→ POST https://api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock/{region}/model/{modelId}/converse
```

The Pay-i proxy URL (`https://api.yourcompany.pay-i.com`) becomes just the host portion (`api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock`) because `ChatBedrockConverse` prepends `https://` internally.

### SigV4 Request Signing

AWS Bedrock requires SigV4 signing on every request. Here's how it works through the proxy:

1. The LangChain `ChatBedrockConverse` client signs the request using the provided AWS credentials (Access Key ID + Secret Access Key)
2. The signing target host is the Pay-i proxy hostname, not the actual Bedrock endpoint
3. Pay-i receives the signed request and forwards it to the real Bedrock endpoint

> **Note:** Verify the exact proxy behavior for SigV4-signed requests with Pay-i Support if you encounter signing errors. The proxy may re-sign, strip-and-forward, or pass through depending on configuration.

## Amazon Bedrock Pricing

Bedrock pricing is per-token and varies by model and region. Pricing structures include:

- **On-demand** — per-token pricing with no commitment, separate input/output rates
- **Provisioned Throughput** — hourly rate for reserved model units
- **Batch inference** — discounted per-token rates for non-real-time workloads

Pay-i tracks per-request costs (input and output tokens) in real time. The dollar cost is visible in your Pay-i dashboard.

For current per-token rates, see [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAwsBedrock`

Existing AWS credentials are passed through automatically.
```

- [ ] **Step 2: Review against source code**

Verify:
- `endpointHost` construction matches `PayiChatModelBedrock.node.ts:107`
- AWS credential fields match `:65-67`
- Region fallback matches `:70`
- Headers match `:108-111`

- [ ] **Step 3: Commit**

```bash
git add docs/providers/bedrock.md
git commit -m "docs: upgrade Bedrock provider doc — proxy routing and pricing"
```

---

### Task 9: README Update & Final Review

**Files:**
- Modify: `README.md`
- Reference: All docs created/modified in Tasks 1-8

- [ ] **Step 1: Add deployment guide link to README**

In `README.md`, after the existing Setup section header `## Setup`, add a callout linking to the deployment guide. Insert the following line immediately after `## Setup`:

```markdown
> **Self-hosted deployment?** For detailed instructions including Docker installation, dedicated Pay-i instance configuration, and troubleshooting, see the [Deployment & Configuration Guide](docs/deployment-guide.md).
```

- [ ] **Step 2: Final cross-doc review**

Read through all modified files in order:
1. `docs/deployment-guide.md` — complete, no TODOs, all sections present
2. `docs/providers/openai.md` — matches Databricks depth
3. `docs/providers/anthropic.md` — matches Databricks depth, extended thinking is clear
4. `docs/providers/azure.md` — matches Databricks depth, endpoint resolution is prominent
5. `docs/providers/bedrock.md` — matches Databricks depth, proxy routing is clear
6. `README.md` — deployment guide link is present and correct

Check for:
- Consistent section ordering across all provider docs
- No broken internal links
- No placeholder text or TODOs
- Provider-specific pricing sections all follow the same pattern

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add deployment guide link to README"
```

- [ ] **Step 4: Update CHANGELOG**

Add an entry to the `[Unreleased]` section of `CHANGELOG.md`:

```markdown
### Added
- Deployment & Configuration Guide for self-hosted n8n (`docs/deployment-guide.md`)

### Changed
- OpenAI provider doc upgraded to full depth with pricing context and model reference
- Anthropic provider doc expanded with pricing context and extended thinking details
- Azure provider doc upgraded with prominent endpoint resolution guide and pricing context
- Bedrock provider doc expanded with detailed proxy routing explanation and pricing context
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for documentation overhaul"
```
