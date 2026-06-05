# Deployment & Configuration Guide — n8n-nodes-payi

**Audience:** ITOps engineers and workflow builders deploying Pay-i community nodes on a self-hosted n8n instance.

**Scope:** This guide covers everything from initial prerequisites through a working, verified node installation with cost-tracking attribution configured. Read it end to end before you start; a missed step early usually surfaces as a confusing error later.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Environment Configuration](#3-environment-configuration)
4. [Credential Setup](#4-credential-setup)
5. [Verification](#5-verification)
6. [Tracking & Attribution](#6-tracking--attribution)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Before installing the node, confirm you have everything in the list below. Missing any one of these will block you at a specific step — it's faster to check now.

### Pay-i Account & Instance

| Requirement | Notes |
|-------------|-------|
| Pay-i account | Provisioned by the Pay-i team. Contact [Pay-i support](https://www.pay-i.com/support) if your account has not been set up yet. |
| Pay-i Base URL | Your dedicated instance URL — for example, `https://api.yourcompany.pay-i.com`. **This is NOT `api.pay-i.com`.** Every customer gets a dedicated endpoint; using the wrong URL is the single most common setup mistake and produces misleading errors. |
| Pay-i API key | Available from your Pay-i dashboard after account provisioning. |

### Provider Credentials

You need credentials for each LLM provider you intend to route through Pay-i. Collect these before you begin — you will enter them during [Section 4: Credential Setup](#4-credential-setup).

| Provider | What You Need |
|----------|---------------|
| OpenAI | API key from [platform.openai.com](https://platform.openai.com) |
| Anthropic | API key from [console.anthropic.com](https://console.anthropic.com) |
| Azure OpenAI | Resource name (or full endpoint URL), API key, and API version |
| AWS Bedrock | Access Key ID, Secret Access Key, optional Session Token, and AWS region where Bedrock is enabled |
| Databricks | Workspace URL and a Personal Access Token (PAT) with permissions to call the model serving endpoint |

### n8n Instance

- Self-hosted n8n, latest stable release recommended.
- Community node installation must be enabled (see [Section 3](#3-environment-configuration)).
- Network access from the n8n host to your Pay-i Base URL on port 443.

---

## 2. Installation

Choose the path that matches how your n8n instance is managed.

### Option A: Community Node UI

This is the simplest path for instances managed through the n8n web interface.

1. Open n8n and go to **Settings > Community Nodes**.
2. Click **Install**.
3. Enter the package name: `n8n-nodes-payi`
4. Accept the community node security prompt.
5. Click **Install** to confirm.
6. **Restart n8n.** The node is not available until the process restarts.

After restart, search for "Pay-i" in the node panel to confirm the nodes appear.

### Option B: Docker Image

For teams managing n8n via Docker, bake the package into your image so every container starts with the node pre-installed.

**Dockerfile:**

```dockerfile
FROM n8nio/n8n:latest
USER root
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-payi
USER node
RUN rm -rf /home/node/.n8n/.cache
```

> **Production note:** The example above uses `n8nio/n8n:latest`. For production deployments, pin to a specific n8n version tag (for example, `n8nio/n8n:1.85.0`) to prevent unintended upgrades from breaking your workflows.

Build and tag this image, then reference it in your compose file.

**docker-compose.yml excerpt:**

```yaml
services:
  n8n:
    image: your-registry/n8n-payi:latest   # Use your tagged image above
    environment:
      - N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
```

The `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` variable is required for Pay-i nodes to function as AI Agent tools. See [Section 3](#3-environment-configuration) for details.

---

## 3. Environment Configuration

### Required Variable

| Variable | Value | Purpose |
|----------|-------|---------|
| `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` | `true` | Allows community nodes (including Pay-i) to be used as tools inside the n8n AI Agent node. Without this, the node installs but cannot be attached to an AI Agent. |

### How to Set It

**Docker / docker-compose**

Add the variable under `environment:` in your compose file as shown in Option B above. Recreate the container after changing compose files:

```bash
docker compose up -d --force-recreate
```

**Systemd / bare metal**

Add the export to the startup script or service unit that launches n8n. For a systemd unit:

```ini
[Service]
Environment="N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true"
ExecStart=/usr/local/bin/n8n start
```

Reload and restart the service after editing:

```bash
sudo systemctl daemon-reload
sudo systemctl restart n8n
```

For bare-metal starts via shell script, add:

```bash
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

before running `n8n start`.

---

## 4. Credential Setup

Pay-i nodes require two credentials per workflow: one for Pay-i itself, and one for the upstream provider. Set up Pay-i first, then configure provider credentials.

### 4.1 Pay-i API Credential

**Credential type:** `Pay-i API` (provided by this community node)

Navigate to **Settings > Credentials > New Credential > Pay-i API**.

| Field | Value | Notes |
|-------|-------|-------|
| API Key | Your Pay-i API key | From the Pay-i dashboard |
| Base URL | `https://api.yourcompany.pay-i.com` | **Your dedicated instance URL.** Do not leave this as a default or placeholder. Do not use `api.pay-i.com`. If you are unsure of your Base URL, contact [Pay-i support](https://www.pay-i.com/support). |

> **Common mistake:** Leaving the Base URL as a default or using the wrong endpoint. If requests fail with 401 or connection errors and your API key is correct, the Base URL is almost always the cause. Double-check it before debugging anything else.

---

### 4.2 OpenAI API Credential

**Credential type:** `OpenAI API` (built-in n8n credential)

If you already have an OpenAI credential in n8n, you can reuse it — no need to create a duplicate.

| Field | Value |
|-------|-------|
| API Key | Your OpenAI API key |

---

### 4.3 Anthropic API Credential

**Credential type:** `Anthropic API` (built-in n8n credential)

If you already have an Anthropic credential in n8n, reuse it.

| Field | Value |
|-------|-------|
| API Key | Your Anthropic API key |

---

### 4.4 Azure OpenAI API Credential

**Credential type:** `Azure OpenAI API` (built-in n8n credential)

| Field | Value | Notes |
|-------|-------|-------|
| Resource Name | Your Azure OpenAI resource name | e.g., `my-openai-resource` |
| API Key | Your Azure OpenAI API key | From Azure portal > your resource > Keys and Endpoint |
| API Version | e.g., `2024-08-01-preview` | Can also be set per-node in the node parameters |

> **Endpoint resolution note:** The Pay-i Azure node constructs the upstream endpoint from your resource name using the standard Azure pattern (`https://<resource-name>.openai.azure.com`). If your Azure deployment uses a custom domain or a non-standard endpoint URL, enter the full endpoint URL in the Resource Name field instead of just the resource name — the node handles both forms.

---

### 4.5 AWS Credentials (Bedrock)

**Credential type:** `AWS` (built-in n8n credential)

AWS SigV4 request signing is handled automatically by the Pay-i Bedrock node. You only need to supply the credentials.

| Field | Value | Notes |
|-------|-------|-------|
| Access Key ID | Your AWS Access Key ID | IAM user or role with Bedrock invoke permissions |
| Secret Access Key | Your AWS Secret Access Key | |
| Session Token | Optional | Required only for temporary credentials (STS / assumed roles) |
| Region | e.g., `us-east-1` | Must match the region where your Bedrock model is enabled |

---

### 4.6 Databricks Credential

**Credential type:** `Pay-i Databricks API` (provided by this community node)

> **No extra package required.** This package ships its own `payiDatabricksApi` credential type — namespaced to avoid collision with n8n's built-in `databricksApi` credential, which uses different field names. You do not need to install `n8n-nodes-databricks`.

| Field | Value | Notes |
|-------|-------|-------|
| Workspace URL | `https://your-workspace.azuredatabricks.net` | Full URL including scheme, no trailing slash. AWS/GCP workspaces use `https://{id}.cloud.databricks.com` |
| Personal Access Token | Your Databricks PAT | Generate from Databricks UI: User Settings > Developer > Access Tokens |

---

## 5. Verification

Run this smoke test after completing installation and credential setup. It confirms the node is installed, the credentials work, and requests are reaching your Pay-i instance.

### Build the Smoke Test Workflow

1. Create a new workflow in n8n.
2. Add a **Manual Chat Trigger** node.
3. Add an **AI Agent** node. Connect the Manual Chat Trigger to it.
4. In the AI Agent node, click the **Chat Model** connector and add a **Pay-i OpenAI (Proxy)** node.
5. Configure the Pay-i OpenAI node:
   - **Pay-i API credential:** select the credential you created in [Section 4.1](#41-pay-i-api-credential)
   - **OpenAI API credential:** select the credential from [Section 4.2](#42-openai-api-credential)
   - **Model:** `gpt-4o` (or any model available on your OpenAI account)
   - Under **Options**, set:
     - **User ID:** `smoke-test`
     - **Use Case Name:** `verification`
     - **Debug Logging:** enabled

6. Save the workflow.
7. Click **Chat** and send any message (e.g., "Hello").

### Expected Debug Log Output

With Debug Logging enabled, the n8n execution log will contain entries like this:

```
[Pay-i OpenAI] ──── DEBUG (item 0) ────
[Pay-i OpenAI] model="gpt-4o" baseURL="https://api.yourcompany.pay-i.com/api/v1/proxy/openai/v1"
[Pay-i OpenAI] Headers: {
  "xProxy-Api-Key": "pi_live_****",
  "xProxy-User-ID": "smoke-test",
  "xProxy-UseCase-Name": "verification"
}
```

Confirm that `baseURL` shows **your dedicated Pay-i instance URL**, not `api.pay-i.com`. Confirm the `xProxy-Api-Key` is masked but present. If the workflow executes and returns a response, your installation is working.

Check your Pay-i dashboard — the verification request should appear in usage data within a few minutes.

### Common Failures at This Stage

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Pay-i OpenAI" not in node panel | Node not installed or cache not cleared | See [Option A](#option-a-community-node-ui) restart step or clear `~/.n8n/.cache` |
| Cannot attach node to AI Agent | `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE` not set | See [Section 3](#3-environment-configuration) |
| 401 Unauthorized from Pay-i | Wrong API key or wrong Base URL | Recheck [Section 4.1](#41-pay-i-api-credential) |
| 401 from OpenAI | OpenAI credential invalid or expired | Verify API key at platform.openai.com |
| No data in Pay-i dashboard | Base URL points to wrong instance | Confirm your dedicated URL with Pay-i support |

---

## 6. Tracking & Attribution

Pay-i's value comes from being able to slice cost and usage data in ways that matter to your organization. The tracking fields give you control over how that data is labeled.

**Think about it this way: how do you want to answer these questions?**

- "Who is using the most tokens?" → use **User ID**
- "Which workflows are driving the most cost?" → use **Use Case Name**
- "Which specific execution caused this spike?" → use **Use Case ID**
- "Which step in a multi-step workflow is the expensive one?" → use **Use Case Step**

### Core Attribution Fields

| Field | n8n Parameter | What It Does | Recommendation |
|-------|--------------|--------------|----------------|
| User ID | `userId` | Tags the request to a person or system account | Set to the n8n user, authenticated end user, or service identity |
| Use Case Name | `useCaseName` | Tags the request to a workflow or business purpose | Set to something readable: `invoice-extraction`, `support-triage`, `code-review` |
| Use Case ID | `useCaseId` | Identifies the logical use case (one canvas node = one use case) | Defaults to `{{ $nodeId }}` — the node's stable UUID. Override only when you need a correlation ID from an external system |
| Use Case Step | `useCaseStep` | Tags a specific node within a workflow | Defaults to the node display name (e.g. `Pay-i Databricks (Proxy)`) — override with a custom label when you have multiple Pay-i nodes in one workflow |

### Advanced Fields

| Field | Type | Description |
|-------|------|-------------|
| Use Case Version | string | Track model or prompt versions — useful when A/B testing prompts. For example, `v2.1-chain-of-thought` |
| Use Case Properties | JSON object | Arbitrary key-value metadata for filtering in the dashboard. For example, `{"team": "finance", "env": "prod"}` |
| Limit IDs | string (comma-separated) | Associate this request with one or more Pay-i Limits by ID |
| Debug Logging | boolean | Emit request details to n8n execution log. Enable during setup and troubleshooting; disable in production to reduce log volume |

### Practical Setup Recommendations

For most deployments:

- **Always set User ID and Use Case Name.** These are the two fields Pay-i dashboards filter on most.
- Use **n8n expressions** to make these dynamic: `={{ $json.userId }}` or `={{ $workflow.name }}`.
- If you run multiple environments (dev, staging, prod), encode the environment in Use Case Properties rather than in the Use Case Name itself.
- Leave Use Case ID and Use Case Step as defaults unless you have a specific correlation requirement.

---

## 7. Troubleshooting

### First Step: Enable Debug Logging

Before investigating any issue, turn on Debug Logging in the Pay-i node's Options. This emits the full request configuration — Base URL, masked API key, and all tracking headers — to the n8n execution log. Most issues are immediately visible once you can see these values.

**Accessing logs:**

- **Docker:** `docker logs <container-name> --follow`
- **Systemd:** `journalctl -u n8n -f`
- **Bare metal:** Check the terminal or log file where n8n was started, or n8n's built-in execution log in the UI (open the execution, click the node, check the Output panel for console messages)

### Common Issues

| Issue | Symptom | Cause | Resolution |
|-------|---------|-------|------------|
| Node not in palette | "Pay-i OpenAI" missing from node search | n8n cache not cleared after install | Clear `~/.n8n/.cache` and restart n8n |
| Cannot connect node to AI Agent | Node appears but cannot be wired as Chat Model | `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` not set | Set the environment variable and restart n8n (see [Section 3](#3-environment-configuration)) |
| Invalid API Key / authentication error | Execution fails with 401 from Pay-i | Wrong API key, or wrong Base URL pointing to a different instance | Re-enter the API key; confirm the Base URL is your dedicated instance URL |
| 401 from upstream provider | Execution fails with 401 from OpenAI / Anthropic / Azure | Provider credential invalid or expired | Test the provider key directly (curl or provider console); update credential in n8n |
| No data in Pay-i dashboard | Workflows succeed but usage doesn't appear | Base URL is incorrect — requests are reaching the wrong endpoint | Enable Debug Logging and confirm the `baseURL` in the log matches your dedicated instance |
| Azure `DeploymentNotFound` | Azure requests fail with deployment not found error | Deployment name doesn't match, or endpoint resolution is wrong | Verify the deployment name in Azure portal; if using a custom domain, enter the full endpoint URL in the credential's Resource Name field |
| Bedrock signature mismatch | AWS requests fail with signature errors | Region in credential doesn't match the region where the model is enabled | Confirm the region in your AWS credential matches your Bedrock model deployment region |
| Databricks `RESOURCE_DOES_NOT_EXIST` | Databricks requests fail with resource error | Workspace URL is incorrect or the model serving endpoint doesn't exist | Confirm the full workspace URL (including `https://`); verify the endpoint exists in Databricks UI > Serving |
| Network timeout | Requests time out with no response | Firewall or network policy blocking outbound HTTPS from n8n host to Pay-i | Confirm the n8n host can reach your Pay-i Base URL on port 443: `curl -v https://api.yourcompany.pay-i.com` |

### Getting Help

If the table above doesn't resolve your issue, contact Pay-i support with the details below. Providing this upfront significantly reduces back-and-forth.

| Channel | Link |
|---------|------|
| Email | [support@pay-i.com](mailto:support@pay-i.com) |
| Support portal | [https://www.pay-i.com/support](https://www.pay-i.com/support) |
| GitHub Issues | [https://github.com/Pay-i/n8n-nodes-payi/issues](https://github.com/Pay-i/n8n-nodes-payi/issues) |

**When reporting an issue, include:**

- `n8n-nodes-payi` package version (from `package.json` or `npm list n8n-nodes-payi`)
- n8n version (`n8n --version` or the version shown in n8n Settings)
- The Debug Log output from the failing execution (mask your API key — `pi_live_****` is fine)
- The full error message or HTTP status code
- Which provider is involved (OpenAI, Anthropic, Azure, Bedrock, Databricks)
- Your deployment method (Docker, systemd, bare metal)

---

*Last updated: 2026-03-27*
