# n8n-nodes-payi

n8n community node for routing LLM requests through the [Pay-i](https://pay-i.com) proxy for cost tracking, budget enforcement, and usage analytics.

## What is Pay-i?

Pay-i acts as a transparent proxy between your application and LLM providers. Every request routed through Pay-i is automatically tracked for cost, usage, and performance — giving you real-time visibility and budget controls without changing your prompts or model logic.

## Installation

### Community Node (Recommended)

1. In your n8n instance, go to **Settings > Community Nodes**
2. Select **Install a community node**
3. Enter `n8n-nodes-payi`
4. Agree to the risks and click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-payi
```

Restart n8n after installing.

## Prerequisites

- A [Pay-i](https://pay-i.com) account and API key
- An API key for at least one supported LLM provider

## Supported Providers

| Provider | Proxy Path | Auth Header |
|----------|-----------|-------------|
| **OpenAI** | `openai/v1/chat/completions` | `Authorization: Bearer <key>` |
| **Anthropic** | `anthropic/v1/messages` | `x-api-key: <key>` |
| **Azure OpenAI** | `azure.openai/openai/deployments/{name}/chat/completions` | `api-key: <key>` |
| **AWS Bedrock** | `aws.bedrock/{region}/model/{modelId}/converse` | `x-amz-access-key-id` + `x-amz-secret-access-key` |

All requests are routed through: `{PAYI_BASE_URL}/api/v1/proxy/{provider_path}`

## Setup

### 1. Configure Pay-i Credentials

When you first add the Pay-i Proxy node to a workflow, n8n will prompt you to configure credentials:

- **API Key** — Your Pay-i API key (found in the Pay-i dashboard)
- **Base URL** — Defaults to `https://api.pay-i.com`. Change this only if you're using a self-hosted Pay-i instance.

The API key is sent to Pay-i via the `xProxy-Api-Key` header on every request.

### 2. Configure the Node

| Field | Description |
|-------|-------------|
| **Provider** | Select the LLM provider (OpenAI, Anthropic, Azure OpenAI, or AWS Bedrock) |
| **Model Provider API Key** | Your API key for the selected provider |
| **Model ID** | The model identifier (e.g. `gpt-4o`, `claude-sonnet-4-20250514`, `us.anthropic.claude-3-5-sonnet-20241022-v2:0`) |
| **Messages** | JSON array of messages in the provider's chat format |
| **Raw Request Body Override** | Optional — when set, sends this JSON body verbatim, bypassing structured fields |

#### Provider-Specific Fields

**Azure OpenAI** additionally requires:
- **Azure Deployment Name** — Your Azure OpenAI deployment name
- **Azure API Version** — API version (default: `2024-02-01`)

**AWS Bedrock** additionally requires:
- **AWS Secret Access Key** — Your AWS secret key
- **AWS Session Token** — Optional, for temporary credentials
- **AWS Region** — AWS region (default: `us-east-1`)

## Tracking Headers

Pay-i uses custom HTTP headers to associate requests with users, use cases, and budgets. All tracking fields are optional.

| Field (Header Name) | Description |
|---------------------|-------------|
| **xProxy-Request-Tags** | Comma-separated tags for this request. Defaults to the n8n execution ID for automatic correlation across nodes in the same workflow run. |
| **xProxy-User-ID** | User identifier for per-user cost attribution |
| **xProxy-UseCase-Name** | Use case definition name for tracking and KPI scoring |
| **xProxy-UseCase-ID** | Unique instance ID. Same name + ID groups requests for KPI evaluation. |
| **xProxy-UseCase-Version** | Version of the use case definition |
| **xProxy-UseCase-Step** | Step within a multi-step use case |
| **xProxy-UseCase-Properties** | JSON object of key-value properties (e.g. `{"department": "support"}`) |
| **xProxy-Limit-IDs** | Comma-separated list of Pay-i limit IDs to enforce |

### Additional Headers (not in node UI)

These Pay-i headers are supported by the proxy but not exposed in the node UI. You can send them via the **Raw Request Body Override** or by extending the node:

| Header | Description |
|--------|-------------|
| `xProxy-Account-Name` | Account name for multi-tenant tracking |
| `xProxy-Request-Properties` | JSON object of request-level properties |
| `xProxy-PriceAs-Category` | Override pricing category |
| `xProxy-PriceAs-Resource` | Override pricing resource |
| `xProxy-Resource-Scope` | Resource scope (`global`, `datazone`, `region`) |
| `xProxy-Provider-BaseUri` | Override provider base URI |
| `xProxy-Logging-Disable` | Set to `True` to disable prompt/response logging |

## Output

### Cost Data

When **Include Cost Data** is enabled (default: on), the Pay-i cost tracking response is included in the output as `payiCost`:

```json
{
  "id": "chatcmpl-...",
  "choices": [...],
  "payiCost": {
    "request_id": "...",
    "cost": {
      "input": { "base": 0.0015 },
      "output": { "base": 0.002 },
      "total": { "base": 0.0035 }
    },
    "limits": { ... },
    "user_id": "...",
    "use_case_name": "..."
  }
}
```

When disabled, the `xproxy_result` field is stripped from the response entirely.

### Full Response

When **Return Full Response** is enabled, the output includes HTTP status code and response headers in addition to the body.

## How It Works

```
n8n Workflow
    |
    v
[Pay-i Proxy Node]
    |  1. Builds provider-specific request (URL, headers, body)
    |  2. Adds Pay-i auth header (xProxy-Api-Key)
    |  3. Adds tracking headers (user, use case, limits, tags)
    |
    v
Pay-i Proxy (api.pay-i.com/api/v1/proxy/...)
    |  - Authenticates via xProxy-Api-Key
    |  - Forwards request to actual provider
    |  - Tracks cost, usage, and latency
    |  - Enforces budget limits
    |  - Returns provider response + xproxy_result
    |
    v
LLM Provider (OpenAI, Anthropic, Azure, Bedrock)
    |
    v
Response flows back through Pay-i -> n8n
    |  - Cost data extracted into payiCost (if enabled)
    |  - xproxy_result stripped from output (if cost data disabled)
```

## Cross-Reference with Pay-i Documentation

This node implements the [Pay-i proxy pattern](https://docs.pay-i.com) using the same URL paths and header conventions as the official Pay-i SDKs:

- **Python SDK**: [pay-i-python](https://github.com/Pay-i/pay-i-python) — `payi_openai_url()`, `payi_anthropic_url()`, etc.
- **TypeScript SDK**: [pay-i-typescript](https://github.com/Pay-i/pay-i-typescript) — `XproxyResult` type, header definitions

### Verified Against SDK Sources

| Item | SDK Value | Node Implementation |
|------|-----------|---------------------|
| Auth header | `xProxy-Api-Key` | `xProxy-api-key` (case-insensitive) |
| OpenAI base | `/api/v1/proxy/openai/v1` | `openai/v1/chat/completions` |
| Anthropic base | `/api/v1/proxy/anthropic` | `anthropic/v1/messages` |
| Azure OpenAI base | `/api/v1/proxy/azure.openai` | `azure.openai/openai/deployments/...` |
| AWS Bedrock base | `/api/v1/proxy/aws.bedrock` | `aws.bedrock/{region}/model/{model}/converse` |
| Response field | `xproxy_result` | `xproxy_result` (renamed to `payiCost`) |
| Cost structure | `XproxyResult.Cost` | Passed through as-is |

### Not Yet Supported

- **Google Vertex AI** — Commented out in the Pay-i Python SDK; will be added when officially supported
- **Azure Anthropic** — Supported by Pay-i (`/api/v1/proxy/azure.anthropic`) but not yet in this node

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint
npm run lint:fix
```

### Local Testing

```bash
# Pack the node
npm pack

# Install into n8n
cd ~/.n8n/nodes
npm install /path/to/n8n-nodes-payi-0.1.0.tgz

# Clear n8n cache (important after updates)
rm -rf ~/.n8n/.cache

# Restart n8n
```

## License

MIT
