# n8n-nodes-payi

n8n community node for [Pay-i](https://pay-i.com) — add cost tracking, budget enforcement, and usage attribution to every LLM call in your n8n workflows.

## What is Pay-i?

[Pay-i](https://pay-i.com) is an AI cost management platform. It sits as a transparent proxy between your application and LLM providers (OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, and more), giving you:

- **Real-time cost visibility** — See the dollar cost of every LLM request as it happens, broken down by input/output tokens
- **Budget enforcement** — Set hard spending limits per user, team, use case, or workflow so costs never run away
- **Usage attribution** — Know exactly who and what is driving your AI spend with per-user and per-use-case tracking
- **Zero code changes** — Pay-i is a drop-in proxy. Your prompts, models, and provider API keys stay the same. Just route through Pay-i and you're tracked.

Learn more at [pay-i.com](https://pay-i.com) or read the [Pay-i documentation](https://docs.pay-i.com).

## What Does This Node Do?

This package provides two n8n nodes that route your LLM requests through the Pay-i proxy:

| Node | Use Case |
|------|----------|
| **Pay-i Proxy** | Direct HTTP proxy for any supported provider. Drop it into any workflow to send LLM requests through Pay-i with full control over the request body, provider, and model. |
| **Pay-i Chat Model** | LangChain-compatible chat model that plugs into n8n's **AI Agent** node. Use it to add cost tracking to agent workflows without changing how the agent works. |

Both nodes automatically send Pay-i tracking headers (user ID, use case, budget limits) so every request is attributed and enforced.

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

> **AI Agent usage:** To use the Pay-i Chat Model with n8n's AI Agent node, start n8n with `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

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

## Pay-i Chat Model (AI Agent Integration)

The **Pay-i Chat Model** node is a LangChain-compatible chat model that plugs into n8n's AI Agent node. It routes OpenAI-compatible requests through the Pay-i proxy.

### Quick Start

1. Add a **Manual Chat Trigger** node
2. Add an **AI Agent** node and connect the trigger to it
3. Add a **Pay-i Chat Model** node and connect it to the AI Agent's "Chat Model" input
4. Configure the Pay-i Chat Model with your Pay-i credentials and OpenAI API key

### Chat Model Fields

| Field | Description |
|-------|-------------|
| **Model ID** | OpenAI model identifier (e.g. `gpt-4o`, `gpt-4.1-mini`) |
| **OpenAI API Key** | Your OpenAI API key (sent as Bearer token through the proxy) |
| **Options** | Temperature, max tokens, frequency/presence penalty, top P, timeout, max retries |

All [tracking headers](#tracking-headers) (User ID, Use Case, Limits, etc.) are also available on the Chat Model node.

## Tracking Headers

Pay-i uses custom HTTP headers to associate requests with users, use cases, and budgets. All tracking fields are optional.

| Field (Header Name) | Description |
|---------------------|-------------|
| **xProxy-User-ID** | User identifier for per-user cost attribution |
| **xProxy-UseCase-Name** | Use case definition name for tracking and KPI scoring. Defaults to the workflow name. |
| **xProxy-UseCase-ID** | Unique instance ID. Same name + ID groups requests for KPI evaluation. Defaults to the n8n execution ID. |
| **xProxy-UseCase-Version** | Version of the use case definition |
| **xProxy-UseCase-Step** | Step within a multi-step use case |
| **xProxy-UseCase-Properties** | JSON object of key-value properties (e.g. `{"department": "support"}`) |
| **xProxy-Limit-IDs** | Comma-separated list of Pay-i limit IDs to enforce |

### Additional Headers (not in node UI)

These Pay-i headers are supported by the proxy but not exposed in the node UI. You can send them via the **Raw Request Body Override** or by extending the node:

| Header | Description |
|--------|-------------|
| `xProxy-Request-Tags` | Comma-separated tags for request correlation |
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
npm install /path/to/n8n-nodes-payi-0.2.0.tgz

# Clear n8n cache (important after updates)
rm -rf ~/.n8n/.cache

# Restart n8n
```

## Support

- Email: [support@pay-i.com](mailto:support@pay-i.com)
- Support Portal: [https://www.pay-i.com/support](https://www.pay-i.com/support)
- GitHub Issues: [https://github.com/pay-i/n8n-nodes-payi/issues](https://github.com/pay-i/n8n-nodes-payi/issues)

## License

MIT
