# Pay-i Databricks (Proxy)

Routes Databricks Model Serving chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

> **This node works for standard Databricks Model Serving endpoints** — endpoints that expose the OpenAI-compatible `chat/completions` path under `/serving-endpoints` on your workspace URL. If you're using **Agent Bricks**, or need to import historical usage data, the proxy path isn't available for those workload types. Contact [Pay-i support](https://www.pay-i.com/support) about post-hoc ingestion options for those workloads.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Databricks (Proxy) |
| Node Name | `lmChatPayiDatabricks` |
| n8n Type | `n8n-nodes-payi.lmChatPayiDatabricks` |
| LangChain Class | `ChatOpenAI` (`@langchain/openai`) |
| Proxy Path | `/api/v1/proxy/openai/v1` (reuses OpenAI path) |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| Pay-i Databricks API | `payiDatabricksApi` | Pay-i community node |

The Pay-i Databricks API credential stores the workspace URL (`workspaceUrl`) and Personal Access Token (`accessToken`). The credential type is namespaced as `payiDatabricksApi` to avoid collision with n8n's built-in `databricksApi` credential (which uses different field names: `host`/`token`).

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Endpoint Name | Yes | — | Databricks serving endpoint name (for example, `databricks-meta-llama-3-1-70b-instruct` or `databricks-claude-3-7-sonnet`) |
| Cloud Provider | Yes | `AWS` | Cloud where the workspace is hosted: AWS, Azure, or Google Cloud (GCP). Used for pricing. |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature (0-2) |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |
| Frequency Penalty | number | Penalize repeated tokens (-2 to 2) |
| Presence Penalty | number | Penalize tokens already in the conversation (-2 to 2) |

## How It Works

```
n8n Workflow
  └─ Pay-i Databricks (Proxy)
       ├─ Credentials: Pay-i API key + Databricks PAT
       └─ POST {payiBaseUrl}/api/v1/proxy/openai/v1/chat/completions
            Headers:
              xProxy-Api-Key:          {payi_key}
              xProxy-Provider-BaseUri: {workspace_url}/serving-endpoints
              xProxy-PriceAs-Category: system.databricks.{cloud}
              Authorization:           Bearer {databricks_pat}
```

Databricks Model Serving exposes an OpenAI-compatible chat/completions endpoint, so the node uses `ChatOpenAI` from LangChain and routes through Pay-i's existing OpenAI proxy path. No dedicated Databricks proxy path is needed.

### Provider Base URI

The node points Pay-i at the workspace's Model Serving entry point — `<workspace>/serving-endpoints`. The Pay-i proxy appends `/chat/completions`, so the upstream call lands on Databricks' OpenAI-compatible chat endpoint:

| Cloud | Workspace URL | Provider Base URI |
|-------|--------------|-------------------|
| AWS | `https://{id}.cloud.databricks.com` | `https://{id}.cloud.databricks.com/serving-endpoints` |
| GCP | `https://{id}.cloud.databricks.com` | `https://{id}.cloud.databricks.com/serving-endpoints` |
| Azure | `https://adb-{id}.azuredatabricks.net` | `https://adb-{id}.azuredatabricks.net/serving-endpoints` |

### Pricing Headers

The `xProxy-PriceAs-Category` header tells Pay-i which pricing table to use:

| Cloud | Header Value |
|-------|-------------|
| AWS | `system.databricks.aws` |
| Azure | `system.databricks.azure` |
| GCP | `system.databricks.google` |

The cloud provider cannot be reliably inferred from the workspace URL alone (AWS and GCP both use `.cloud.databricks.com`), so the user selects it via a dropdown.

## Cloud-Specific Setup

Databricks runs on AWS, Azure, and GCP. While the Pay-i node works identically across all three, the workspace setup, URL patterns, and pricing differ per cloud. This section covers what you need to know for each.

### AWS

AWS is the most common Databricks deployment and the node's default cloud provider selection.

**Workspace URL pattern:** `https://{workspace-id}.cloud.databricks.com`

The workspace ID is a numeric identifier (for example, `1234567890123456`). You can find your workspace URL in the Databricks account console or by looking at the browser URL when logged into your workspace.

**Credential:** A Databricks Personal Access Token (PAT) generated from your AWS-hosted workspace under **User Settings > Developer > Access Tokens**. Stored in n8n as a `Pay-i Databricks API` credential (workspace URL + PAT).

**Provider Base URI:** Built automatically as `https://{workspace-id}.cloud.databricks.com/serving-endpoints`.

**Cloud Provider dropdown:** Select **AWS**.

### Google Cloud (GCP)

GCP workspaces use the same domain as AWS (`cloud.databricks.com`), which is why the cloud provider must be selected manually in the node.

**Workspace URL pattern:** `https://{workspace-id}.cloud.databricks.com`

The workspace ID format is the same as AWS — a numeric identifier. The URL alone does not distinguish a GCP workspace from an AWS one.

**Credential:** A Databricks Personal Access Token (PAT) from your GCP-hosted workspace under **User Settings > Developer > Access Tokens**. GCP workspaces use the same PAT mechanism as AWS.

**Provider Base URI:** Built automatically as `https://{workspace-id}.cloud.databricks.com/serving-endpoints` — same shape as AWS.

**Cloud Provider dropdown:** Select **Google Cloud (GCP)**. This is critical for accurate pricing — GCP and AWS have different DBU rates, and selecting the wrong cloud will cause Pay-i to apply the wrong pricing table.

### Azure

Azure Databricks is a first-party Azure service with its own distinct URL pattern, making it the easiest to identify.

**Workspace URL pattern:** `https://adb-{workspace-id}.azuredatabricks.net`

The workspace ID is prefixed with `adb-` and uses the `.azuredatabricks.net` domain. You can find this in the Azure portal under your Databricks resource's **Overview** page, or in the browser URL when logged into the workspace.

**Credential:** A Databricks Personal Access Token (PAT) from your Azure-hosted workspace under **User Settings > Developer > Access Tokens**. Alternatively, Azure Databricks supports Microsoft Entra ID (formerly Azure Active Directory / AAD) token-based auth, but the node currently requires a PAT.

**Provider Base URI:** Built automatically as `https://adb-{workspace-id}.azuredatabricks.net/serving-endpoints`.

**Cloud Provider dropdown:** Select **Azure**.

> **Note:** Azure Databricks workspaces are detectable by their `.azuredatabricks.net` domain, but the node still requires you to select the cloud provider explicitly to keep the behavior consistent across all clouds.

## Pricing

Databricks charges for Model Serving in Databricks Units (DBU) per 1M tokens. The DBU rate depends on the model and endpoint, while the DBU price depends on your cloud provider and pricing plan.

**Cost per 1M tokens = (DBU rate) × (DBU price per DBU)**

### DBU Prices by Cloud

DBU prices differ across clouds. These are list prices for Serverless Real-Time Inference — your contracted rate may vary:

| Cloud | DBU Price (list) | Notes |
|-------|-----------------|-------|
| AWS | $0.070 / DBU | Standard Databricks pricing |
| Azure | $0.070 / DBU | Azure Databricks first-party pricing; may differ under Azure commitments or enterprise agreements |
| GCP | $0.070 / DBU | Same list rate; verify with your Databricks account team for GCP-specific contracts |

> **Important:** The list prices above are approximate and subject to change. Your actual DBU price depends on your Databricks contract, commitment tier, and cloud-specific agreements. Check your Databricks account page or contact your Databricks account team for your actual rate.

### Example: Cost Calculation

For a model endpoint with a DBU rate of 25.00 input / 200.00 output per 1M tokens, at $0.07/DBU:

| | DBU / 1M tokens | Cost per 1M tokens | Per-token cost |
|---|---|---|---|
| Input | 25.00 | $1.75 | $0.00000175 |
| Output | 200.00 | $14.00 | $0.00001400 |

### Finding Your Rates

- **DBU rate per model:** Your Databricks workspace **Serving** page shows the DBU rate for each endpoint
- **DBU price per cloud:** Your Databricks account console or invoice shows your contracted DBU price
- **Pay-i tracking:** Pay-i uses the `xProxy-PriceAs-Category` header to select the correct cloud-specific pricing table and calculates the dollar cost per request automatically

## Migration

The n8n migration toolkit automatically detects the following native nodes and replaces them with this Pay-i node:

- `n8n-nodes-databricks.databricks`
- `n8n-nodes-databricks.lmChatDatabricks`
- `n8n-nodes-databricks.databricksAiAgent`

Existing native Databricks credentials (`host` / `token`) are mapped onto the Pay-i `Pay-i Databricks API` credential (`workspaceUrl` / `accessToken`) by the toolkit. The endpoint name is extracted from the native node's `endpoint`, `endpointName`, or `model` parameter. Cloud provider defaults to AWS.

---

*For Agent Bricks, historical data import, and other workloads not exposed via `/serving-endpoints`, contact [Pay-i support](https://www.pay-i.com/support) about post-hoc ingestion options.*
