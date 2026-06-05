# Software Bill of Materials

## Direct Dependencies

This package has zero runtime dependencies. All dependencies are dev-only (build tooling).

## Dev Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| @types/node | ^22 | MIT | Node.js type definitions |
| eslint | ^10 | MIT | Linting |
| typescript-eslint | ^8 | MIT | TypeScript parser and rules for eslint |
| prettier | ~3.3 | MIT | Code formatting |
| typescript | ~5.5 | Apache-2.0 | TypeScript compiler |
| vitest | ^4 | MIT | Test runner |

## Peer Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| n8n-workflow | * | SEE LICENSE | n8n workflow engine (also listed as devDependency for local builds) |

## Runtime Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Pay-i API | Pay-i | Proxy endpoint for cost tracking and budget enforcement |
| OpenAI API | OpenAI | LLM provider (via Pay-i proxy) |
| Anthropic API | Anthropic | LLM provider (via Pay-i proxy) |
| Azure OpenAI | Microsoft | LLM provider (via Pay-i proxy) |
| AWS Bedrock | Amazon | LLM provider (via Pay-i proxy) |
| Databricks | Databricks | LLM provider (via Pay-i proxy) |

## Companion Toolkit

| Package | Repository | Purpose |
|---------|-----------|---------|
| payi-n8n-toolkit | [Pay-i/utilities](https://github.com/Pay-i/utilities) | Migration and audit scripts for n8n workflows |

Last updated: 2026-06-05
