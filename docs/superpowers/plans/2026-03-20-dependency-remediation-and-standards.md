# n8n-nodes-payi Dependency Remediation and Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 14 npm audit vulnerabilities and bring the repo up to project bootstrapping standards.

**Architecture:** Remove gulp (replace with a stdlib Node.js copy script), upgrade eslint 8→10 with flat config, add missing project standard files (CLAUDE.md, SBOM.md, CHANGELOG backfill, .gitignore expansion).

**Tech Stack:** Node.js 18+, TypeScript ~5.5, eslint 10, typescript-eslint 8

**Spec:** `docs/superpowers/specs/2026-03-20-dependency-remediation-and-standards-design.md`

**Working directory:** `/Users/swharr/src/pay-i-instrumentation/n8n-nodes-payi`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `scripts/copy-icons.js` | Copy `*.svg`/`*.png` from `nodes/` to `dist/nodes/` |
| Create | `eslint.config.mjs` | ESLint 10 flat config with TypeScript support |
| Create | `CLAUDE.md` | Project guidance for Claude Code |
| Create | `SBOM.md` | Software bill of materials |
| Create | `todos/.gitkeep` | Session context directory |
| Modify | `package.json` | Remove gulp, update eslint deps, fix scripts |
| Modify | `.gitignore` | Expand to standard template |
| Modify | `CHANGELOG.md` | Reformat + backfill v0.2.1–v0.3.0 |
| Modify | `README.md` | Update dev section (no gulp) |
| Delete | `gulpfile.js` | Replaced by `scripts/copy-icons.js` |
| Regenerate | `package-lock.json` | Reflects new dependency tree |

---

## Task 1: Create Branch

**Files:** None

- [ ] **Step 1: Create feature branch from main**

```bash
cd /Users/swharr/src/pay-i-instrumentation/n8n-nodes-payi
git checkout -b remediation-dev main
```

---

## Task 2: Replace gulp with copy-icons script

**Files:**
- Create: `scripts/copy-icons.js`
- Modify: `package.json` (lines 26-28, 55)
- Delete: `gulpfile.js`

- [ ] **Step 1: Snapshot current build output for comparison**

```bash
cd /Users/swharr/src/pay-i-instrumentation/n8n-nodes-payi
npm run build
find dist -name '*.png' -o -name '*.svg' | sort > /tmp/icons-before.txt
cat /tmp/icons-before.txt
```

Expected: `dist/nodes/Payi/payi_logo.png` (one file).

- [ ] **Step 2: Create `scripts/copy-icons.js`**

```js
#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '..', 'nodes');
const DEST = path.resolve(__dirname, '..', 'dist', 'nodes');
const EXTENSIONS = new Set(['.svg', '.png']);

// Recursive walk that works reliably on Node 18+ (avoids
// Dirent.parentPath which was only added in Node 21.4).
let count = 0;

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }
        if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

        const relPath = path.relative(SRC, fullPath);
        const destFile = path.join(DEST, relPath);

        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(fullPath, destFile);
        console.log(`  copied: ${relPath}`);
        count++;
    }
}

walk(SRC);
console.log(`copy-icons: ${count} file(s) copied to dist/nodes/`);
```

- [ ] **Step 3: Update `package.json` — remove gulp, update build script**

Change `"build"` script:
```json
"build": "npm run clean && tsc && node scripts/copy-icons.js"
```

Remove `"gulp": "^4.0.2"` from `devDependencies`.

- [ ] **Step 4: Delete `gulpfile.js`**

```bash
rm gulpfile.js
```

- [ ] **Step 5: Reinstall dependencies (removes gulp from node_modules)**

```bash
npm install
```

- [ ] **Step 6: Verify build produces identical output**

```bash
npm run build
find dist -name '*.png' -o -name '*.svg' | sort > /tmp/icons-after.txt
diff /tmp/icons-before.txt /tmp/icons-after.txt
```

Expected: No diff. Icon at `dist/nodes/Payi/payi_logo.png`.

- [ ] **Step 7: Verify pack contents**

```bash
npm pack --dry-run 2>&1 | grep payi_logo
```

Expected: `dist/nodes/Payi/payi_logo.png` appears in the file list.

- [ ] **Step 8: Commit**

```bash
git add scripts/copy-icons.js package.json package-lock.json
git rm gulpfile.js
git commit -m "refactor: replace gulp with stdlib copy-icons script

Remove gulp dependency entirely. Icon copying is now handled by a
zero-dependency Node.js script using node:fs and node:path. Resolves
braces/chokidar/micromatch vulnerability chain."
```

---

## Task 3: Upgrade eslint 8 to 10 with flat config

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (lines 29-31, 53-54)

- [ ] **Step 1: Remove old eslint packages, install new ones**

```bash
npm uninstall eslint @typescript-eslint/parser
npm install --save-dev eslint@^10 typescript-eslint@^8
```

- [ ] **Step 2: Create `eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
        extends: [tseslint.configs.recommended],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'scripts/'],
    },
);
```

- [ ] **Step 3: Update lint scripts in `package.json`**

```json
"lint": "eslint nodes credentials",
"lint:fix": "eslint nodes credentials --fix"
```

Drop `--ext .ts` — flat config handles file targeting.

- [ ] **Step 4: Run lint**

```bash
npx eslint nodes credentials
```

Expected: Either zero errors, or pre-existing code issues flagged by `recommended` rules. If errors appear, assess each one:
- Genuine bug → fix the code
- False positive or stylistic → add targeted inline `// eslint-disable-next-line` with a comment explaining why, or add a rule override in `eslint.config.mjs`

- [ ] **Step 5: Run lint:fix**

```bash
npx eslint nodes credentials --fix
```

Verify auto-fix works and doesn't break anything.

- [ ] **Step 6: Verify build still passes after any lint fixes**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
# If any source files were lint-fixed, add them too
git add nodes/ credentials/
git commit -m "chore: upgrade eslint 8→10 with flat config

Replace eslint 8.57 and @typescript-eslint/parser 7.18 with eslint 10
and typescript-eslint 8 (unified package). Add eslint.config.mjs flat
config with recommended TypeScript rules. Resolves minimatch, flatted,
and ajv vulnerabilities."
```

---

## Task 4: Verify zero audit findings

**Files:** Possibly `package.json` if overrides are needed

- [ ] **Step 1: Run npm audit**

```bash
npm audit
```

Expected: `found 0 vulnerabilities`. If any remain:

- [ ] **Step 2 (if needed): Fix remaining vulnerabilities**

Try `npm audit fix` first. If that doesn't resolve, add targeted `overrides` in `package.json` with a comment explaining why.

- [ ] **Step 3: Commit (only if step 2 was needed)**

```bash
git add package.json package-lock.json
git commit -m "chore: resolve remaining npm audit findings"
```

---

## Task 5: Project standards — .gitignore and todos/

**Files:**
- Modify: `.gitignore`
- Create: `todos/.gitkeep`

- [ ] **Step 1: Expand `.gitignore`**

Replace contents with:

```gitignore
# Build output
dist/
*.tgz

# Dependencies
node_modules/

# OS and IDE
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo

# Environment and secrets
.env
.env.local
!.env.example
!.env.op

# Coverage
coverage/

# Project internals
todos/
Plans and Docs/
*.mp4
```

- [ ] **Step 2: Create todos directory**

```bash
mkdir -p todos && touch todos/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore todos/.gitkeep
git commit -m "chore: expand .gitignore to project standards, add todos/"
```

---

## Task 6: Project standards — CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
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

\`\`\`bash
npm run build       # Clean, compile TypeScript, copy icons to dist/
npm run dev         # TypeScript watch mode
npm run lint        # ESLint (flat config, TypeScript rules)
npm run lint:fix    # ESLint with auto-fix
npm run format      # Prettier (nodes + credentials)
npm pack            # Build and pack for local testing
\`\`\`

## Architecture

\`\`\`
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
\`\`\`

## Publishing

1. Bump version in `package.json`
2. Commit and tag: `git tag v<version>`
3. Push tag: `git push origin v<version>`
4. GitHub Actions runs `npm ci && npm publish --provenance --access public`

## Local Testing

\`\`\`bash
npm pack
cd ~/.n8n/nodes && npm install /path/to/n8n-nodes-payi-*.tgz
rm -rf ~/.n8n/.cache   # Clear n8n cache
# Restart n8n
\`\`\`

For AI Agent usage, start n8n with: `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

## Companion Toolkit

The [payi-utilities/n8n-toolkit](https://github.com/Pay-i/utilities) provides migration and audit scripts that scan n8n instances and replace native LLM nodes with Pay-i equivalents.

## Confidentiality

This is a Pay-i project. All data classification and confidentiality rules from the root `~/src/CLAUDE.md` apply.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project guidance"
```

---

## Task 7: Project standards — SBOM.md

**Files:**
- Create: `SBOM.md`

- [ ] **Step 1: Create `SBOM.md`**

```markdown
# Software Bill of Materials

## Direct Dependencies

This package has zero runtime dependencies. All dependencies are dev-only (build tooling).

## Dev Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| eslint | ^10 | MIT | Linting |
| typescript-eslint | ^8 | MIT | TypeScript parser and rules for eslint |
| prettier | ~3.3 | MIT | Code formatting |
| typescript | ~5.5 | Apache-2.0 | TypeScript compiler |

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

Last updated: 2026-03-20
```

- [ ] **Step 2: Commit**

```bash
git add SBOM.md
git commit -m "docs: add SBOM.md software bill of materials"
```

---

## Task 8: CHANGELOG.md — Reformat and Backfill

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Rewrite `CHANGELOG.md`**

Reformat existing entries to Keep a Changelog bracketed format, backfill v0.2.1–v0.3.0 from git history.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Removed `gulp` dependency — icon copying now uses a zero-dependency Node.js script
- Upgraded `eslint` from 8.57 to 10.x with flat config (`eslint.config.mjs`)
- Replaced `@typescript-eslint/parser` with unified `typescript-eslint` v8 package
- Expanded `.gitignore` to project standards

### Added
- `CLAUDE.md` project guidance
- `SBOM.md` software bill of materials

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
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: reformat CHANGELOG to Keep a Changelog, backfill v0.2.1–v0.3.0"
```

---

## Task 9: Update README.md

**Files:**
- Modify: `README.md` (lines 132-139)

- [ ] **Step 1: Update the Development section**

Replace:

```markdown
## Development

\`\`\`bash
npm install     # Install dependencies
npm run build   # Build
npm run dev     # Watch mode
npm run lint    # Lint
\`\`\`
```

With:

```markdown
## Development

\`\`\`bash
npm install       # Install dependencies
npm run build     # Clean, compile TypeScript, copy icons
npm run dev       # TypeScript watch mode
npm run lint      # ESLint (TypeScript rules)
npm run lint:fix  # ESLint with auto-fix
npm run format    # Prettier
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README dev section for new build tooling"
```

---

## Task 10: Final Verification

**Files:** None (read-only checks)

- [ ] **Step 1: Clean build**

```bash
npm run build
```

Expected: TypeScript compiles, `copy-icons: 1 file(s) copied to dist/nodes/` logged.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: Zero errors.

- [ ] **Step 3: Lint fix**

```bash
npm run lint:fix
```

Expected: Works without error.

- [ ] **Step 4: Pack and verify icon**

```bash
npm pack
tar tzf n8n-nodes-payi-*.tgz | grep payi_logo.png
```

Expected: `package/dist/nodes/Payi/payi_logo.png` in output.

- [ ] **Step 5: Audit**

```bash
npm audit
```

Expected: `found 0 vulnerabilities`.

- [ ] **Step 6: Verify all standard files exist**

```bash
for f in CLAUDE.md SBOM.md CHANGELOG.md README.md LICENSE .gitignore eslint.config.mjs scripts/copy-icons.js todos/.gitkeep; do
    [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: All OK.

- [ ] **Step 7: Clean up pack artifact**

```bash
rm -f n8n-nodes-payi-*.tgz
```
