# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Deployment & Configuration Guide for self-hosted n8n (`docs/deployment-guide.md`)
- `CLAUDE.md` project guidance
- `SBOM.md` software bill of materials

### Changed
- OpenAI provider doc upgraded to full depth with pricing context and model reference
- Anthropic provider doc expanded with pricing context and extended thinking details
- Azure provider doc upgraded with prominent endpoint resolution guide and pricing context
- Bedrock provider doc expanded with detailed proxy routing explanation and pricing context
- Removed `gulp` dependency — icon copying now uses a zero-dependency Node.js script
- Upgraded `eslint` from 8.57 to 10.x with flat config (`eslint.config.mjs`)
- Replaced `@typescript-eslint/parser` with unified `typescript-eslint` v8 package
- Expanded `.gitignore` to project standards

### Security
- Resolved all 14 npm audit vulnerabilities (6 high, 8 moderate)
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
