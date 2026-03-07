# Pay-i Databricks (Proxy)

Routes Databricks Model Serving chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

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
| Databricks | `databricks` | Native credential from `n8n-nodes-databricks` community node |

The Databricks credential provides the workspace URL (`host`) and Personal Access Token (`token`).

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Endpoint Name | Yes | — | Databricks serving endpoint name (e.g. `databricks-gpt-5-4`) |
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
              xProxy-Provider-BaseUri: {ai_gateway_url}
              xProxy-PriceAs-Category: system.databricks.{cloud}
              Authorization:           Bearer {databricks_pat}
```

Databricks Model Serving exposes an OpenAI-compatible chat/completions endpoint, so the node uses `ChatOpenAI` from LangChain and routes through Pay-i's existing OpenAI proxy path. No dedicated Databricks proxy path is needed.

### AI Gateway URL Derivation

The node automatically derives the Databricks AI Gateway URL from the workspace URL by inserting `ai-gateway.` before the domain and appending `/mlflow`:

| Cloud | Workspace URL | AI Gateway URL |
|-------|--------------|----------------|
| AWS | `https://{id}.cloud.databricks.com` | `https://{id}.ai-gateway.cloud.databricks.com/mlflow` |
| GCP | `https://{id}.cloud.databricks.com` | `https://{id}.ai-gateway.cloud.databricks.com/mlflow` |
| Azure | `https://{id}.azuredatabricks.net` | `https://{id}.ai-gateway.azuredatabricks.net/mlflow` |

### Pricing Headers

The `xProxy-PriceAs-Category` header tells Pay-i which pricing table to use:

| Cloud | Header Value |
|-------|-------------|
| AWS | `system.databricks.aws` |
| Azure | `system.databricks.azure` |
| GCP | `system.databricks.google` |

The cloud provider cannot be reliably inferred from the workspace URL alone (AWS and GCP both use `.cloud.databricks.com`), so the user selects it via a dropdown.

## Databricks Pay-Per-Token Pricing

Databricks charges in DBUs per 1M tokens. To convert to dollar cost:

**Cost per 1M tokens = (DBU rate) × (DBU price)**

For example, with `databricks-gpt-5-4` at $0.07/DBU:

| | DBU / 1M tokens | Per-token cost |
|---|---|---|
| Input | 25.00 | $0.00000175 |
| Output | 200.00 | $0.00001400 |

Check your Databricks workspace **Serving** page for the DBU rates for your specific endpoint.

## Migration

The n8n migration toolkit automatically detects the following native nodes and replaces them with this Pay-i node:

- `n8n-nodes-databricks.databricks`
- `n8n-nodes-databricks.lmChatDatabricks`
- `n8n-nodes-databricks.databricksAiAgent`

Existing Databricks credentials are passed through automatically. The endpoint name is extracted from the native node's `endpoint`, `endpointName`, or `model` parameter. Cloud provider defaults to AWS.
