# Changelog

## 0.2.0 (2026-02-23)

### Features
- **Pay-i Chat Model** node for AI Agent integration (`lmChatPayi`)
  - LangChain-compatible chat model that plugs into n8n's AI Agent node
  - Routes OpenAI-compatible requests through the Pay-i proxy
  - Supports all Pay-i tracking headers (User ID, Use Case, Limits, etc.)
  - Configurable model options: temperature, max tokens, frequency/presence penalty, top P, timeout, max retries
- New example workflow: `ai-agent-chat.json` — Manual Chat Trigger + AI Agent + Pay-i Chat Model

## 0.1.0 (2026-02-19)

Initial release of the Pay-i Proxy node for n8n.

### Features
- Route LLM requests through Pay-i proxy for cost tracking and budget enforcement
- Supported providers: OpenAI, Anthropic, Azure OpenAI, AWS Bedrock
- Pay-i tracking headers: xProxy-Request-Tags, xProxy-User-ID, xProxy-UseCase-Name, xProxy-UseCase-ID, xProxy-UseCase-Version, xProxy-UseCase-Step, xProxy-UseCase-Properties, xProxy-Limit-IDs
- Cost data output (payiCost) with toggle to include/exclude
- Raw Request Body Override for full control of the API payload
- Debug Logging toggle with masked API keys and redacted body content
- Automatic request correlation via n8n execution ID (xProxy-Request-Tags default)

### Security
- HTTPS enforcement on Pay-i Base URL (prevents SSRF)
- Header injection protection (newline/null byte sanitization on all tracking fields)
- API key masking in debug logs (first 8 chars shown, rest masked)
- Request body redacted to shapes only in debug logs (no PII/prompt leakage)
- Field-specific JSON parse error messages (no raw stack traces exposed)
- Node.js >= 18 required (enforced via engines field)

### Verified Against Pay-i SDKs
- Proxy paths confirmed against pay-i-python `helpers.py` and pay-i-typescript SDK
- Response field `xproxy_result` confirmed from TypeScript SDK `XproxyResult` type
- Auth header `xProxy-Api-Key` confirmed from both SDKs
