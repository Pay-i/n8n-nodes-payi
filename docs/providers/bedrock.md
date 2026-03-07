# Pay-i Amazon Bedrock (Proxy)

Routes Amazon Bedrock chat model requests through the Pay-i proxy for cost tracking, budget enforcement, and usage analytics.

## Node Details

| Property | Value |
|----------|-------|
| Display Name | Pay-i Amazon Bedrock (Proxy) |
| Node Name | `lmChatPayiBedrock` |
| n8n Type | `n8n-nodes-payi.lmChatPayiBedrock` |
| LangChain Class | `ChatBedrockConverse` (`@langchain/aws`) |
| Proxy Path | `/api/v1/proxy/aws.bedrock` |

## Credentials

| Credential | Type | Source |
|------------|------|--------|
| Pay-i API | `payiApi` | Pay-i community node |
| AWS | `aws` | Built-in n8n credential |

The AWS credential provides Access Key ID, Secret Access Key, optional Session Token, and Region.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model ID |
| Region | No | From AWS credential | AWS region for the Bedrock endpoint |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |

## How It Works

```
n8n Workflow
  └─ Pay-i Amazon Bedrock (Proxy)
       ├─ Credentials: Pay-i API key + AWS credentials
       └─ POST via ChatBedrockConverse with endpointHost={payiProxy}
            Headers:
              xProxy-Api-Key: {payi_key}
            Auth:
              AWS SigV4 signing (Access Key + Secret Key)
```

The node uses `ChatBedrockConverse` from LangChain with `endpointHost` pointed at the Pay-i proxy (host only, no protocol prefix). AWS credentials are passed through for SigV4 request signing. Pay-i transparently forwards the signed request to the Bedrock endpoint in the specified region.

### Proxy Routing

Unlike the OpenAI and Anthropic nodes which use `baseURL`, Bedrock uses `endpointHost` — a hostname-only parameter. The node strips the protocol from the Pay-i proxy URL before passing it:

```
payiBaseUrl: https://api.company.pay-i.com
endpointHost: api.company.pay-i.com/api/v1/proxy/aws.bedrock
```

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAwsBedrock`

Existing AWS credentials are passed through automatically.
