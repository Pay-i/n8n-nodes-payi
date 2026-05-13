# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.3.1-rc.1] - 2026-05-12

**Release candidate** for 0.3.1. Includes architectural rewrite of the Databricks routing path on top of the original 0.3.1 scope. Final 0.3.1 will tag once this RC validates in customer testing.

### Changed (Architectural)
- **Databricks proxy routing pivoted to native path.** Both the generic Pay-i Proxy node (when `Provider = Databricks`) and the Pay-i Databricks (Proxy) chat model node now route through Pay-i's Databricks-native proxy path: `/api/v1/proxy/databricks/serving-endpoints/{endpoint}/invocations`. Previously these used the OpenAI proxy path (`/api/v1/proxy/openai/v1/chat/completions`) with the model name in the request body. The new path is endpoint-aware (endpoint name encoded in the URL, lowercase `/invocations` suffix) and works for both OpenAI-compatible chat endpoints and custom MLflow models. The OpenAI proxy path is no longer used for Databricks.
- **Pay-i Databricks (Proxy) chat model uses a custom HTTP adapter, not ChatOpenAI.** LangChain's `ChatOpenAI` class hardcodes `/chat/completions` as the URL suffix it appends to the configured baseURL — incompatible with Pay-i's `/invocations` route. The chat model node now ships a custom `BaseChatModel` subclass that calls `/invocations` directly via `fetch`, parses both OpenAI-shape (`choices[].message.content`) and Databricks-native (`predictions[]`) responses, and exposes `bindTools()` so the n8n AI Agent (Tools Agent mode) can attach function-calling tools. Tool calls are parsed from the response and forwarded into LangChain's `AIMessage.tool_calls` for the agent's tool-routing flow.
- **Auto-fallback for PriceAs-Resource on custom endpoints.** When the user leaves the optional Price-As Resource field empty AND the Serving Endpoint Name does NOT start with `databricks-` (i.e. it's a custom MLflow deployment, not a foundation model), the node now sends `xProxy-PriceAs-Resource: databricks-gpt-5-4` automatically. Customers can still override explicitly by filling in the Price-As Resource field. Foundation-model endpoint names continue to be used as the resource directly.

### Changed (Breaking)
- **Renamed Databricks credential type** from `databricksApi` to `payiDatabricksApi` to avoid a collision with n8n's built-in `databricksApi` credential. n8n 2.19+ ships first-party Databricks support with the same credential type name but different field shape (`host`/`token` vs our `workspaceUrl`/`accessToken`); both registering under the same name caused undefined behavior in the credential registry. Display name changed from "Databricks API" to "Pay-i Databricks API". File and class renamed accordingly. Customers with existing `databricksApi` credentials in this package must recreate them as `Pay-i Databricks API`; zero affected at time of rename (no production deployments).

### Added
- `xProxy-PriceAs-Resource` header now sent by all proxy paths: Pay-i Proxy (all five providers) and the LangChain chat model nodes (OpenAI, Anthropic, Bedrock, Databricks). The value is the model name or serving endpoint name, depending on provider. Azure already sent this header; the addition brings the others in line. Required for Pay-i pricing engine to resolve per-model rates within a category.
- **Price-As Resource override field** on the Pay-i Databricks (Proxy) chat model node and the generic Pay-i Proxy node (when `Provider = Databricks`). Optional text field — when left empty, the Serving Endpoint Name is used as the cost-tracking resource (works for foundation models). When set, this value is sent as `xProxy-PriceAs-Resource` instead, allowing custom-named endpoints (e.g. `payi-devorg`) to be priced as their underlying foundation model (e.g. `databricks-gpt-5-4`).
- "Databricks" option in the Cloud Provider dropdown on both the Pay-i Proxy node (when Databricks provider is selected) and the Pay-i Databricks (Proxy) chat model node, for self-hosted, on-premises, or non-major-cloud deployments using `cloud.databricks.com`-pattern URLs. Sends `xProxy-PriceAs-Category: system.databricks.databricks`. Pay-i pricing-table registration for this category is pending (see sysops Q6).
- `databricksApi` credential wired into the Pay-i Proxy node — when `Provider = Databricks` is selected, the workspace URL and PAT come from a saved n8n credential rather than inline fields.
- `authenticate` block on the Pay-i Databricks API credential.
- Credential icons for Pay-i API and Pay-i Databricks API credential types.
- External codex metadata file (`Payi.node.json`).
- Deployment & Configuration Guide for self-hosted n8n (`docs/deployment-guide.md`).
- `CLAUDE.md` project guidance.
- `SBOM.md` software bill of materials.

### Changed
- **Drop cloud/selfhosted build profile toggle.** The `set-package-nodes.js` script and the `build:cloud` / `build:selfhosted` npm scripts have been removed. `package.json` now statically registers all 6 nodes — same shape as the previously-published 0.3.0 on npm. The toggle was a footgun: any tag-push could publish the cloud profile (1 node) and regress on customers expecting the selfhosted profile (6 nodes). Selfhosted is now the only supported distribution profile. The `npm run build` script is unchanged in behavior; the convenience aliases just go away.
- HTTP errors now throw `NodeApiError` instead of `NodeOperationError`.
- `Pay-i Databricks (Proxy)` chat model node uses our `payiDatabricksApi` credential (`workspaceUrl` / `accessToken`) instead of the external `n8n-nodes-databricks` package's `databricks` credential. Removes the hard dependency on a second community package.

### Fixed
- **Databricks proxy URL pattern.** Replaced the fabricated `<workspace>.ai-gateway.<domain>/mlflow` URL with the correct `<workspace>/serving-endpoints` path. The fabricated `ai-gateway` subdomain doesn't exist as a real Databricks endpoint and was being rejected by Pay-i's proxy with `invalid_provider_host`. Affects both the generic Pay-i Proxy node's Databricks branch and the Pay-i Databricks (Proxy) chat model node.
- Pay-i Proxy node showed no credential setup when `Provider = Databricks` was selected — workspace URL and PAT had to be pasted inline. Now uses the `Pay-i Databricks API` credential dropdown, matching the ergonomics of the other provider chat model nodes.
- Asset copy script now handles credentials directory and `.json` files.
- OpenAI / Anthropic / Azure / Bedrock provider docs upgraded with pricing context, endpoint routing details, and per-provider quirks.
- `eslint` upgraded from 8.57 to 10.x with flat config (`eslint.config.mjs`).
- Replaced `@typescript-eslint/parser` with unified `typescript-eslint` v8 package.
- Removed `gulp` dependency — icon copying uses a zero-dependency Node.js script.
- Removed `eslint-plugin-n8n-nodes-base` and `@eslint/eslintrc` — these enforced n8n Cloud scanner rules and were both incompatible with ESLint 10 and irrelevant to the selfhosted-only distribution profile.
- Expanded `.gitignore` to project standards.

### Known Limitations (Databricks chat model node)
- **Reduced n8n LLM telemetry.** Replacing ChatOpenAI with our custom HTTP adapter for the Databricks chat model node means n8n's native LangChain telemetry (per-call streaming chunks visible in the Execution UI, automatic retry attempt counts, some LangSmith span details) is not as rich as it was with ChatOpenAI. The `N8nLlmTracing` callback still fires for `handleLLMStart` / `handleLLMEnd`, so token counts and cost data record correctly — but streaming visualization and per-attempt retry details are not implemented. Tracked for follow-up work in a subsequent release.
- **No streaming yet** in the custom Databricks adapter — single-shot `_generate` only. Most n8n workflows don't depend on streaming, but agents that buffer-then-respond will appear less "live" than they did with ChatOpenAI.
- **Native MLflow responses lack token usage.** For custom MLflow endpoints that return `{predictions: [...]}` instead of OpenAI shape, `tokenUsage` is reported as zero. Cost tracking still works via Pay-i's PriceAs-Resource lookup, but per-call token counts are missing for these endpoints. Workaround: register the underlying foundation model via the Price-As Resource override field so Pay-i can resolve pricing.

### Security
- Resolved all 14 npm audit vulnerabilities (6 high, 8 moderate):
  - `braces@2.3.2` — uncontrolled resource consumption (via gulp)
  - `minimatch@3.1.2` — ReDoS (via eslint 8)
  - `flatted@<=3.4.1` — unbounded recursion DoS (via eslint 8)
  - `ajv@<6.14.0` — ReDoS (via eslint 8)

## [0.3.0] - 2026-03-06

### Added
- Provider-specific chat model nodes for OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, and Databricks
- `PayiChatModelAnthropic.node.ts` — uses native `anthropicApi` credential
- `PayiChatModelAzure.node.ts` — uses native `azureOpenAiApi` credential
- `PayiChatModelBedrock.node.ts` — uses native `aws` credential
- `PayiChatModelDatabricks.node.ts` — uses native `databricks` credential
- `DatabricksApi.credentials.ts` — Databricks credential type
- Per-provider documentation in `docs/providers/`

### Changed
- Original `PayiChatModel.node.ts` now serves as the OpenAI-specific chat model
- README rewritten with provider table and migration toolkit reference

## [0.2.4] - 2026-03-01

### Fixed
- Use correct `token` input name for `actions/setup-node` in publish workflow

## [0.2.3] - 2026-02-28

### Fixed
- Match `repository.url` exactly to GitHub repo URL for npm provenance verification

## [0.2.2] - 2026-02-27

### Fixed
- Explicitly wire `NODE_AUTH_TOKEN` through setup-node and publish step in CI

## [0.2.1] - 2026-02-26

### Fixed
- Repository URL corrected in `package.json`

### Added
- `clean` script added to build pipeline

## [0.2.0] - 2026-02-23

### Added
- **Pay-i Chat Model** node for AI Agent integration (`lmChatPayi`)
  - LangChain-compatible chat model that plugs into n8n's AI Agent node
  - Routes OpenAI-compatible requests through the Pay-i proxy
  - Supports all Pay-i tracking headers (User ID, Use Case, Limits, etc.)
  - Configurable model options: temperature, max tokens, frequency/presence penalty, top P, timeout, max retries
- Example workflow: `ai-agent-chat.json`

## [0.1.0] - 2026-02-19

### Added
- Initial release of the Pay-i Proxy node for n8n
- Supported providers: OpenAI, Anthropic, Azure OpenAI, AWS Bedrock
- Pay-i tracking headers: xProxy-Request-Tags, xProxy-User-ID, xProxy-UseCase-Name, xProxy-UseCase-ID, xProxy-UseCase-Version, xProxy-UseCase-Step, xProxy-UseCase-Properties, xProxy-Limit-IDs
- Cost data output (payiCost) with toggle
- Raw Request Body Override
- Debug Logging with masked API keys and redacted body content

### Security
- HTTPS enforcement on Pay-i Base URL
- Header injection protection
- API key masking in debug logs
- Request body redacted to shapes only in debug logs
- Node.js >= 18 required
