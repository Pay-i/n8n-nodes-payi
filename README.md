# n8n-nodes-payi

n8n community node for [Pay-i](https://pay-i.com) — add cost tracking, budget enforcement, and usage attribution to every LLM call in your n8n workflows.

## What is Pay-i?

[Pay-i](https://pay-i.com) is an AI cost management platform. It sits as a transparent proxy between your application and LLM providers (OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Databricks, and more), giving you:

- **Real-time cost visibility** — See the dollar cost of every LLM request as it happens, broken down by input/output tokens
- **Budget enforcement** — Set hard spending limits per user, team, use case, or workflow so costs never run away
- **Usage attribution** — Know exactly who and what is driving your AI spend with per-user and per-use-case tracking
- **Zero code changes** — Pay-i is a drop-in proxy. Your prompts, models, and provider API keys stay the same. Just route through Pay-i and you're tracked.

Learn more at [pay-i.com](https://pay-i.com) or read the [Pay-i documentation](https://docs.pay-i.com).

## Nodes

This package provides provider-specific chat model nodes and a generic proxy node:

### Chat Model Nodes (LangChain-compatible)

These nodes plug directly into n8n's **AI Agent** node as a chat model input. Each uses the provider's native n8n credential type — no need to re-enter API keys.

| Node | Provider | Credential | Docs |
|------|----------|------------|------|
| **Pay-i OpenAI (Proxy)** | OpenAI | `openAiApi` | [docs/providers/openai.md](docs/providers/openai.md) |
| **Pay-i Anthropic (Proxy)** | Anthropic | `anthropicApi` | [docs/providers/anthropic.md](docs/providers/anthropic.md) |
| **Pay-i Azure AI Foundry (Proxy)** | Azure OpenAI | `azureOpenAiApi` | [docs/providers/azure.md](docs/providers/azure.md) |
| **Pay-i Amazon Bedrock (Proxy)** | AWS Bedrock | `aws` | [docs/providers/bedrock.md](docs/providers/bedrock.md) |
| **Pay-i Databricks (Proxy)** | Databricks | `databricks` | [docs/providers/databricks.md](docs/providers/databricks.md) |

### Generic Proxy Node

| Node | Description |
|------|-------------|
| **Pay-i Proxy** | Direct HTTP proxy for any supported provider. Full control over the request body, provider, and model. Supports OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, and Databricks. |

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

> **AI Agent usage:** To use the Pay-i Chat Model nodes with n8n's AI Agent node, start n8n with `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

## Prerequisites

- A [Pay-i](https://pay-i.com) account and API key
- An API key or credential for at least one supported LLM provider

## Setup

### 1. Configure Pay-i Credentials

When you first add a Pay-i node to a workflow, n8n will prompt you to configure credentials:

- **API Key** — Your Pay-i API key (found in the Pay-i dashboard)
- **Base URL** — Defaults to `https://api.pay-i.com`. Change this only if you're using a self-hosted Pay-i instance.

### 2. Configure Provider Credentials

Each chat model node uses the provider's native n8n credential type. If you already have credentials configured for the native provider nodes (OpenAI, Anthropic, Azure, etc.), you can reuse them directly — no duplicate credential setup needed.

### 3. Add the Node to Your Workflow

For AI Agent workflows:
1. Add a **Chat Trigger** or **Manual Chat Trigger** node
2. Add an **AI Agent** node
3. Add the appropriate **Pay-i [Provider] (Proxy)** node and connect it to the AI Agent's "Chat Model" input
4. Configure the model parameters (model ID, endpoint name, etc.)

## Tracking Headers

Pay-i uses custom HTTP headers to associate requests with users, use cases, and budgets. All tracking fields are optional and have smart defaults.

| Field | Default | Description |
|-------|---------|-------------|
| **xProxy-User-ID** | _(empty)_ | User identifier for per-user cost attribution |
| **xProxy-UseCase-Name** | Workflow name | Use case name for tracking and KPI scoring |
| **xProxy-UseCase-ID** | `{provider}/{model}/{executionId}` | Unique instance ID for grouping requests |
| **xProxy-UseCase-Step** | Node name on canvas | Step within a multi-step workflow |

### Advanced Tracking (collapsed in UI)

These fields are available under the "Advanced Tracking" section and should typically only be modified with guidance from Pay-i Support:

| Field | Description |
|-------|-------------|
| **xProxy-UseCase-Version** | Version of the use case definition |
| **xProxy-UseCase-Properties** | JSON object of key-value properties |
| **xProxy-Limit-IDs** | Comma-separated list of Pay-i limit IDs to enforce |
| **Debug Logging** | Logs request URLs, headers, and routing details to the n8n server console |

## Supported Proxy Paths

All requests are routed through: `{PAYI_BASE_URL}/api/v1/proxy/{provider_path}`

| Provider | Proxy Path |
|----------|-----------|
| **OpenAI** | `openai/v1/chat/completions` |
| **Anthropic** | `anthropic/v1/messages` |
| **Azure OpenAI** | `azure.openai/openai/deployments/{name}/chat/completions` |
| **AWS Bedrock** | `aws.bedrock/{region}/model/{modelId}/converse` |
| **Databricks** | `openai/v1/chat/completions` (reuses OpenAI path with `xProxy-Provider-BaseUri`) |

## Migrating Existing Workflows

Already have n8n workflows calling OpenAI, Anthropic, Databricks, or other LLM providers natively? The **[payi-n8n-toolkit](https://github.com/pay-i/payi-n8n-toolkit)** can scan your n8n instance, find native LLM nodes, and replace them with Pay-i equivalents — rewiring all connections and credentials automatically.

```bash
export N8N_BASE_URL=http://localhost:5678
export N8N_API_KEY=your-n8n-api-key
export PAYI_BASE_URL=https://api.yourcompany.pay-i.com
export PAYI_API_KEY=your-payi-api-key

python3 migrate-workflows-to-payi.py --dry-run   # preview changes
python3 migrate-workflows-to-payi.py              # run migration
```

## Development

```bash
npm install     # Install dependencies
npm run build   # Build
npm run dev     # Watch mode
npm run lint    # Lint
```

### Local Testing

```bash
npm pack
cd ~/.n8n/nodes && npm install /path/to/n8n-nodes-payi-*.tgz
rm -rf ~/.n8n/.cache   # Clear n8n cache after updates
# Restart n8n
```

## Support

- Email: [support@pay-i.com](mailto:support@pay-i.com)
- Support Portal: [https://www.pay-i.com/support](https://www.pay-i.com/support)
- GitHub Issues: [https://github.com/pay-i/n8n-nodes-payi/issues](https://github.com/pay-i/n8n-nodes-payi/issues)

## License

MIT
