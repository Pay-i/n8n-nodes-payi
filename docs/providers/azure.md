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

The Azure OpenAI credential provides the resource name (or endpoint URL) and the API key. The node reads both to construct the upstream routing.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Deployment Name | Yes | — | The Azure deployment name (e.g. `gpt-4o-deployment`) |
| API Version | No | `2024-08-01-preview` | Azure OpenAI API version. Falls back to the credential's version if not set. |

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
              xProxy-Api-Key:          {payi_key}
              xProxy-Provider-BaseUri: {azure_endpoint}
              xProxy-PriceAs-Resource: {deployment_name}
              api-key:                 {azure_api_key}
```

The node uses `ChatOpenAI` (not `AzureChatOpenAI`) from LangChain because Azure OpenAI's wire format is identical to OpenAI. `ChatOpenAI` allows direct control over `baseURL` and headers, which is needed for Pay-i's proxy auth flow.

### Endpoint Resolution

The upstream Azure endpoint is determined from the credential:
- If the credential has an explicit `endpoint` field, that value is used directly
- Otherwise, it is constructed as `https://{resourceName}.openai.azure.com`

This endpoint is sent in the `xProxy-Provider-BaseUri` header so Pay-i knows where to forward the request.

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAzureOpenAi`

Existing Azure OpenAI credentials are passed through automatically.
