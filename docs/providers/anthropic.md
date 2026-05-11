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

Both credentials are required. The Pay-i API key authenticates with the proxy; the Anthropic API key is forwarded to Anthropic for model authorization.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `claude-sonnet-4-6` | Anthropic model ID (e.g. `claude-sonnet-4-6`, `claude-opus-4-6`) |

### Options (collapsed)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Maximum Number of Tokens | number | 4096 | Maximum tokens to generate in the response |
| Sampling Temperature | number | 0.7 | Randomness control (0–1). Hidden when Extended Thinking is enabled. |
| Top K | number | -1 | Removes low-probability "long tail" responses. `-1` disables it. Hidden when Extended Thinking is enabled. |
| Top P | number | 1 | Nucleus sampling threshold (0–1). Hidden when Extended Thinking is enabled. |
| Enable Thinking | boolean | false | Enable Claude's extended thinking / reasoning mode |
| Thinking Budget (Tokens) | number | 10000 | Maximum tokens the model may use for thinking. Minimum 1024. Only shown when Enable Thinking is true. |

## How It Works

```
n8n Workflow
  └─ Pay-i Anthropic (Proxy)
       ├─ Credentials: Pay-i API key + Anthropic API key
       └─ POST {payiBaseUrl}/api/v1/proxy/anthropic/v1/messages
            Headers:
              xProxy-Api-Key:          {payi_key}
              xProxy-User-ID:          {userId}           (if set)
              xProxy-UseCase-Name:     {useCaseName}      (if set)
              xProxy-UseCase-ID:       {useCaseId}        (if set)
              xProxy-UseCase-Version:  {useCaseVersion}   (if set)
              xProxy-UseCase-Step:     {useCaseStep}      (if set)
              xProxy-UseCase-Properties: {properties}     (if set)
              xProxy-Limit-IDs:        {limitIds}         (if set)
              x-api-key:               {anthropic_key}
              anthropic-version:       2023-06-01
```

The node uses `ChatAnthropic` from `@langchain/anthropic` with `anthropicApiUrl` pointed at the Pay-i proxy (`{payiBaseUrl}/api/v1/proxy/anthropic`). Pay-i intercepts the request, records cost and usage data, applies any active budget limits, then transparently forwards it to Anthropic's Messages API.

**Auth split:** The Pay-i API key travels in `defaultHeaders` as `xProxy-Api-Key`. The Anthropic API key is passed to the `ChatAnthropic` constructor as `anthropicApiKey`, which the LangChain SDK sends as the standard `x-api-key` header. Pay-i's proxy reads `x-api-key` to authenticate with Anthropic on your behalf.

**Tracking headers** (`xProxy-*`) are only added when the corresponding tracking field is populated. They carry cost attribution metadata — user ID, use case name/ID/version/step, custom properties, and budget limit references — that Pay-i uses to aggregate spend by dimension.

## Extended Thinking

Extended Thinking is Claude's extended reasoning mode: the model silently works through a problem before producing a final response. It trades higher token consumption for measurably improved accuracy on complex tasks (math, multi-step reasoning, ambiguous instructions).

### How the Node Handles It

When **Enable Thinking** is `true`, the node injects `invocationKwargs` into the `ChatAnthropic` constructor:

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  },
  "max_tokens": 4096,
  "temperature": undefined,
  "top_k": undefined,
  "top_p": undefined
}
```

The `undefined` values are intentional — the Anthropic API **rejects requests** that include `temperature`, `top_k`, or `top_p` when thinking is enabled. Setting them to `undefined` ensures the LangChain SDK omits those fields from the serialized request body. The n8n UI hides these options automatically when Enable Thinking is checked.

### Thinking Budget vs. Max Tokens — Two Separate Limits

These are independent token ceilings that serve different purposes:

| Setting | Controls | What Happens When Hit |
|---------|----------|-----------------------|
| Thinking Budget | How many tokens the model may spend *reasoning internally* | Thinking stops; model proceeds to final answer with what it has |
| Max Tokens | How many tokens the *final response* may contain | Response is truncated |

A common misconfiguration is setting Max Tokens too low while enabling a large Thinking Budget. If Max Tokens < what the model needs for its answer (after thinking), the response truncates. Rule of thumb: set Max Tokens to at least as large as the expected output, independent of the Thinking Budget.

**Minimum Thinking Budget:** 1024 tokens (enforced by the UI). Values below this are rejected by the Anthropic API.

### Cost Impact

Thinking tokens are billed by Anthropic at the **output token rate** — the same rate as the visible response. A request with a 10,000-token thinking budget can therefore incur up to 10,000 additional output-rate tokens on top of the visible response, even though the thinking content is not returned to the caller.

Pay-i tracks thinking tokens through the custom token usage parser (`llmOutput.usage.input_tokens` + `output_tokens`), so thinking costs appear correctly in Pay-i's cost dashboards and are counted against any active budget limits.

**Practical guidance:** Start with the default 10,000-token budget and monitor Pay-i's token usage dashboard before increasing it. For production workflows, set a Limit in Pay-i to cap spending if thinking consumption exceeds expectations.

## Anthropic Pricing

Anthropic charges per token — input and output are priced separately. Current rates vary by model; refer to [Anthropic's pricing page](https://www.anthropic.com/pricing) for the latest figures.

Key billing points for this node:

- **Input tokens** — prompt text, conversation history, system prompts.
- **Output tokens** — the visible model response.
- **Thinking tokens** — billed at the output token rate; tracked separately by Pay-i. They do not appear in the response but count against your Anthropic invoice and any active Pay-i Limits.

Pay-i records all three token categories (via the custom `tokensUsageParser`) and surfaces them in cost breakdowns and Use Case rollups.

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAnthropic`

Existing Anthropic credentials are passed through automatically. The model name is preserved from the original node configuration.
