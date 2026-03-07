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
              xProxy-Api-Key:    {payi_key}
              x-api-key:         {anthropic_key}
              anthropic-version: 2023-06-01
```

The node uses `ChatAnthropic` from LangChain with `anthropicApiUrl` pointed at the Pay-i proxy. Pay-i transparently forwards the request to Anthropic, recording cost and usage data.

### Extended Thinking

When extended thinking is enabled, the node passes `thinking.type: "enabled"` with a configurable `budget_tokens` in the invocation kwargs. Temperature, top_k, and top_p are automatically unset when thinking mode is active (as required by the Anthropic API).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAnthropic`

Existing Anthropic credentials are passed through automatically.
