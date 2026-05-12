# CLAUDE.md — n8n-nodes-payi

## What This Is

n8n community node package for routing LLM requests through Pay-i proxy with cost tracking and budget enforcement. Published to npm as `n8n-nodes-payi`.

## Stack

- **Language:** TypeScript ~5.5
- **Target:** n8n community node (CommonJS, ES2019)
- **Peer dependency:** `n8n-workflow` (any version)
- **Build:** `tsc` + `scripts/copy-icons.js` (zero-dependency icon copier)
- **Lint:** eslint 10 with typescript-eslint 8 (flat config)
- **Format:** prettier ~3.3
- **CI:** GitHub Actions — tag-triggered npm publish with provenance

## Commands

```bash
npm run build       # Clean, compile TypeScript, copy icons to dist/
npm run dev         # TypeScript watch mode
npm run lint        # ESLint (flat config, TypeScript rules)
npm run lint:fix    # ESLint with auto-fix
npm run format      # Prettier (nodes + credentials)
npm pack            # Build and pack for local testing
```

## Architecture

```
credentials/          # n8n credential types (PayiApi, DatabricksApi)
nodes/Payi/           # All node implementations
  descriptions/       # Field definitions (tracking, provider, output fields)
  providers/          # Provider routing logic
  Payi.node.ts        # Generic proxy node
  PayiChatModel*.ts   # Provider-specific LangChain chat model nodes
  payi_logo.png       # Node icon (copied to dist/ at build time)
scripts/
  copy-icons.js       # Build step: copies icons from nodes/ to dist/nodes/
docs/
  providers/          # Per-provider setup documentation
```

## Publishing

1. Bump version in `package.json`
2. Commit and tag: `git tag v<version>`
3. Push tag: `git push origin v<version>`
4. GitHub Actions runs `npm ci && npm publish --provenance --access public`

## Local Testing

```bash
npm pack
cd ~/.n8n/nodes && npm install /path/to/n8n-nodes-payi-*.tgz
rm -rf ~/.n8n/.cache   # Clear n8n cache
# Restart n8n
```

For AI Agent usage, start n8n with: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

## Companion Toolkit

The [payi-utilities/n8n-toolkit](https://github.com/Pay-i/utilities) provides migration and audit scripts that scan n8n instances and replace native LLM nodes with Pay-i equivalents.

## Confidentiality

This is a Pay-i project. All data classification and confidentiality rules from the root `~/src/CLAUDE.md` apply.
