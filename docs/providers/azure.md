# Pay-i Azure AI Foundry (Proxy)

Routes Azure OpenAI (Azure AI Foundry) chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Azure AI Foundry (Proxy) |
| Node Name | `lmChatPayiAzure` |
| n8n Type | `n8n-nodes-payi.lmChatPayiAzure` |
| LangChain Class | `ChatOpenAI` (`@langchain/openai`) |
| Proxy Path | `/api/v1/proxy/azure.openai` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| Azure OpenAI API | `azureOpenAiApi` | Built-in n8n credential |

The Azure OpenAI credential provides the resource name or explicit endpoint URL and the API key. The node reads both fields to construct the upstream routing header sent to the Pay-i proxy.

## Endpoint Resolution

> **This is the most common Azure configuration issue.** Getting the endpoint wrong produces 404 or 502 errors with no obvious message.

The upstream Azure endpoint is resolved from the credential at runtime:

1. If the credential has an explicit `endpoint` field set, that value is used (trailing slashes stripped)
2. Otherwise, the endpoint is constructed as `https://{resourceName}.openai.azure.com`

The resolved endpoint is sent in the `xProxy-Provider-BaseUri` header so Pay-i knows where to forward the request.

### Examples

**Explicit endpoint (credential has `endpoint` set):**

| Credential Field | Value |
|-----------------|-------|
| `endpoint` | `https://my-company-east.openai.azure.com` |
| `resourceName` | _(ignored)_ |
| → `xProxy-Provider-BaseUri` | `https://my-company-east.openai.azure.com` |

**Constructed from resource name (no `endpoint` field):**

| Credential Field | Value |
|-----------------|-------|
| `endpoint` | _(empty)_ |
| `resourceName` | `my-company-east` |
| → `xProxy-Provider-BaseUri` | `https://my-company-east.openai.azure.com` |

If your Azure resource lives in a sovereign cloud or custom domain, always set the explicit `endpoint` field rather than relying on the constructed form.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Deployment Name | Yes | — | The Azure deployment name (for example, `gpt-4o-deployment`). Must match the name in Azure AI Foundry exactly. |
| API Version | No | `2024-08-01-preview` | Azure OpenAI API version string. See fallback chain below. |

### API Version Fallback Chain

The API version is resolved in priority order:

1. **Node parameter** — value entered in the **API Version** field on the node
2. **Credential value** — `apiVersion` field on the `azureOpenAiApi` credential (if set)
3. **Default** — `2024-08-01-preview`

The resolved version is appended as `?api-version={v}` on every request. Some features (structured outputs, Responses API, assistants v2) require specific minimum versions — set the node parameter explicitly when using those capabilities.

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
  └─ Pay-i Azure AI Foundry (Proxy)
       ├─ Credentials: Pay-i API key + Azure OpenAI API key
       └─ POST {payiBaseUrl}/api/v1/proxy/azure.openai/openai/deployments/{deployment}/chat/completions?api-version={v}
            Headers:
              xProxy-Api-Key:          {payi_api_key}
              xProxy-Provider-BaseUri: {azure_endpoint}      ← resolved per rules above
              xProxy-PriceAs-Resource: {deployment_name}     ← used for cost mapping
              api-key:                 {azure_api_key}        ← forwarded to Azure
              xProxy-User-ID:          {userId}               ← optional tracking
              xProxy-UseCase-Name:     {useCaseName}          ← optional tracking
              xProxy-UseCase-ID:       {useCaseId}            ← optional tracking
              xProxy-UseCase-Version:  {useCaseVersion}       ← optional tracking
              xProxy-UseCase-Step:     {useCaseStep}          ← optional tracking
              xProxy-UseCase-Properties: {useCaseProperties}  ← optional tracking
              xProxy-Limit-IDs:        {limitIds}             ← optional tracking
```

### Why `ChatOpenAI` and not `AzureChatOpenAI`

The node uses `ChatOpenAI` from `@langchain/openai` rather than `AzureChatOpenAI` for three reasons:

1. **Wire format is identical** — Azure OpenAI uses the same JSON schema as OpenAI for `chat/completions` requests
2. **Direct header control** — `ChatOpenAI` accepts `baseURL` and `defaultHeaders` in its configuration object, which is exactly what Pay-i's proxy flow requires
3. **Auth conflict** — `AzureChatOpenAI` performs its own internal auth header injection and request-time overrides that conflict with Pay-i's proxy authentication; using `ChatOpenAI` sidesteps that entirely

The result is a clean proxy path: the node constructs the full deployment URL, sets the `api-key` header once, and lets Pay-i handle routing.

## Azure OpenAI Pricing

Azure OpenAI pricing varies by deployment type:

| Deployment Type | Description |
|----------------|-------------|
| Standard (pay-as-you-go) | Per-token pricing; billed on actual usage |
| Provisioned Throughput (PTU) | Reserved capacity; billed per PTU-hour regardless of usage |
| Global Standard | Routes across Azure regions; same per-token rate as Standard |
| Data Zone Standard | Routes within a geographic data zone; similar to Global Standard |

Pay-i uses the `xProxy-PriceAs-Resource` header — set to the deployment name — to look up the correct pricing entry for cost tracking and budget enforcement. Ensure your deployment name in the node matches the resource name configured in your Pay-i account.

For current token rates by model, see the [Azure OpenAI pricing page](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAzureOpenAi`

Existing Azure OpenAI credentials are passed through automatically. The deployment name is extracted from the native node's `model` or `deploymentName` parameter.
