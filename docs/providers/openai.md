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

The OpenAI credential provides the API key (`apiKey`) used as the `Authorization: Bearer` header forwarded to OpenAI.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `gpt-4o` | OpenAI model ID (for example, `gpt-4o`, `gpt-4o-mini`, or `o3-mini`). The node does not validate model IDs — any string is forwarded as-is. |

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
              xProxy-Api-Key:        {payi_key}
              xProxy-User-ID:        {userId}          (if set)
              xProxy-UseCase-Name:   {useCaseName}     (if set)
              xProxy-UseCase-ID:     {useCaseId}       (if set)
              Authorization:         Bearer {openai_key}
```

The node instantiates `ChatOpenAI` from `@langchain/openai` with `configuration.baseURL` pointed at `{payiBaseUrl}/api/v1/proxy/openai/v1` and `configuration.defaultHeaders` carrying the Pay-i proxy key and any tracking headers. The `Authorization: Bearer {openai_key}` header is set by LangChain from the `apiKey` field — Pay-i passes it through untouched to OpenAI.

OpenAI is the simplest routing path in the Pay-i node family. There is no endpoint URL derivation (compare Databricks, which transforms a workspace URL into an AI Gateway URL), and no special auth exchange. The proxy path is a fixed constant; the model ID is passed directly in the request body.

### Tracking Headers

The following headers are included in every request when their corresponding node fields are non-empty:

| Header | Node Field | Default Value |
|--------|------------|---------------|
| `xProxy-Api-Key` | _(Pay-i credential)_ | Required — always sent |
| `xProxy-User-ID` | User ID | _(empty, omitted)_ |
| `xProxy-UseCase-Name` | Use Case Name | `$workflow.name` (spaces → hyphens) |
| `xProxy-UseCase-ID` | Use Case ID | `openai/{model}/{executionId}` |
| `xProxy-UseCase-Step` | Use Case Step | Node name on canvas |

Advanced tracking headers (`xProxy-UseCase-Version`, `xProxy-UseCase-Properties`, `xProxy-Limit-IDs`) are available under the **Advanced Tracking** collection and should only be modified with guidance from Pay-i Support.

## Model IDs

The node does not validate or enumerate model IDs — any string entered in the **Model** field is forwarded directly to OpenAI. The following are common starting points:

| Model ID | Notes |
|----------|-------|
| `gpt-4o` | Default. Strong reasoning, multimodal input |
| `gpt-4o-mini` | Smaller, faster, lower cost |
| `gpt-4.1` | Latest generation — verify availability on your OpenAI account |
| `o3-mini` | Reasoning-optimized compact model |

## Known Limitations

- **Organization ID** — OpenAI supports an `OpenAI-Organization` header for routing requests to a specific org. This header is not currently passed through by the Pay-i node. If your account requires it, open a support request with Pay-i.

## OpenAI Pricing

OpenAI charges per token, billed separately for input (prompt) and output (completion). Rates vary by model and are updated periodically on the [OpenAI pricing page](https://openai.com/api/pricing/).

Pay-i tracks both input and output token counts on every request and converts them to actual dollar cost using the current rate table for the model. The Pay-i dashboard shows per-request cost, per-user cost, and aggregate spend broken down by model and Use Case.

Unlike DBU-based pricing (see [Databricks](databricks.md)), OpenAI pricing is a direct per-token dollar rate with no intermediate unit conversion.

## Migration

The n8n migration toolkit automatically detects the following native nodes and replaces them with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatOpenAi`
- `lmChatOpenRouter`

Existing OpenAI credentials are passed through automatically.
