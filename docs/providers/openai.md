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
              xProxy-Api-Key: {payi_key}
              Authorization:  Bearer {openai_key}
```

The node uses `ChatOpenAI` from LangChain with `baseURL` pointed at the Pay-i proxy. Pay-i transparently forwards the request to OpenAI, recording cost and usage data.

## Migration

The n8n migration toolkit automatically detects the following native nodes and replaces them with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatOpenAi`
- `@n8n/n8n-nodes-langchain.lmChatOpenRouter`

Existing OpenAI credentials are passed through automatically.
