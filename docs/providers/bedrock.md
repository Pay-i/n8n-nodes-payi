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

The AWS credential provides the Access Key ID, Secret Access Key, optional Session Token, and Region used for both SigV4 request signing and the Bedrock endpoint target.

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Model | Yes | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model ID (for example, `anthropic.claude-3-5-sonnet-20241022-v2:0` or `amazon.titan-text-express-v1`) |
| Region | No | From AWS credential (falls back to `us-east-1`) | AWS region for the Bedrock endpoint |

### Options (collapsed)

| Option | Type | Description |
|--------|------|-------------|
| Temperature | number | Sampling temperature (0–1) |
| Max Tokens | number | Maximum tokens in the response |
| Top P | number | Nucleus sampling threshold |

## How It Works

```
n8n Workflow
  └─ Pay-i Amazon Bedrock (Proxy)
       ├─ Credentials: Pay-i API key + AWS credentials (Access Key, Secret Key, Session Token)
       └─ ChatBedrockConverse → endpointHost={payiProxy}
            Headers:
              xProxy-Api-Key:      {payi_key}
              xProxy-User-ID:      {userId}         (if set)
              xProxy-UseCase-Name: {useCaseName}    (if set)
              xProxy-UseCase-ID:   {useCaseId}      (if set)
            Auth:
              AWS SigV4 (signed against the Pay-i proxy host, not Bedrock)
```

The node uses `ChatBedrockConverse` from `@langchain/aws` with `endpointHost` pointed at the Pay-i proxy (hostname only — no `https://` prefix). AWS credentials are passed directly to the LangChain client for SigV4 signing. Pay-i receives the signed request and forwards it to the real Bedrock endpoint in the specified region.

## Proxy Routing

Every other Pay-i provider node (`ChatOpenAI`, `ChatAnthropic`, `ChatOpenAI`-via-Databricks) accepts a `baseURL` parameter — a full URL including protocol (`https://...`). Bedrock does not. `ChatBedrockConverse` uses `endpointHost`, which must be a **hostname only**, with no protocol prefix. `ChatBedrockConverse` prepends `https://` internally.

To accommodate this, the node explicitly strips the protocol from the Pay-i base URL before passing it as `endpointHost`:

```typescript
// Line 107 — PayiChatModelBedrock.node.ts
const proxyHost = `${payiBaseUrl}/api/v1/proxy/aws.bedrock`.replace(/^https?:\/\//, '');
```

**Example:**

| | Value |
|---|---|
| `payiBaseUrl` (from credential) | `https://api.yourcompany.pay-i.com` |
| `endpointHost` (passed to LangChain) | `api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock` |
| Final request URL (assembled by LangChain) | `https://api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock/...` |

**Normal Bedrock request (direct):**

```
POST https://bedrock-runtime.us-east-1.amazonaws.com/model/{modelId}/converse
Authorization: AWS4-HMAC-SHA256 Credential={key}/...
```

**Proxied through Pay-i:**

```
POST https://api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock/model/{modelId}/converse
xProxy-Api-Key: {payi_key}
Authorization: AWS4-HMAC-SHA256 Credential={key}/...
```

The request shape is identical. Only the host changes.

## SigV4 Request Signing

AWS SigV4 signing happens inside the LangChain `ChatBedrockConverse` client using the credentials provided to the node. There are a few things to know about how this interacts with the Pay-i proxy:

1. **The LangChain client signs the request targeting the Pay-i proxy host** — not the real Bedrock endpoint. The `Authorization` header is computed against `api.yourcompany.pay-i.com/api/v1/proxy/aws.bedrock/...`.
2. **Pay-i receives the signed request** with the `xProxy-Api-Key` header and the AWS `Authorization` header, validates the Pay-i key, records the request for cost tracking, and forwards the full signed request to the real Bedrock endpoint.
3. **Your AWS Secret Access Key never leaves your n8n instance.** It is used only to compute the HMAC signature and is never transmitted. The Access Key ID appears in the `Authorization` header as part of the SigV4 credential string, but carries no privileged capabilities on its own.

If you encounter SigV4 signing errors (e.g., `InvalidSignatureException`), verify that:
- The region in the node matches the region configured in the AWS credential.
- The Pay-i proxy is correctly forwarding the `Authorization` header without modification.
- Contact Pay-i support to confirm the exact proxy forwarding behavior for your deployment.

## Amazon Bedrock Pricing

Amazon Bedrock charges per token, with rates that vary by model family, model version, and AWS region.

**Pricing types:**

| Type | Description |
|------|-------------|
| On-Demand | Pay per token with no commitment. Default for most workloads. |
| Provisioned Throughput | Reserve model throughput for consistent latency. Charged hourly. |
| Batch Inference | Asynchronous processing at reduced per-token rates. |

Pay-i records token counts and estimated cost for every request. Costs are visible in the Pay-i dashboard per user, Use Case, and time period.

For current per-token rates by model and region, see the [AWS Bedrock Pricing page](https://aws.amazon.com/bedrock/pricing/).

## Migration

The n8n migration toolkit automatically detects the following native node and replaces it with this Pay-i node:

- `@n8n/n8n-nodes-langchain.lmChatAwsBedrock`

Existing AWS credentials are passed through automatically.
